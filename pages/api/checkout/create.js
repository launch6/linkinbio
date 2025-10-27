// pages/api/checkout/create.js
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  try {
    // Body can arrive as object or raw JSON string depending on caller
    const body =
      req.body && typeof req.body === "object"
        ? req.body
        : (() => {
            try {
              return JSON.parse(req.body || "{}");
            } catch {
              return {};
            }
          })();

    // Incoming fields from client
    const {
      priceKey,           // e.g. "STRIPE_PRICE_STARTER_MONTHLY" (preferred)
      priceId,            // e.g. "price_..." (allowed)
      editToken,          // creator profile attachment
      email,              // optional
      refCode,            // any non-empty means referral/Starter+ banner
      applyStarter6mo,    // true when UI intends 6mo free on Starter Monthly
    } = body;

    // Resolve which Stripe Price to use
    const resolvedPriceId =
      (priceKey && process.env[priceKey]) || priceId || process.env.STRIPE_PRICE_STARTER_MONTHLY;

    if (!resolvedPriceId) {
      return res.status(400).json({ error: "Missing price ID (env or payload)." });
    }

    // Determine subscription vs one-time by looking at the env key or actual priceId
    const isSubscription =
      (priceKey && /_MONTHLY$/.test(priceKey)) ||
      (!!resolvedPriceId && !/_LIFETIME$/.test(priceKey || ""));

    // Build discounts ONLY for Starter Monthly + referral path
    const isStarterMonthly =
      resolvedPriceId === process.env.STRIPE_PRICE_STARTER_MONTHLY;

    let computedDiscounts = undefined;

    if (isSubscription && isStarterMonthly && refCode && applyStarter6mo) {
      // Prefer promotion_code API ID
      const promo6m = process.env.STRIPE_PROMO_CODE_ID;
      const coupon6m = process.env.STRIPE_COUPON_STARTER_6M;

      if (promo6m && /^promo_/.test(promo6m)) {
        computedDiscounts = [{ promotion_code: promo6m }];
      } else if (coupon6m && /^coupon_/.test(coupon6m)) {
        computedDiscounts = [{ coupon: coupon6m }];
      }
    }

    // Prepare success/cancel URLs
    const baseUrl =
      process.env.BASE_URL ||
      `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`;

    const success_url = `${baseUrl}/pricing?success=1`;
    const cancel_url = `${baseUrl}/pricing?canceled=1`;

    // Log EVERYTHING we care about (shows up in Vercel Function logs)
    console.log("checkout:create params", {
      priceKey,
      resolvedPriceId,
      isSubscription,
      isStarterMonthly,
      hasRefCode: !!refCode,
      applyStarter6mo: !!applyStarter6mo,
      promoStartsWithPromo: process.env.STRIPE_PROMO_CODE_ID
        ? process.env.STRIPE_PROMO_CODE_ID.startsWith("promo_")
        : null,
      couponStartsWithCoupon: process.env.STRIPE_COUPON_STARTER_6M
        ? process.env.STRIPE_COUPON_STARTER_6M.startsWith("coupon_")
        : null,
      usingDiscounts: !!computedDiscounts,
    });

    const sessionParams = {
      mode: isSubscription ? "subscription" : "payment",
      success_url,
      cancel_url,
      customer_email: email || undefined,
      line_items: [{ price: resolvedPriceId, quantity: 1 }],
      metadata: {
        editToken: editToken || "",
        refCode: refCode || "",
        priceKey: priceKey || "",
      },
    };

    // For subscriptions, attach discounts via subscription_data.discounts
    if (isSubscription && computedDiscounts) {
      sessionParams.subscription_data = { discounts: computedDiscounts };
    } else if (computedDiscounts) {
      // Safety: if Stripe accepts top-level discounts for your mode, attach here too
      sessionParams.discounts = computedDiscounts;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log("checkout:session created", {
      id: session.id,
      url: session.url,
      total_details: session.total_details || null,
      discounts_applied:
        (session.discounts && session.discounts.length) ||
        (session.subscription && "see invoice/line_items"),
    });

    return res.status(200).json({ id: session.id, url: session.url });
  } catch (err) {
    console.error("checkout:create ERROR", {
      message: err?.message,
      type: err?.type,
      raw: err?.raw,
    });
    return res.status(500).json({ error: "Internal error creating Checkout Session." });
  }
}
