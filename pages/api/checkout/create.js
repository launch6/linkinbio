// pages/api/checkout/create.js
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-01", // Latest as of Oct 2025
});

/**
 * Helpers
 */
function safeStr(v, max = 500) {
  return typeof v === "string" ? v.slice(0, max) : "";
}

function isDiscountError(e) {
  const codes = [
    "resource_missing",
    "promotion_code_ineligible",
    "coupon_expired",
    "coupon_not_applicable",
    "parameter_invalid_empty",
  ];
  return e?.type === "StripeInvalidRequestError" && codes.includes(e?.code);
}

function validDiscountShape(d) {
  return !!d && (typeof d.coupon === "string" || typeof d.promotion_code === "string");
}

/**
 * Build a Checkout Session
 */
async function createSession({ req, priceId, email, editToken, refCode, discounts }) {
  const baseUrl =
    process.env.BASE_URL ||
    `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`;

  const params = {
    mode: "subscription",
    success_url: `${baseUrl}/pricing?success=1`,
    cancel_url: `${baseUrl}/pricing?canceled=1`,
    customer_email: email || undefined,
    allow_promotion_codes: true,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: {
      editToken: safeStr(editToken),
      refCode: safeStr(refCode),
    },
    expand: ["line_items.price.product"], // Faster webhook handling
  };

  if (Array.isArray(discounts) && discounts.length && discounts.every(validDiscountShape)) {
    params.discounts = discounts;
  }

  return stripe.checkout.sessions.create(params);
}

/**
 * Main Handler
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  try {
    // Parse body safely
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
      priceKey,
      priceId: payloadPriceId,
      editToken,
      email,
      refCode,
      applyStarter6mo,
      applyReferral3m,
    } = body;

    // Resolve price ID
    const resolvedPriceId =
      (priceKey && process.env[priceKey]) ||
      payloadPriceId ||
      process.env.STRIPE_PRICE_STARTER_MONTHLY;

    if (!resolvedPriceId) {
      console.warn("checkout:create MISSING PRICE ID", { priceKey, payloadPriceId });
      return res.status(400).json({ error: "Missing price ID (env or payload)." });
    }

    const isStarterMonthly = resolvedPriceId === process.env.STRIPE_PRICE_STARTER_MONTHLY;
    const want6m = !!applyStarter6mo;
    const want3m = !!applyReferral3m && !want6m;

    // Env values
    const COUPON_6M = process.env.STRIPE_COUPON_STARTER_6M;
    const PROMO_6M = process.env.STRIPE_PROMO_CODE_ID;
    const COUPON_3M = process.env.STRIPE_COUPON_REFERRAL_3M;
    const PROMO_3M = process.env.STRIPE_PROMO_REFERRAL_3M;

    // Build discount attempts: coupon first → promo → none
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

    // Log intent
    console.log("checkout:create START", {
      resolvedPriceId,
      isStarterMonthly,
      refCode: !!refCode,
      want6m,
      want3m,
      discountAttempts: discountAttempts.map((d) => Object.keys(d[0])[0]),
      env: {
        COUPON_6M: !!COUPON_6M,
        PROMO_6M: !!PROMO_6M,
        COUPON_3M: !!COUPON_3M,
        PROMO_3M: !!PROMO_3M,
      },
    });

    // Try each discount in order
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

        console.log("checkout:create SUCCESS (discount)", {
          id: session.id,
          type: discounts[0].coupon ? "coupon" : "promotion_code",
          value: discounts[0].coupon || discounts[0].promotion_code,
        });

        return res.status(200).json({ id: session.id, url: session.url });
      } catch (e) {
        if (!isDiscountError(e)) {
          // Fatal: not a discount issue
          console.error("checkout:create FATAL NON-DISCOUNT ERROR", {
            type: e?.type,
            code: e?.code,
            param: e?.param,
            message: e?.message,
            stack: e?.stack?.split("\n").slice(0, 3).join(" | "),
          });
          return res.status(400).json({
            error: "Invalid request – cannot create session",
            details: e?.message || "Stripe rejected the request",
          });
        }

        console.warn("checkout:create DISCOUNT FAILED – trying next", {
          attempted: discounts[0],
          code: e?.code,
          message: e?.message,
        });
      }
    }

    // Fallback: no discount
    try {
      const session = await createSession({
        req,
        priceId: resolvedPriceId,
        email,
        editToken,
        refCode,
        discounts: undefined,
      });

      console.log("checkout:create SUCCESS (no discount)", { id: session.id });
      return res.status(200).json({ id: session.id, url: session.url });
    } catch (e) {
      console.error("checkout:create FINAL FALLBACK FAILED", {
        type: e?.type,
        code: e?.code,
        message: e?.message,
        stack: e?.stack?.split("\n").slice(0, 3).join(" | "),
      });
      return res.status(500).json({ error: "Failed to create Checkout Session." });
    }
  } catch (err) {
    // Uncaught exception (e.g. JSON parse, env missing)
    console.error("checkout:create UNCAUGHT EXCEPTION", {
      message: err?.message,
      name: err?.name,
      stack: err?.stack?.split("\n").slice(0, 5).join(" | "),
    });

    return res.status(500).json({ error: "Unexpected server error." });
  }
}