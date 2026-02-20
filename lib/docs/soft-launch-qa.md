# Launch6 — Soft Launch QA (Non-Stripe Go-Live)

## 1) Domains + Routing
- [ ] Canonical domain: https://www.l6.io (apex redirects to www)
- [ ] Public page works: https://www.l6.io/<slug>
- [ ] No redirect loops
- [ ] HTTPS + cert valid

## 2) Public Page (pages/[slug].js)
- [ ] Loads profile + products from /api/public?slug=<slug>
- [ ] Theme renders correctly (launch6 / modern / pastel)
- [ ] Social links are safe and open in new tab
- [ ] Links list renders and normalizes URLs
- [ ] Email capture form appears when enabled
- [ ] Timer shows correct phase (starts/ends) and format (days vs HH:MM:SS)
- [ ] Inventory banner displays when enabled
- [ ] After checkout return param success=1 triggers immediate refresh and clears URL

## 3) Onboarding Flow
- [ ] Step 1 (/dashboard/new) loads + saves profile basics
- [ ] Step 2 (/dashboard/new-links) saves links and navigates back/forward with token
- [ ] Step 3 (/dashboard/new-drop) loads Stripe products dropdown and persists selections on Back from Step 4
- [ ] Step 4 (/dashboard/new-email) returns to Step 3 without resetting quantity/Stripe state

## 4) Environment Hygiene (Vercel)
- [ ] Production env vars only for MongoDB + Klaviyo private key
- [ ] Preview does not have MongoDB/Klaviyo private key
- [ ] .gitignore blocks .env*, *.bak
- [ ] No debug endpoints deployed

## 5) Logs / Monitoring
- [ ] Vercel function logs show no repeated 500s on public traffic
- [ ] Mongo connection errors handled gracefully in non-prod

---

## Results (run log)

Test slug: 555

Notes:
. Deployed successfully on Vercel (Production).
. Domain uses https://www.l6.io
. Stripe Workbench webhook endpoint set to https://www.l6.io/api/stripe-webhook
. STRIPE_WEBHOOK_SECRET updated on both Production + Preview; webhook deliveries now return 200.
. Test purchase decremented inventory on slug 555 (4 → 3 → 2 left confirmed).
. Timer renders and updates on page.
. inventory decrements by 1 on purchase
. resending the event does not double-decrement
. sold out shows SOLD OUT, hides timer, disables buy button

### Run log — 2026-02-09
Test slug: 555
- Webhook: 200 OK on https://www.l6.io/api/stripe-webhook (Preview + Production secrets match)
- Inventory decrement confirmed in test: 4 → 3 → 2
