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
      priceId,         // direct Stripe price id (fallback)
      editToken,
      email,
      refCode,         // any non-empty => referral flow
      applyStarter6mo, // boolean
      applyReferral3m, // boolean
    } = body;

    // Resolve price
    const resolvedPriceId =
      (priceKey && process.env[priceKey]) ||
      priceId ||
      process.env.STRIPE_PRICE_STARTER_MONTHLY;

    if (!resolvedPriceId) {
      return res.status(400).json({ error: "Missing price ID (env or payload)." });
    }

    // Detect subscription (monthly) vs one-time (lifetime)
    const isSubscription =
      (priceKey && /_MONTHLY$/.test(priceKey)) ||
      resolvedPriceId === process.env.STRIPE_PRICE_STARTER_MONTHLY;

    const isStarterMonthly = resolvedPriceId === process.env.STRIPE_PRICE_STARTER_MONTHLY;

    // ---- Choose discounts (coupon first to HIDE the code chip; promo fallback to SHOW it) ----
    let discounts = undefined;

    if (isSubscription && isStarterMonthly && refCode) {
      if (applyStarter6mo) {
        const coupon6m = process.env.STRIPE_COUPON_STARTER_6M;     // e.g. "6M_FREE"
        const promo6m  = process.env.STRIPE_PROMO_CODE_ID;         // e.g. "promo_..."
        if (coupon6m && String(coupon6m).trim()) {
          discounts = [{ coupon: coupon6m }];
        } else if (promo6m && /^promo_/.test(promo6m)) {
          discounts = [{ promotion_code: promo6m }];
        }
      } else if (applyReferral3m) {
        const coupon3m = process.env.STRIPE_COUPON_REFERRAL_3M;    // e.g. "STRIPE_PR0M0_REFERRAL_3M0"
        const promo3m  = process.env.STRIPE_PROMO_REFERRAL_3M;     // e.g. "promo_..."
        if (coupon3m && String(coupon3m).trim()) {
          discounts = [{ coupon: coupon3m }];
        } else if (promo3m && /^promo_/.test(promo3m)) {
          discounts = [{ promotion_code: promo3m }];
        }
      }
    }

    // Success/cancel
    const baseUrl =
      process.env.BASE_URL ||
      `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`;

    const sessionParams = {
      mode: isSubscription ? "subscription" : "payment",
      success_url: `${baseUrl}/pricing?success=1`,
      cancel_url: `${baseUrl}/pricing?canceled=1`,
      customer_email: email || undefined,
      line_items: [{ price: resolvedPriceId, quantity: 1 }],
      metadata: {
        editToken: editToken || "",
        refCode: refCode || "",
        priceKey: priceKey || "",
      },
    };

    // ✅ Correct way for Checkout: top-level discounts
    if (discounts) sessionParams.discounts = discounts;

    // Debug
    console.log("checkout:create params", {
      priceKey,
      resolvedPriceId,
      isSubscription,
      isStarterMonthly,
      refCode,
      applyStarter6mo: !!applyStarter6mo,
      applyReferral3m: !!applyReferral3m,
      using:
        (discounts && discounts[0]?.coupon && "coupon") ||
        (discounts && discounts[0]?.promotion_code && "promotion_code") ||
        "none",
      coupon6m: process.env.STRIPE_COUPON_STARTER_6M || null,
      coupon3m: process.env.STRIPE_COUPON_REFERRAL_3M || null,
    });

    const session = await stripe.checkout.sessions.create(sessionParams);
    return res.status(200).json({ id: session.id, url: session.url });
  } catch (err) {
    console.error("checkout:create ERROR", {
      message: err?.message,
      type: err?.type,
      code: err?.code,
      param: err?.param,
      raw_type: err?.rawType,
    });
    return res.status(500).json({ error: err?.message || "Internal error creating Checkout Session." });
  }
}
