// pages/api/checkout/create.js
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-06-20' });

function priceIdFor(kind) {
  switch (kind) {
    case 'starter_monthly':   return process.env.STRIPE_PRICE_STARTER_MONTHLY;
    case 'starter_lifetime':  return process.env.STRIPE_PRICE_STARTER_LIFETIME;
    case 'pro_monthly':       return process.env.STRIPE_PRICE_PRO_MONTHLY;
    case 'pro_lifetime':      return process.env.STRIPE_PRICE_PRO_LIFETIME;
    case 'business_monthly':  return process.env.STRIPE_PRICE_BUSINESS_MONTHLY;
    case 'business_lifetime': return process.env.STRIPE_PRICE_BUSINESS_LIFETIME;
    default: return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { kind, promoCode, ref } = req.body || {};
  const priceId = priceIdFor(kind);
  if (!priceId) return res.status(400).json({ error: 'Unknown plan/price' });

  const isMonthly = kind.endsWith('_monthly');
  const plan = kind.split('_')[0]; // 'starter' | 'pro' | 'business'

  try {
    const params = {
      mode: isMonthly ? 'subscription' : 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.BASE_URL || 'http://localhost:3000'}/pricing?status=success`,
      cancel_url: `${process.env.BASE_URL || 'http://localhost:3000'}/pricing?status=cancel`,
      metadata: { plan, ref: ref || '' }
    };

    // Quiet promo: ONLY for Starter monthly, and ONLY if a code or ref is present
    if (kind === 'starter_monthly' && (promoCode || ref)) {
      const promoId = process.env.STRIPE_PROMO_CODE_ID || null;
      const couponId = process.env.STRIPE_COUPON_ID || null;
      if (promoId) {
        params.discounts = [{ promotion_code: promoId }];
      } else if (couponId) {
        params.discounts = [{ coupon: couponId }];
      }
    }

    const session = await stripe.checkout.sessions.create(params);
    return res.json({ url: session.url });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Stripe error' });
  }
}
