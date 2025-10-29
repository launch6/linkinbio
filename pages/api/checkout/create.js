// pages/api/checkout/create.js
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

/**
 * Helpers
 */
function safeStr(v, max = 500) {
  return typeof v === "string" ? v.slice(0, max) : "";
}

function isDiscountError(e) {
  // Any discount-related error where retrying a different discount may succeed
  const codes = [
    "resource_missing",            // coupon/promo id not found
    "promotion_code_ineligible",   // promo exists but can't apply to this price/customer
    "coupon_expired",              // self-explanatory
    "coupon_not_applicable",       // stripe sometimes returns this variant
    "parameter_invalid_empty"      // malformed discount payload
  ];
  return e?.type === "StripeInvalidRequestError" && codes.includes(e?.code);
}

function validDiscountShape(d) {
  return !!d && (typeof d.coupon === "string" || typeof d.promotion_code === "string");
}

/**
 * Build a Checkout Session with an optional discounts array.
 * We keep allow_promotion_codes: true so the manual "Add coupon" box is visible.
 */
async function createSession({ req, priceId, email, editToken, refCode, discounts }) {
  const baseUrl =
    process.env.BASE_URL ||
    `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`;

  const params = {
    mode: "subscription",                            // this endpoint is used for monthly flows
    success_url: `${baseUrl}/pricing?success=1`,
    cancel_url: `${baseUrl}/pricing?canceled=1`,
    customer_email: email || undefined,
    allow_promotion_codes: true,                     // keep manual "Add coupon" visible
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: {
      editToken: safeStr(editToken),                 // sanitize
      refCode: safeStr(refCode),                     // sanitize
    },
  };

  if (Array.isArray(discounts) && discounts.length && discounts.every(validDiscountShape)) {
    // Use top-level discounts for Checkout Sessions (supported for subscriptions)
    params.discounts = discounts;
  }

  return stripe.checkout.sessions.create(params);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  try {
    // Parse body safely (works if body is already parsed by Next or raw JSON)
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

    // Only treat as starter monthly if it matches the configured monthly price id
    const isStarterMonthly = resolvedPriceId === process.env.STRIPE_PRICE_STARTER_MONTHLY;

    // Prefer 6M over 3M if both flags happen to be true
    const want6m = !!applyStarter6mo;
    const want3m = !!applyReferral3m && !want6m;

    // Env values (naming follows your project)
    const COUPON_6M = process.env.STRIPE_COUPON_STARTER_6M;     // e.g. "6M_FREE" (coupon id)
    const PROMO_6M  = process.env.STRIPE_PROMO_CODE_ID;         // e.g. "promo_..." (promo id)
    const COUPON_3M = process.env.STRIPE_COUPON_REFERRAL_3M;    // e.g. "STRIPE_PR0M0_REFERRAL_3M0" (coupon id)
    const PROMO_3M  = process.env.STRIPE_PROMO_REFERRAL_3M;     // e.g. "promo_..." (promo id)

    // Build our list of discount attempts in order of preference.
    // For each target (6m or 3m), try coupon first (hidden—no chip) then promo (shows chip).
    const discountAttempts = [];

    if (isStarterMonthly && refCode) {
      if (want6m) {
        if (COUPON_6M) discountAttempts.push([{ coupon: COUPON_6M }]);
        if (PROMO_6M && /^promo_/.test(PROMO_6M)) discountAttempts.push([{ promotion_code: PROMO_6M }]);
      } else if (want3m) {
        if (COUPON_3M) discountAttempts.push([{ coupon: COUPON_3M }]);
        if (PROMO_3M && /^promo_/.test(PROMO_3M)) discountAttempts.push([{ promotion_code: PROMO_3M }]);
      }
    }

    // If no discounts are planned (no ref code/flags), we still create a session (no discount)
    if (!discountAttempts.length) {
      const session = await createSession({
        req,
        priceId: resolvedPriceId,
        email,
        editToken,
        refCode,
        discounts: undefined,
      });
      console.log("checkout:create SUCCESS (no-discount)", { id: session.id });
      return res.status(200).json({ id: session.id, url: session.url });
    }

    // Try each discount path in order; only treat discount-related errors as retriable
    for (const discounts of discountAttempts) {
      try {
        const session = await createSession({
          req,
          priceId: resolvedPriceId,
          email,
          editToken,
          refCode,
          discounts,
        });
        console.log(
          "checkout:create SUCCESS",
          { id: session.id, used: discounts?.[0]?.coupon ? "coupon" : "promotion_code" }
        );
        return res.status(200).json({ id: session.id, url: session.url });
      } catch (e) {
        if (!isDiscountError(e)) {
          console.error("checkout:create NON-DISCOUNT ERROR", {
            type: e?.type, code: e?.code, param: e?.param, message: e?.message,
          });
          return res.status(500).json({ error: "Internal error creating Checkout Session." });
        }
        console.warn("checkout:create DISCOUNT FAILED, trying next", {
          discounts,
          type: e?.type, code: e?.code, param: e?.param, message: e?.message,
        });
        // continue to next attempt
      }
    }

    // If we got here, all discount attempts failed; create a session without discounts
    try {
      const session = await createSession({
        req,
        priceId: resolvedPriceId,
        email,
        editToken,
        refCode,
        discounts: undefined,
      });
      console.log("checkout:create SUCCESS (fallback no-discount)", { id: session.id });
      return res.status(200).json({ id: session.id, url: session.url });
    } catch (e) {
      console.error("checkout:create FINAL FAIL", {
        type: e?.type, code: e?.code, param: e?.param, message: e?.message,
      });
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
