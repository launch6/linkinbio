# Launch6 Soft Launch QA Run Log

Use this doc to record each end-to-end test run (creator onboarding → publish → purchase → inventory/timer → email capture).

---

## QA Checklist (per test run)

### A) Creator onboarding
- [ ] Step 1 saved (name, slug, bio, avatar)
- [ ] Step 2 saved (links/social)
- [ ] Step 3 saved (product title, image, price, timer, inventory)
- [ ] Step 3 back/forward does not reset Stripe connection or quantity
- [ ] Step 4 email settings saved (if enabled)

### B) Public page rendering (https://www.l6.io/<slug>)
- [ ] Page loads without error
- [ ] Theme renders correctly (launch6 / modern / pastel)
- [ ] Product image renders correctly (aspect ratio ok)
- [ ] Price renders correctly
- [ ] Description renders correctly
- [ ] Timer renders correctly (starts/ends, days mode)
- [ ] Inventory renders correctly (Only X left)
- [ ] Links render and open safely
- [ ] Social icons render and open safely

### C) Purchase flow (test mode)
- [ ] Buy button opens Stripe Checkout
- [ ] Successful test payment returns to ?success=1
- [ ] Inventory decrements within 15s refresh (or on visibility change)
- [ ] Drop ends state works (sold out or timer end)

### D) Email capture
- [ ] Email form accepts valid email
- [ ] Honeypot blocks obvious bots (manual test: fill website field)
- [ ] /api/subscribe returns ok
- [ ] Contact appears in Klaviyo list

---

## Results (run log)

### Run 1
Date:
Test slug:
Notes:

