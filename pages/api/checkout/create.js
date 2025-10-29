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

  // Small helper: build a Checkout Session with given discounts
  async function createSession({ priceId, email, editToken, refCode, discounts }) {
    const baseUrl =
      process.env.BASE_URL ||
      `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`;

    const params = {
      mode: "subscription", // we only hit this endpoint for monthly from our UI
      success_url: `${baseUrl}/pricing?success=1`,
      cancel_url: `${baseUrl}/pricing?canceled=1`,
      customer_email: email || undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        editToken: editToken || "",
        refCode: refCode || "",
      },
    };

    if (discounts && discounts.length) {
      // IMPORTANT: use top-level discounts with Checkout
      params.discounts = discounts;
    }

    return stripe.checkout.sessions.create(params);
  }

  try {
    // Parse body safely (supports raw JSON or already-parsed)
    const body =
      req.body && typeof req.body === "object"
        ? req.body
        : (() => {
            try { return JSON.parse(req.body || "{}"); } catch { return {}; }
          })();

    const {
      priceKey,         // e.g. "STRIPE_PRICE_STARTER_MONTHLY"
      priceId,          // e.g. "price_..."
      editToken,
      email,
      refCode,          // non-empty => referral flow
      applyStarter6mo,  // boolean (starterplus)
      applyReferral3m,  // boolean (friend)
    } = body;

    // Resolve price (prefer env key)
    const resolvedPriceId =
      (priceKey && process.env[priceKey]) ||
      priceId ||
      process.env.STRIPE_PRICE_STARTER_MONTHLY;

    if (!resolvedPriceId) {
      return res.status(400).json({ error: "Missing price ID (env or payload)." });
    }

    // We only ever call this for monthly from our UI; still keep a guard:
    const isStarterMonthly = resolvedPriceId === process.env.STRIPE_PRICE_STARTER_MONTHLY;

    // Figure out which discount we intend
    //  - Prefer 6M if starterplus flag present
    //  - Else use 3M if friend flag present
    let intended = null; // "6m-coupon" | "6m-promo" | "3m-coupon" | "3m-promo" | null

    // Values from env
    const COUPON_6M = process.env.STRIPE_COUPON_STARTER_6M;     // e.g. 6M_FREE
    const PROMO_6M  = process.env.STRIPE_PROMO_CODE_ID;         // promo_...
    const COUPON_3M = process.env.STRIPE_COUPON_REFERRAL_3M;    // e.g. STRIPE_PR0M0_REFERRAL_3M0  (exactly as in Stripe)
    const PROMO_3M  = process.env.STRIPE_PROMO_REFERRAL_3M;     // promo_...

    let firstDiscounts = undefined;   // first attempt
    let retryDiscounts = undefined;   // fallback attempt (only when coupon not found)

    if (isStarterMonthly && refCode) {
      if (applyStarter6mo && COUPON_6M) {
        intended = "6m-coupon";
        firstDiscounts = [{ coupon: COUPON_6M }];
        if (PROMO_6M && /^promo_/.test(PROMO_6M)) retryDiscounts = [{ promotion_code: PROMO_6M }];
      } else if (applyReferral3m && COUPON_3M) {
        intended = "3m-coupon";
        firstDiscounts = [{ coupon: COUPON_3M }];
        if (PROMO_3M && /^promo_/.test(PROMO_3M)) retryDiscounts = [{ promotion_code: PROMO_3M }];
      } else if (applyStarter6mo && PROMO_6M && /^promo_/.test(PROMO_6M)) {
        intended = "6m-promo";
        firstDiscounts = [{ promotion_code: PROMO_6M }];
      } else if (applyReferral3m && PROMO_3M && /^promo_/.test(PROMO_3M)) {
        intended = "3m-promo";
        firstDiscounts = [{ promotion_code: PROMO_3M }];
      }
    }

    console.log("checkout:create BEGIN", {
      priceKey,
      resolvedPriceId,
      isStarterMonthly,
      refCode,
      applyStarter6mo: !!applyStarter6mo,
      applyReferral3m: !!applyReferral3m,
      env: {
        STRIPE_COUPON_STARTER_6M: COUPON_6M || null,
        STRIPE_PROMO_CODE_ID: PROMO_6M || null,
        STRIPE_COUPON_REFERRAL_3M: COUPON_3M || null,
        STRIPE_PROMO_REFERRAL_3M: PROMO_3M || null,
      },
      intended,
      firstDiscounts,
      retryDiscounts,
    });

    // First attempt (coupon if available; otherwise promo; otherwise none)
    try {
      const session = await createSession({
        priceId: resolvedPriceId,
        email,
        editToken,
        refCode,
        discounts: firstDiscounts,
      });

      console.log("checkout:create SUCCESS:first", { id: session.id, url: session.url });
      return res.status(200).json({ id: session.id, url: session.url });
    } catch (e) {
      const isMissingCoupon =
        e?.type === "StripeInvalidRequestError" &&
        e?.code === "resource_missing" &&
        typeof e?.message === "string" &&
        /No such coupon/i.test(e.message);

      console.warn("checkout:create FIRST ATTEMPT FAILED", {
        type: e?.type,
        code: e?.code,
        param: e?.param,
        message: e?.message,
      });

      // If coupon was missing, and we have a promo fallback, retry with promotion_code
      if (isMissingCoupon && retryDiscounts) {
        try {
          const session = await createSession({
            priceId: resolvedPriceId,
            email,
            editToken,
            refCode,
            discounts: retryDiscounts,
          });
          console.log("checkout:create SUCCESS:retry-promo", { id: session.id, url: session.url });
          return res.status(200).json({ id: session.id, url: session.url });
        } catch (e2) {
          console.error("checkout:create RETRY FAILED", {
            type: e2?.type,
            code: e2?.code,
            param: e2?.param,
            message: e2?.message,
          });
          return res.status(500).json({ error: "Internal error creating Checkout Session." });
        }
      }

      // No special retry path -> bubble generic error
      return res.status(500).json({ error: "Internal error creating Checkout Session." });
    }
  } catch (err) {
    console.error("checkout:create UNCAUGHT", {
      message: err?.message,
      type: err?.type,
      code: err?.code,
      param: err?.param,
      raw_type: err?.rawType,
    });
    return res.status(500).json({ error: "Internal error creating Checkout Session." });
  }
}
