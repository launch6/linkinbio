// pages/dashboard/new-drop.js
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';

const fontStack =
  "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', sans-serif";

const MAX_FILE_SIZE_BYTES = 1024 * 1024; // 1MB
const DRAFT_STORAGE_PREFIX = 'launch6_new_drop_draft';

// Persist token across Stripe redirect (Stripe sometimes returns without it)
const LAST_TOKEN_KEY = 'launch6_last_edit_token';

// Placeholder products (until Stripe product list is wired)
// IMPORTANT: Each option must have a priceUrl or you will hit ?reason=noprice
const PLACEHOLDER_PRODUCTS = [
  {
    id: 'prod_1',
    label: 'My Amazing Art Piece (Price: $150)',
    priceCents: 15000,
    priceDisplay: '$150.00',
    // Replace with your real payment link when ready
    priceUrl:
      'https://buy.stripe.com/test_eVqbJ135y29D3JU0vz4Ni02?client_reference_id=prod_1&l6_slug=555',
  },
  {
    id: 'prod_2',
    label: 'Another Product ($50)',
    priceCents: 5000,
    priceDisplay: '$50.00',
    // Replace with your real payment link when ready
    priceUrl: '',
  },
];

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function safeTrim(v) {
  return typeof v === 'string' ? v.trim() : '';
}

