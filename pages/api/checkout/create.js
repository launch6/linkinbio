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
    const body =
      req.body && typeof req.body === "object"
        ? req.body
        : (() => {
            try { return JSON.parse(req.body || "{}"); } catch { return {}; }
          })();

    const {
      priceKey,        // e.g. "STRIPE_PRICE_STARTER_MONTHLY"
      priceId,         // e.g. "price_..."
      editToken,
      email,
      refCode,
      applyStarter6mo, // true when Starter+ 6 months free should apply
    } = body;

    // Resolve Stripe Price ID
    const resolvedPriceId =
      (priceKey && process.env[priceKey]) || priceId || process.env.STRIPE_PRICE_STARTER_MONTHLY;

    if (!resolvedPriceId) {
      return res.status(400).json({ error: "Missing price ID (env or payload)." });
    }

    // Treat Starter Monthly as a subscription
    const isSubscription =
      (priceKey && /_MONTHLY$/.test(priceKey)) ||
      resolvedPriceId === process.env.STRIPE_PRICE_STARTER_MONTHLY;

    const isStarterMonthly = resolvedPriceId === process.env.STRIPE_PRICE_STARTER_MONTHLY;

    // Compute discounts – prefer COUPON to avoid showing a human promo code on Checkout
    let computedDiscounts;
    if (isSubscription && isStarterMonthly && refCode && applyStarter6mo) {
      const coupon6m = process.env.STRIPE_COUPON_STARTER_6M;   // can be custom like "6M_FREE"
      const promo6m  = process.env.STRIPE_PROMO_CODE_ID;       // fallback if no coupon configured

      if (coupon6m && String(coupon6m).trim().length > 0) {
        computedDiscounts = [{ coupon: coupon6m }];
      } else if (promo6m && /^promo_/.test(promo6m)) {
        computedDiscounts = [{ promotion_code: promo6m }];
      }
    }

    const baseUrl =
      process.env.BASE_URL ||
      `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`;

    const success_url = `${baseUrl}/pricing?success=1`;
    const cancel_url  = `${baseUrl}/pricing?canceled=1`;

    console.log("checkout:create params", {
      priceKey,
      resolvedPriceId,
      isSubscription,
      isStarterMonthly,
      hasRefCode: !!refCode,
      applyStarter6mo: !!applyStarter6mo,
      usingCoupon: !!(process.env.STRIPE_COUPON_STARTER_6M && String(process.env.STRIPE_COUPON_STARTER_6M).trim()),
      usingPromoFallback: !process.env.STRIPE_COUPON_STARTER_6M && !!(process.env.STRIPE_PROMO_CODE_ID && /^promo_/.test(process.env.STRIPE_PROMO_CODE_ID)),
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

    // Attach discounts at the top level for Checkout
    if (computedDiscounts) {
      sessionParams.discounts = computedDiscounts;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log("checkout:session created", { id: session.id, url: session.url });
    return res.status(200).json({ id: session.id, url: session.url });
  } catch (err) {
    console.error("checkout:create ERROR", {
      message: err?.message,
      type: err?.type,
      code: err?.code,
      param: err?.param,
      raw_type: err?.rawType,
    });
    return res.status(500).json({ error: "Internal error creating Checkout Session." });
  }
}
