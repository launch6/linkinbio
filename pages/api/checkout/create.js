// pages/api/checkout/create.js
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  // Keep the API version you’ve been using unless you intend to upgrade deliberately.
  apiVersion: "2024-06-20",
});

/* ----------------------------- Helpers ----------------------------- */

function safeStr(v, max = 500) {
  return typeof v === "string" ? v.slice(0, max) : "";
}

function isDiscountError(e) {
  // Retry-worthy discount errors
  const codes = [
    "resource_missing",            // coupon/promo not found
    "promotion_code_ineligible",   // promo exists but not applicable
    "coupon_expired",
    "coupon_not_applicable",
    "parameter_invalid_empty",
  ];
  return e?.type === "StripeInvalidRequestError" && codes.includes(e?.code);
}

function validDiscountShape(d) {
  return !!d && (typeof d.coupon === "string" || typeof d.promotion_code === "string");
}

async function createSession({ req, priceId, email, editToken, refCode, discounts }) {
  const baseUrl =
    process.env.BASE_URL ||
    `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`;

  const params = {
    mode: "subscription", // this endpoint is used for monthly flows
    success_url: `${baseUrl}/pricing?success=1`,
    cancel_url: `${baseUrl}/pricing?canceled=1`,
    customer_email: email || undefined,
    allow_promotion_codes: true, // keep the "Add coupon" input visible
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: {
      editToken: safeStr(editToken),
      refCode: safeStr(refCode),
    },
  };

  if (Array.isArray(discounts) && discounts.length && discounts.every(validDiscountShape)) {
    // Use top-level discounts for Checkout Sessions (works for subscriptions)
    params.discounts = discounts;
  }

  return stripe.checkout.sessions.create(params);
}

/* ------------------------------ Route ------------------------------ */

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  try {
    // Parse body safely (supports already-parsed object or raw JSON)
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
      refCode,          // any non-empty string enables referral flow
      applyStarter6mo,  // boolean (starterplus path)
      applyReferral3m,  // boolean (friend path)
    } = body;

    // Resolve Stripe Price
    const resolvedPriceId =
      (priceKey && process.env[priceKey]) ||
      priceId ||
      process.env.STRIPE_PRICE_STARTER_MONTHLY;

    if (!resolvedPriceId) {
      return res.status(400).json({ error: "Missing price ID (env or payload)." });
    }

    // Treat as Starter Monthly only when matching the configured monthly price id
    const isStarterMonthly = resolvedPriceId === process.env.STRIPE_PRICE_STARTER_MONTHLY;

    // If both flags somehow come in, prefer the Starter+ (6m) path
    const want6m = !!applyStarter6mo;
    const want3m = !!applyReferral3m && !want6m;

    // Env values
    const COUPON_6M = process.env.STRIPE_COUPON_STARTER_6M;     // e.g., "6M_FREE"
    const PROMO_6M  = process.env.STRIPE_PROMO_CODE_ID;         // e.g., "promo_…"
    const COUPON_3M = process.env.STRIPE_COUPON_REFERRAL_3M;    // e.g., "STRIPE_PR0M0_REFERRAL_3M0"
    const PROMO_3M  = process.env.STRIPE_PROMO_REFERRAL_3M;     // e.g., "promo_…"

    // Build attempts in order of preference: COUPON (hidden) -> PROMO (shows chip)
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

    // If no discounts planned (no ref/flags), still create a plain session
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

    // Try each discount path; only retry on discount-related errors
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
        console.log("checkout:create SUCCESS", {
          id: session.id,
          used: discounts?.[0]?.coupon ? "coupon" : "promotion_code",
        });
        return res.status(200).json({ id: session.id, url: session.url });
      } catch (e) {
        if (!isDiscountError(e)) {
          // Non-discount problem → surface it to client so we can see details
          console.error("checkout:create NON-DISCOUNT FATAL", {
            type: e?.type,
            code: e?.code,
            param: e?.param,
            message: e?.message,
            stack: e?.stack?.split("\n").slice(0, 5).join("\n"),
          });
          return res.status(400).json({
            error: "Invalid request – cannot create session",
            details: e?.message || "Unknown Stripe error",
          });
        }
        console.warn("checkout:create DISCOUNT FAILED – trying next", {
          discounts,
          type: e?.type,
          code: e?.code,
          param: e?.param,
          message: e?.message,
        });
        // continue to next attempt
      }
    }

    // If every discount attempt failed, fall back to a plain session (user can add a code manually)
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
        type: e?.type,
        code: e?.code,
        param: e?.param,
        message: e?.message,
        stack: e?.stack?.split("\n").slice(0, 5).join("\n"),
      });
      return res.status(500).json({ error: "Internal error creating Checkout Session." });
    }
  } catch (err) {
    // Truly unexpected (bad JSON, missing envs, etc.)
    console.error("checkout:create UNCAUGHT EXCEPTION", {
      message: err?.message,
      name: err?.name,
      stack: err?.stack?.split("\n").slice(0, 5).join("\n"),
    });
    return res.status(500).json({ error: "Unexpected server error – check logs" });
  }
}