export default function NewDrop() {
  const router = useRouter();
  const { token, stripe_connected } = router.query;

  // Resolved token (query token OR persisted token)
  const [resolvedToken, setResolvedToken] = useState('');

  // Core drop fields
  const [dropTitle, setDropTitle] = useState('');
  const [dropDescription, setDropDescription] = useState('');
  const [quantity, setQuantity] = useState('1'); // blank = open edition
  const [btnText, setBtnText] = useState('Buy Now');
  const [isTimerEnabled, setIsTimerEnabled] = useState(false);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');

  // Stripe / product state
  const [stripeConnected, setStripeConnected] = useState(false);
  const [connectingStripe, setConnectingStripe] = useState(false);

  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedPriceCents, setSelectedPriceCents] = useState(null);
  const [selectedPriceDisplay, setSelectedPriceDisplay] = useState('');
  const [selectedPriceUrl, setSelectedPriceUrl] = useState('');

  const [saving, setSaving] = useState(false);

  // Drop image state
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null); // data URL for display
  const [imageError, setImageError] = useState('');
  const fileInputRef = useRef(null);

  // draft hydration flag (prevents autosave overwriting on first mount)
  const didHydrateDraftRef = useRef(false);

  // --- Resolve token on mount/route ready ---------------------------------
  useEffect(() => {
    if (!router.isReady) return;
    if (typeof window === 'undefined') return;

    const qToken = safeTrim(token);
    const persisted =
      safeTrim(window.sessionStorage.getItem(LAST_TOKEN_KEY)) ||
      safeTrim(window.localStorage.getItem(LAST_TOKEN_KEY));

    const next = qToken || persisted || '';
    setResolvedToken(next);

    if (next) {
      try {
        window.sessionStorage.setItem(LAST_TOKEN_KEY, next);
      } catch {}
      try {
        window.localStorage.setItem(LAST_TOKEN_KEY, next);
      } catch {}
    }
  }, [router.isReady, token]);

  // When returning from Stripe with ?stripe_connected=1, mark as connected
  useEffect(() => {
    if (stripe_connected === '1') {
      setStripeConnected(true);
    }
  }, [stripe_connected]);

  // Clean up preview if component unmounts
  useEffect(() => {
    return () => {
      setImagePreview(null);
    };
  }, []);

  // --- Draft storage helpers ----------------------------------------------
  const getDraftKey = () => {
    const t = safeTrim(resolvedToken) ? safeTrim(resolvedToken) : 'default';
    return `${DRAFT_STORAGE_PREFIX}_${t}`;
  };

  // Store imagePreview in sessionStorage (survives Stripe redirect in same tab)
  const getImagePreviewKey = () => `${getDraftKey()}__imagePreview`;

  const saveDraftToStorage = () => {
    if (typeof window === 'undefined') return;

    const payload = {
      dropTitle,
      dropDescription,
      quantity,
      btnText,
      isTimerEnabled,
      startsAt,
      endsAt,

      // Stripe selection
      selectedProductId,
      selectedPriceCents,
      selectedPriceDisplay,
      selectedPriceUrl,

      // keep in payload too (best effort); primary persistence is sessionStorage
      imagePreview,
    };

    // Try to stash imagePreview in sessionStorage (often more reliable for base64)
    try {
      if (isNonEmptyString(imagePreview)) {
        window.sessionStorage.setItem(getImagePreviewKey(), imagePreview);
      } else {
        window.sessionStorage.removeItem(getImagePreviewKey());
      }
    } catch (err) {
      console.error('[new-drop] Failed to save imagePreview to sessionStorage', err);
    }

    // Save full payload to localStorage (best effort)
    try {
      window.localStorage.setItem(getDraftKey(), JSON.stringify(payload));
    } catch (err) {
      // If localStorage is full (common when saving base64), still save text-only
      try {
        const safePayload = { ...payload, imagePreview: null };
        window.localStorage.setItem(getDraftKey(), JSON.stringify(safePayload));
        console.error('[new-drop] Draft saved without imagePreview (storage full).', err);
      } catch (err2) {
        console.error('[new-drop] Failed to save draft', err2);
      }
    }
  };

  // Load draft when token/route is ready (use sessionStorage for imagePreview first)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!router.isReady) return;

    // Wait until token resolution stabilizes
    const t = safeTrim(resolvedToken) || safeTrim(token);
    if (!t && typeof token === 'undefined') return;

    try {
      const raw = window.localStorage.getItem(getDraftKey());
      if (raw) {
        const d = JSON.parse(raw);

        if (typeof d.dropTitle === 'string') setDropTitle(d.dropTitle);
        if (typeof d.dropDescription === 'string') setDropDescription(d.dropDescription);
        if (typeof d.quantity === 'string') setQuantity(d.quantity);
        if (typeof d.btnText === 'string') setBtnText(d.btnText);
        if (typeof d.isTimerEnabled === 'boolean') setIsTimerEnabled(d.isTimerEnabled);
        if (typeof d.startsAt === 'string') setStartsAt(d.startsAt);
        if (typeof d.endsAt === 'string') setEndsAt(d.endsAt);

        if (typeof d.selectedProductId === 'string') setSelectedProductId(d.selectedProductId);
        if (typeof d.selectedPriceDisplay === 'string') setSelectedPriceDisplay(d.selectedPriceDisplay);
        if (typeof d.selectedPriceCents === 'number') setSelectedPriceCents(d.selectedPriceCents);
        if (typeof d.selectedPriceUrl === 'string') setSelectedPriceUrl(d.selectedPriceUrl);
      }
    } catch (err) {
      console.error('[new-drop] Failed to load draft', err);
    }

    // Restore imagePreview (sessionStorage -> localStorage -> null)
    try {
      const sessionImg = window.sessionStorage.getItem(getImagePreviewKey());
      if (isNonEmptyString(sessionImg)) {
        setImagePreview(sessionImg);
      } else {
        const raw2 = window.localStorage.getItem(getDraftKey());
        if (raw2) {
          const d2 = JSON.parse(raw2);
          if (isNonEmptyString(d2.imagePreview)) {
            setImagePreview(d2.imagePreview);
          }
        }
      }
    } catch (err) {
      console.error('[new-drop] Failed to restore imagePreview', err);
    } finally {
      didHydrateDraftRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, resolvedToken]);

  // Autosave (keeps fields consistent across full redirects)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!router.isReady) return;
    if (!didHydrateDraftRef.current) return;

    const t = window.setTimeout(() => {
      saveDraftToStorage();
    }, 250);

    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    router.isReady,
    resolvedToken,
    dropTitle,
    dropDescription,
    quantity,
    btnText,
    isTimerEnabled,
    startsAt,
    endsAt,
    imagePreview,
    selectedProductId,
    selectedPriceCents,
    selectedPriceDisplay,
    selectedPriceUrl,
  ]);

  // --- Navigation helper ---------------------------------------------------
  const goToStep2 = () => {
    const base = '/dashboard/new-links';
    const t = safeTrim(resolvedToken) || safeTrim(token);
    const target = t ? `${base}?token=${encodeURIComponent(t)}` : base;
    window.location.href = target;
  };

  const goToStep4 = () => {
    const base = '/dashboard/new-email';
    const t = safeTrim(resolvedToken) || safeTrim(token);
    const target = t ? `${base}?token=${encodeURIComponent(t)}` : base;
    window.location.href = target;
  };

  // --- Image handling ------------------------------------------------------
  const handleImageSelect = (file) => {
    if (!file) return;

    setImageError('');

    if (!file.type.startsWith('image/')) {
      setImageError('Please upload an image file (JPG, PNG, GIF).');
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setImageError('Image must be under 1MB. Try a smaller JPG or PNG.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImageFile(file);
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files && e.target.files[0];
    handleImageSelect(file);
  };

  const handleImageDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleImageDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    handleImageSelect(file);
  };

  const handleClearImage = (e) => {
    e.stopPropagation();
    setImageFile(null);
    setImagePreview(null);
    setImageError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(getImagePreviewKey());
      } catch {}
      saveDraftToStorage();
    }
  };

  // --- Stripe connect handler ---------------------------------------------
  const handleConnectStripe = async () => {
    if (connectingStripe) return;

    // Save current work so returning from Stripe restores everything
    saveDraftToStorage();

    setConnectingStripe(true);
    try {
      const t = safeTrim(resolvedToken) || safeTrim(token);

      const res = await fetch('/api/stripe/connect-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: t || null }),
      });

      let data = null;
      try {
        data = await res.json();
      } catch (parseErr) {
        console.error('connect-link JSON parse error:', parseErr);
        throw new Error('Unexpected response from server. Try again.');
      }

      if (!res.ok || !data?.url) {
        throw new Error(data?.error || 'Unable to start Stripe connection.');
      }

      window.location.href = data.url;
    } catch (err) {
      console.error(err);
      alert(err.message || 'There was a problem connecting to Stripe.');
      setConnectingStripe(false);
    }
  };

  // --- Product selection handler ------------------------------------------
  const handleProductChange = (e) => {
    const value = e.target.value;
    setSelectedProductId(value);

    // If placeholder option selected, clear everything
    if (!value) {
      setSelectedPriceCents(null);
      setSelectedPriceDisplay('');
      setSelectedPriceUrl('');
      return;
    }

    const idx = e.target.selectedIndex;
    const opt = e.target.options[idx];

    const centsAttr = opt?.getAttribute('data-pricecents');
    const displayAttr = opt?.getAttribute('data-pricedisplay');
    const urlAttr = opt?.getAttribute('data-priceurl');

    setSelectedPriceCents(
      centsAttr != null && centsAttr !== '' && Number.isFinite(Number(centsAttr))
        ? Number(centsAttr)
        : null
    );
    setSelectedPriceDisplay(displayAttr || '');
    setSelectedPriceUrl(urlAttr || '');
  };

  // --- Form submit ---------------------------------------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!safeTrim(dropTitle)) {
      alert('Add a title for this drop before continuing.');
      return;
    }

    if (!stripeConnected) {
      alert('Connect Stripe before continuing.');
      return;
    }

    if (!safeTrim(selectedProductId)) {
      alert('Choose which product you want to sell.');
      return;
    }

    if (!safeTrim(selectedPriceUrl)) {
      alert(
        'This product is missing a payment link (priceUrl). Add data-priceurl for the selected product option.'
      );
      return;
    }

    if (safeTrim(quantity)) {
      const n = Number(quantity);
      if (!Number.isInteger(n) || n <= 0) {
        alert('Quantity must be a whole number (leave blank for open edition).');
        return;
      }
    }

    if (startsAt && endsAt && new Date(startsAt) >= new Date(endsAt)) {
      alert('End time must be after the start time.');
      return;
    }

    if (saving) return;

    const editToken = safeTrim(resolvedToken) || safeTrim(token);
    if (!editToken) {
      alert('Missing edit token. Restart onboarding from Step 1.');
      return;
    }

    saveDraftToStorage();
    setSaving(true);

    const qty = safeTrim(quantity) ? Number(quantity) : null;

    const productPayload = {
      id: selectedProductId || `p_${Date.now()}`,
      title: safeTrim(dropTitle),
      description: safeTrim(dropDescription),

      // store in multiple fields so old + new readers can find it
      heroImageUrl: imagePreview || '',
      imageUrl: imagePreview || '',
      image: imagePreview || '',

      // critical for /api/products/buy guard
      priceUrl: safeTrim(selectedPriceUrl),

      priceCents: typeof selectedPriceCents === 'number' ? selectedPriceCents : null,
            // new Checkout Session flow (preferred)
      stripePriceId: safeTrim(selectedProductId),
      priceDisplay: selectedPriceDisplay || '',
      priceText: selectedPriceDisplay || '',

      dropStartsAt: isTimerEnabled ? startsAt : '',
      dropEndsAt: isTimerEnabled ? endsAt : '',
      showTimer: !!isTimerEnabled,

      showInventory: qty !== null,
      unitsTotal: qty,
      unitsLeft: qty,

      buttonText: safeTrim(btnText) || 'Buy Now',
      published: true,
    };

    try {
      const resp = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          editToken,
          products: [productPayload],
        }),
      });

      const raw = await resp.text().catch(() => '');
      let json = {};
      try {
        json = raw ? JSON.parse(raw) : {};
      } catch {}

      if (!resp.ok || !json?.ok) {
        console.error('SAVE DROP FAILED', {
          status: resp.status,
          statusText: resp.statusText,
          raw,
          json,
        });

        const msg =
          json?.error ||
          (raw && raw.slice(0, 180)) ||
          `Save failed (${resp.status}). Open DevTools → Console.`;

        alert(msg);
        setSaving(false);
        return;
      }

      goToStep4();
    } catch (err) {
      console.error('Error saving product', err);
      alert('There was a problem saving your drop. Try again.');
      setSaving(false);
    }
  };

  // --- Render --------------------------------------------------------------
  return (
    <main className="onboarding-root">
      <div className="logo-row">
        <img src="/launch6_white.png" alt="Launch6" className="logo" />
      </div>

      <div className="card">
        <div className="card-inner">
          <div className="progress-bar-container">
            <div className="progress-bar-fill step-3" />
          </div>

          <p className="step-label">STEP 3 OF 4</p>
          <h1 className="title">Setup product drop</h1>

          <p className="subtitle">Define your drop details and connect your payment processor.</p>

          <form onSubmit={handleSubmit} className="stack-form">
            <section className="input-group">
              <label className="label">Drop image</label>

              <label
                htmlFor="drop-image-input"
                className={`image-upload-box ${imagePreview ? 'has-image' : ''}`}
                onDragOver={handleImageDragOver}
                onDrop={handleImageDrop}
              >
                <input
                  id="drop-image-input"
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleFileInputChange}
                  style={{ display: 'none' }}
                />

                {imagePreview ? (
                  <>
                    <img src={imagePreview} alt="Drop art preview" className="drop-image-preview" />
                    <div className="image-overlay">
                      <span className="image-overlay-text">Tap to change</span>
                      <button type="button" className="image-clear-btn" onClick={handleClearImage}>
                        Remove
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="upload-icon">
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                    </div>
                    <p className="upload-text">Tap or drop art here</p>
                    <p className="upload-subtext">Max 1MB (JPG, PNG, GIF)</p>
                  </>
                )}
              </label>

              <p className="helper-text">
                This image appears at the top of your drop card. For best results, use a wide (landscape) image.
              </p>
              {imageError && <p className="field-error">{imageError}</p>}
            </section>

            <section className="input-group">
              <label className="label">Drop title</label>
              <input
                type="text"
                className="input-field"
                value={dropTitle}
                onChange={(e) => setDropTitle(e.target.value)}
                placeholder="e.g. Papa Sparrow – Limited Edition Print"
              />
              <p className="helper-text">This title appears on your public drop card.</p>
            </section>

            <section className="input-group">
              <label className="label">
                Short description <span className="label-optional">(optional)</span>
              </label>
              <textarea
                className="textarea-field"
                rows={3}
                value={dropDescription}
                onChange={(e) => setDropDescription(e.target.value)}
                placeholder="Tell collectors what they’re getting (size, edition size, special details, etc.)."
              />
            </section>

            <section className="connection-section">
              <div className="connection-info">
                <h3 className="connection-title">Connect Stripe (required)</h3>
                <p className="connection-desc">This defines your product price and enables sales.</p>
              </div>

              {stripeConnected && (
                <div className="connection-product-block">
                  <select
                    className="input-field connection-product-select"
                    value={selectedProductId}
                    onChange={handleProductChange}
                  >
                    <option value="">Choose a product…</option>

                    {PLACEHOLDER_PRODUCTS.map((p) => (
                      <option
                        key={p.id}
                        value={p.id}
                        data-pricecents={String(p.priceCents ?? '')}
                        data-pricedisplay={p.priceDisplay ?? ''}
                        data-priceurl={p.priceUrl ?? ''}
                      >
                        {p.label}
                      </option>
                    ))}
                  </select>

                  <p className="helper-text connection-helper">
                    Product name and price are managed in your Stripe Dashboard.
                  </p>
                </div>
              )}

              <button
                type="button"
                className={`connect-btn ${stripeConnected ? 'stripe-connected' : 'stripe-connect'}`}
                onClick={handleConnectStripe}
                disabled={connectingStripe}
              >
                {stripeConnected ? '✓ Stripe connected' : connectingStripe ? 'Redirecting…' : 'Connect Stripe'}
              </button>
            </section>

            <div className="divider" />

            <section className="input-group">
              <label className="label">Quantity available</label>
              <input
                type="number"
                min="1"
                className="input-field"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Leave blank for open edition"
              />
              <p className="helper-text">Set a limit for this drop. Leave blank for open edition.</p>
            </section>

            <div className="divider" />

            <section className="input-group">
              <label className="label">Buy button text</label>
              <input
                type="text"
                className="input-field"
                value={btnText}
                onChange={(e) => setBtnText(e.target.value)}
                placeholder="Buy Now"
              />
            </section>

            <section className="input-group">
              <div className="toggle-row">
                <label className="label no-margin">
                  Countdown timer <span className="label-optional">(optional)</span>
                </label>
                <button
                  type="button"
                  className={`toggle-switch ${isTimerEnabled ? 'on' : 'off'}`}
                  onClick={() => setIsTimerEnabled((v) => !v)}
                >
                  <div className="toggle-thumb" />
                </button>
              </div>

              {isTimerEnabled && (
                <div className="timer-inputs">
                  <div className="half-input">
                    <span className="sub-label">Starts</span>
                    <input
                      type="datetime-local"
                      className="input-field"
                      value={startsAt}
                      onChange={(e) => setStartsAt(e.target.value)}
                    />
                  </div>
                  <div className="half-input">
                    <span className="sub-label">Ends</span>
                    <input
                      type="datetime-local"
                      className="input-field"
                      value={endsAt}
                      onChange={(e) => setEndsAt(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </section>

            <div className="actions-row">
              <button type="button" className="btn btn-secondary btn-flex" onClick={goToStep2} disabled={saving}>
                ← Back
              </button>

              <button
                type="submit"
                className="btn btn-primary btn-flex"
                disabled={saving || !stripeConnected}
              >
                {saving ? 'Saving…' : 'Next: Email setup & Complete →'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <style jsx>{`
        :global(html),
        :global(body) {
          background-color: #121219;
          margin: 0;
          padding: 0;
        }

        .onboarding-root {
          min-height: 100vh;
          background-color: #121219;
          color: #ffffff;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 15px 16px 40px;
          font-family: ${fontStack};
        }

        .logo-row {
          margin-bottom: 15px;
        }

        .logo {
          height: 48px;
          width: auto;
        }

        .card {
          width: 100%;
          display: flex;
          justify-content: center;
        }

        .card-inner {
          width: 100%;
          max-width: 540px;
          background: rgba(9, 9, 18, 0.96);
          border-radius: 32px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          box-shadow: 0 18px 60px rgba(0, 0, 0, 0.55);
          padding: 32px 40px 32px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .progress-bar-container {
          width: 100%;
          max-width: 260px;
          height: 4px;
          background: #252837;
          border-radius: 2px;
          margin: 0 auto 16px;
        }

        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #6366ff, #a855f7);
          border-radius: 2px;
        }

        .progress-bar-fill.step-3 {
          width: 75%;
        }

        .step-label {
          font-size: 11px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #8b8fa5;
          margin: 0 0 8px;
        }

        .title {
          font-size: 24px;
          font-weight: 700;
          margin: 0 0 8px;
          text-align: center;
        }

        .subtitle {
          font-size: 14px;
          color: #8b8fa5;
          text-align: center;
          margin: 0 0 24px;
          line-height: 1.4;
        }

        .stack-form {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .input-group {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .label {
          font-size: 13px;
          font-weight: 600;
          color: #d0d2ff;
          margin-left: 4px;
        }

        .label.no-margin {
          margin-left: 0;
        }

        .label-optional {
          font-weight: 400;
          font-size: 11px;
          color: #8b8fa5;
        }

        .helper-text {
          font-size: 12px;
          color: #737799;
          margin: 0 0 0 4px;
        }

        .field-error {
          margin-top: 4px;
          font-size: 12px;
          color: #f97373;
          margin-left: 4px;
        }

        .image-upload-box {
          width: 100%;
          height: 240px;
          border-radius: 20px;
          border: 2px dashed #34384f;
          background: #181a26;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s, transform 0.08s;
        }

        .image-upload-box:hover {
          border-color: #6366ff;
          background: rgba(99, 102, 255, 0.06);
        }

        .image-upload-box.has-image {
          border-style: solid;
        }

        .drop-image-preview {
          width: 100%;
          height: 100%;
          object-fit: contain;
          background-color: #0b0c14;
          display: block;
        }

        .image-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.05));
          opacity: 0;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          padding: 10px 14px;
          pointer-events: none;
          transition: opacity 0.15s ease;
        }

        .image-upload-box.has-image:hover .image-overlay {
          opacity: 1;
          pointer-events: auto;
        }

        .image-overlay-text {
          font-size: 12px;
          color: #e5e7ff;
        }

        .image-clear-btn {
          border: none;
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 11px;
          font-weight: 500;
          background: rgba(12, 12, 20, 0.75);
          color: #fca5a5;
          cursor: pointer;
        }

        .upload-icon {
          color: #6366ff;
          margin-bottom: 8px;
        }

        .upload-text {
          font-size: 14px;
          font-weight: 500;
          color: #ffffff;
          margin: 0;
        }

        .upload-subtext {
          font-size: 12px;
          color: #8b8fa5;
          margin-top: 4px;
        }

        .input-field {
          width: 100%;
          box-sizing: border-box;
          background: #181a26;
          border: 1px solid #34384f;
          border-radius: 12px;
          padding: 12px 16px;
          color: #ffffff;
          font-size: 15px;
          font-family: ${fontStack};
          outline: none;
          transition: border-color 0.2s;
        }

        .input-field:focus {
          border-color: #7e8bff;
        }

        .textarea-field {
          width: 100%;
          box-sizing: border-box;
          background: #181a26;
          border: 1px solid #34384f;
          border-radius: 12px;
          padding: 10px 14px;
          color: #ffffff;
          font-size: 14px;
          font-family: ${fontStack};
          outline: none;
          resize: vertical;
          min-height: 90px;
          line-height: 1.4;
        }

        .textarea-field:focus {
          border-color: #7e8bff;
        }

        .connection-section {
          background: #1c1f2e;
          border-radius: 16px;
          padding: 16px;
          border: 1px solid #2e3247;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .connection-title {
          font-size: 14px;
          font-weight: 600;
          margin: 0 0 4px;
          color: #ffffff;
        }

        .connection-desc {
          font-size: 12px;
          color: #8b8fa5;
          margin: 0;
        }

        .connection-product-block {
          margin: 8px 0 4px;
        }

        .connection-helper {
          margin-top: 6px;
        }

        .connect-btn {
          width: 100%;
          padding: 10px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: all 0.2s;
        }

        .stripe-connect {
          background: #635bff;
          color: #ffffff;
        }

        .stripe-connected {
          background: rgba(99, 91, 255, 0.15);
          color: #8b8fa5;
          border: 1px solid #635bff;
        }

        .divider {
          height: 1px;
          background: #252837;
          width: 100%;
          margin: 4px 0 8px;
        }

        .toggle-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .toggle-switch {
          width: 44px;
          height: 24px;
          border-radius: 99px;
          border: none;
          position: relative;
          cursor: pointer;
          transition: background 0.2s;
        }

        .toggle-switch.off {
          background: #34384f;
        }

        .toggle-switch.on {
          background: #34c759;
        }

        .toggle-thumb {
          width: 20px;
          height: 20px;
          background: #ffffff;
          border-radius: 50%;
          position: absolute;
          top: 2px;
          transition: left 0.2s;
        }

        .toggle-switch.off .toggle-thumb {
          left: 2px;
        }

        .toggle-switch.on .toggle-thumb {
          left: 22px;
        }

        .timer-inputs {
          display: flex;
          gap: 12px;
          margin-top: 8px;
          width: 100%;
        }

        .half-input {
          flex: 1;
        }

        @media (max-width: 600px) {
          .timer-inputs {
            flex-direction: column;
            gap: 10px;
          }

          .half-input {
            width: 100%;
          }
        }

        .sub-label {
          display: block;
          font-size: 11px;
          color: #8b8fa5;
          margin-bottom: 4px;
        }

        .actions-row {
          margin-top: 12px;
          display: flex;
          gap: 12px;
          width: 100%;
        }

        .btn-flex {
          flex: 1;
        }

        .btn-secondary {
          background: rgba(255, 255, 255, 0.06);
          color: #ffffff;
          border: 1px solid #34384f;
          box-shadow: none;
        }

        .btn-secondary:disabled {
          opacity: 0.7;
          cursor: default;
        }

        .btn-secondary:not(:disabled):active {
          transform: translateY(1px);
        }

        @media (max-width: 600px) {
          .actions-row {
            flex-direction: column;
          }
        }

        .btn {
          border-radius: 999px;
          border: none;
          font-family: ${fontStack};
          font-size: 14px;
          font-weight: 500;
          padding: 14px 16px;
          cursor: pointer;
          transition: transform 0.08s ease, box-shadow 0.08s ease, background 0.12s ease;
        }

        .btn-primary {
          width: 100%;
          background: linear-gradient(90deg, #6366ff, #a855f7);
          color: #ffffff;
          box-shadow: 0 10px 28px rgba(88, 92, 255, 0.55);
        }

        .btn-primary:disabled {
          opacity: 0.7;
          cursor: default;
          box-shadow: none;
        }

        .btn-primary:not(:disabled):active {
          transform: translateY(1px);
          box-shadow: 0 4px 14px rgba(88, 92, 255, 0.4);
        }
      `}</style>
    </main>
  );
}
