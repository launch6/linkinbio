// pages/api/checkout/create.js
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

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
      priceKey,         // e.g. "STRIPE_PRICE_STARTER_MONTHLY"
      priceId,          // e.g. "price_..."
      editToken,
      email,
      refCode,          // any non-empty value means referral context
      applyStarter6mo,  // true when Starter+ (course) 6-month perk should apply
      applyReferral3m,  // true when peer-referral 3-month perk should apply
    } = body;

    // Resolve Stripe Price
    const resolvedPriceId =
      (priceKey && process.env[priceKey]) || priceId || process.env.STRIPE_PRICE_STARTER_MONTHLY;
    if (!resolvedPriceId) {
      return res.status(400).json({ error: "Missing price ID (env or payload)." });
    }

    const isSubscription =
      (priceKey && /_MONTHLY$/.test(priceKey)) ||
      resolvedPriceId === process.env.STRIPE_PRICE_STARTER_MONTHLY;

    const isStarterMonthly = resolvedPriceId === process.env.STRIPE_PRICE_STARTER_MONTHLY;

    // --- Build discounts ---
    // Prefer COUPON (keeps the promo code chip hidden). If a coupon isn’t set,
    // fall back to promotion_code when provided.
    let computedDiscounts = undefined;
    let used = null;

    if (isSubscription && isStarterMonthly) {
      // 6 months (course buyer path)
      if (applyStarter6mo) {
        const c6 = process.env.STRIPE_COUPON_STARTER_6M;      // e.g. "6M_FREE"
        const p6 = process.env.STRIPE_PROMO_STARTER_6M || process.env.STRIPE_PROMO_CODE_ID; // safety
        if (c6 && String(c6).trim()) { computedDiscounts = [{ coupon: c6 }]; used = "coupon6m"; }
        else if (p6 && /^promo_/.test(p6)) { computedDiscounts = [{ promotion_code: p6 }]; used = "promo6m"; }
      }

      // 3 months (peer referral path)
      if (!computedDiscounts && applyReferral3m) {
        const c3 = process.env.STRIPE_COUPON_REFERRAL_3M;     // e.g. "STRIPE_PR0M0_REFERRAL_3M0"
        const p3 = process.env.STRIPE_PROMO_REFERRAL_3M;      // e.g. "promo_1SMAb4..."
        if (c3 && String(c3).trim()) { computedDiscounts = [{ coupon: c3 }]; used = "coupon3m"; }
        else if (p3 && /^promo_/.test(p3)) { computedDiscounts = [{ promotion_code: p3 }]; used = "promo3m"; }
      }
    }

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

    if (computedDiscounts) {
      // Stripe Checkout accepts top-level `discounts` for both payment & subscription modes.
      sessionParams.discounts = computedDiscounts;
    }

    console.log("checkout:create params", {
      priceKey, resolvedPriceId, isSubscription, isStarterMonthly,
      refCode: !!refCode, applyStarter6mo: !!applyStarter6mo, applyReferral3m: !!applyReferral3m,
      coupon_6m: process.env.STRIPE_COUPON_STARTER_6M || null,
      coupon_3m: process.env.STRIPE_COUPON_REFERRAL_3M || null,
      used,
    });

    const session = await stripe.checkout.sessions.create(sessionParams);
    return res.status(200).json({ id: session.id, url: session.url });
  } catch (err) {
    console.error("checkout:create ERROR", {
      message: err?.message, type: err?.type, code: err?.code, param: err?.param, raw_type: err?.rawType,
    });
    return res.status(500).json({ error: "Internal error creating Checkout Session." });
  }
}
