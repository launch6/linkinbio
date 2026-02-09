# Launch6 — Soft Launch QA (Non-Stripe Go-Live)

## 1) Domains + Routing
- [ ] Canonical domain: https://l6.io (www redirects to apex)
- [ ] Public page works: https://l6.io/<slug>
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
- (fill in anything that failed or looked off)
