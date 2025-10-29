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
        : (() => { try { return JSON.parse(req.body || "{}"); } catch { return {}; } })();

    const {
      priceKey,        // env key, e.g. "STRIPE_PRICE_STARTER_MONTHLY"
      priceId,         // direct Stripe price id as fallback
      editToken,
      email,
      refCode,         // any non-empty string enables referral flow
      applyStarter6mo, // boolean (Starter+)
      applyReferral3m, // boolean (friend)
    } = body;

    // Resolve price
    const resolvedPriceId =
      (priceKey && process.env[priceKey]) ||
      priceId ||
      process.env.STRIPE_PRICE_STARTER_MONTHLY;

    if (!resolvedPriceId) {
      return res.status(400).json({ error: "Missing price ID (env or payload)." });
    }

    // Determine plan type
    const isStarterMonthly =
      (priceKey && /STRIPE_PRICE_STARTER_MONTHLY$/.test(priceKey)) ||
      resolvedPriceId === process.env.STRIPE_PRICE_STARTER_MONTHLY;

    // --- Build discounts (COUPON first; promo only as fallback) ---
    let discounts;            // what we'll attach to the session
    let usedPath = "none";    // for logging

    if (refCode && isStarterMonthly) {
      // 6 months (Starter+)
      if (applyStarter6mo) {
        const c = (process.env.STRIPE_COUPON_STARTER_6M || "").trim();       // e.g. "6M_FREE"
        const p = (process.env.STRIPE_PROMO_CODE_ID || "").trim();           // e.g. "promo_..."
        if (c) { discounts = [{ coupon: c }]; usedPath = "coupon-6m"; }
        else if (/^promo_/.test(p)) { discounts = [{ promotion_code: p }]; usedPath = "promo-6m"; }
      }

      // 3 months (friend)
      else if (applyReferral3m) {
        const c = (process.env.STRIPE_COUPON_REFERRAL_3M || "").trim();      // e.g. "STRIPE_PR0M0_REFERRAL_3M0"
        const p = (process.env.STRIPE_PROMO_REFERRAL_3M || "").trim();       // e.g. "promo_..."
        if (c) { discounts = [{ coupon: c }]; usedPath = "coupon-3m"; }
        else if (/^promo_/.test(p)) { discounts = [{ promotion_code: p }]; usedPath = "promo-3m"; }
      }
    }

    const baseUrl =
      process.env.BASE_URL ||
      `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`;

    const sessionParams = {
      mode: "subscription",
      success_url: `${baseUrl}/pricing?success=1`,
      cancel_url: `${baseUrl}/pricing?canceled=1`,
      allow_promotion_codes: true, // keep the "Add coupon" box visible for manual codes
      customer_email: email || undefined,
      line_items: [{ price: resolvedPriceId, quantity: 1 }],
      metadata: {
        editToken: editToken || "",
        refCode: refCode || "",
        priceKey: priceKey || "",
      },
    };

    if (discounts) sessionParams.discounts = discounts;

    // Rich debug (visible in Vercel → Deployment → Runtime Logs)
    console.log("checkout:create", {
      priceKey,
      resolvedPriceId,
      isStarterMonthly,
      refCode,
      applyStarter6mo: !!applyStarter6mo,
      applyReferral3m: !!applyReferral3m,
      usedPath,
      discounts,
      env: {
        STRIPE_COUPON_STARTER_6M: process.env.STRIPE_COUPON_STARTER_6M || null,
        STRIPE_PROMO_CODE_ID: process.env.STRIPE_PROMO_CODE_ID || null,
        STRIPE_COUPON_REFERRAL_3M: process.env.STRIPE_COUPON_REFERRAL_3M || null,
        STRIPE_PROMO_REFERRAL_3M: process.env.STRIPE_PROMO_REFERRAL_3M || null,
      },
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
    return res.status(500).json({ error: "Internal error creating Checkout Session." });
  }
}
