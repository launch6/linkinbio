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
      refCode,         // string or ""
      applyStarter6mo, // boolean
      applyReferral3m, // boolean
    } = body;

    // Resolve Stripe Price ID
    const resolvedPriceId =
      (priceKey && process.env[priceKey]) || priceId || process.env.STRIPE_PRICE_STARTER_MONTHLY;

    if (!resolvedPriceId) {
      return res.status(400).json({ error: "Missing price ID (env or payload)." });
    }

    // Mode
    const isSubscription =
      (priceKey && /_MONTHLY$/.test(priceKey)) ||
      resolvedPriceId === process.env.STRIPE_PRICE_STARTER_MONTHLY;

    const isStarterMonthly = resolvedPriceId === process.env.STRIPE_PRICE_STARTER_MONTHLY;

    // Compute discounts
    let computedDiscounts;
    if (isSubscription && isStarterMonthly && refCode) {
      // 6-month (Starter+) path
      if (applyStarter6mo) {
        const coupon6m = process.env.STRIPE_COUPON_STARTER_6M;
        const promo6m  = process.env.STRIPE_PROMO_CODE_ID;
        if (coupon6m && String(coupon6m).trim().length > 0) {
          computedDiscounts = [{ coupon: coupon6m }];
        } else if (promo6m && /^promo_/.test(promo6m)) {
          computedDiscounts = [{ promotion_code: promo6m }];
        }
      }
      // 3-month peer referral
      else if (applyReferral3m) {
        const coupon3m = process.env.STRIPE_COUPON_REFERRAL_3M;
        const promo3m  = process.env.STRIPE_PROMO_REFERRAL_3M;
        if (coupon3m && String(coupon3m).trim().length > 0) {
          computedDiscounts = [{ coupon: coupon3m }];
        } else if (promo3m && /^promo_/.test(promo3m)) {
          computedDiscounts = [{ promotion_code: promo3m }];
        }
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
      refCode,
      applyStarter6mo: !!applyStarter6mo,
      applyReferral3m: !!applyReferral3m,
      usingCoupon6m: !!process.env.STRIPE_COUPON_STARTER_6M,
      usingCoupon3m: !!process.env.STRIPE_COUPON_REFERRAL_3M,
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

    if (computedDiscounts) {
      sessionParams.discounts = computedDiscounts; // Checkout accepts top-level for subs
    }

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
