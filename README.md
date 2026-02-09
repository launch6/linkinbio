# Launch6 / l6.io — Link‑in‑Bio MVP (v4: Four public tiers + hidden Starter+ + referrals)

Includes:
- Public pages `/[slug]`
- Secret editor `/dashboard/[editToken]`
- Plans & limits (Free, Starter $9, Pro $19, Business $29) + hidden **Starter+** (course/referral)
- Referral links `/ref/[CODE]` → `/pricing?ref=CODE`
- Pricing with Checkout buttons ($9/$19/$29 + $89 lifetime for Starter)
- Stripe Checkout creator + Webhook (records orders)
- Klaviyo server‑side capture

## Hidden Starter+ (course/referral)
- Feature limits between Starter and Pro
- In app, set `plan='starter_plus'` and `planExpiresAt=<6 months>`
- Billing uses **Starter monthly** with a **6‑month 100% promo** → after expiry, app auto‑downgrades to `starter`, Stripe starts charging $9/mo.

## Stripe setup
- Create Prices:
  - `STRIPE_PRICE_STARTER_MONTHLY` ($9/mo, recurring)
  - `STRIPE_PRICE_STARTER_LIFETIME` ($89 one‑time)
  - `STRIPE_PRICE_PRO_MONTHLY` ($19/mo, recurring)
  - `STRIPE_PRICE_BUSINESS_MONTHLY` ($29/mo, recurring)
- Create **Promotion** for 6 months free (100% off repeating 6 months):
  - Prefer **Promotion Code** → `STRIPE_PROMO_CODE_ID`
  - (Or Coupon) → `STRIPE_COUPON_ID`
- Add Webhook endpoint: `/api/stripe-webhook` with event `checkout.session.completed`

## How the 6‑month deal applies
- On `/pricing`, if a user types a code OR arrives via `?ref=…`, the backend applies the 6‑month free promo to **Starter monthly only**.
- After checkout, record the order in `orders`. Next step (optional): match that order to a profile and set app plan:
  - If monthly Starter **with** code/ref → set `starter_plus` and `planExpiresAt=+6 months`
  - Else set `starter` / `pro` / `business` accordingly

## Auto‑expiry behavior
- API GET auto‑downgrades:
  - `starter_plus` → `starter` if `planExpiresAt` < now
  - (Legacy) `starter` → `free` if `planExpiresAt` < now

## Run locally
```bash
npm install
cp .env.example .env.local  # fill values
npm run dev
```

## Deploy
- Push to GitHub → import to Vercel → set env vars → add domains `launch6.com` & `l6.io`
- Set `BASE_URL=https://www.l6.io`

---

© 2026 Launch6
