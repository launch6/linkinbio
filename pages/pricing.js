// pages/pricing.js
import { useEffect, useState } from 'react';

export default function Pricing() {
  const [code, setCode] = useState('');

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.get('code')) setCode(q.get('code')); // optional: prefill if you share /pricing?code=XYZ
  }, []);

  const startCheckout = async (kind) => {
    const q = new URLSearchParams(location.search);
    const ref = q.get('ref'); // quietly supported if you use /pricing?ref=CODE
    const res = await fetch('/api/checkout/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, promoCode: code || null, ref }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Checkout failed');
      return;
    }
    location.href = data.url;
  };

  return (
    <main className="container">
      <div className="card">
        <h2>Pricing</h2>
        <p className="small">Choose the plan that fits your art business.</p>

        {/* Generic code box (optional). No public mention of referrals/course. */}
        <input
          className="input"
          placeholder="Code (optional)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />

        <div className="row">
          {/* Free */}
          <div className="card" style={{ flex: '1 1 260px' }}>
            <h3>Free</h3>
            <ul>
              <li>1 product • 3 images</li>
              <li>5 links</li>
              <li>Email capture: ❌</li>
            </ul>
            <a className="button secondary" href="/dashboard/new">Start free</a>
          </div>

          {/* Starter */}
          <div className="card" style={{ flex: '1 1 260px' }}>
            <h3>Starter</h3>
            <ul>
              <li>3 products • 3 images each</li>
              <li>15 links</li>
              <li>Email capture (Klaviyo)</li>
            </ul>
            <div className="row">
              <button className="button" onClick={() => startCheckout('starter_monthly')}>
                $9.95 / month
              </button>
              <button className="button secondary" onClick={() => startCheckout('starter_lifetime')}>
                $89.95 lifetime
              </button>
            </div>
          </div>

          {/* Pro */}
          <div className="card" style={{ flex: '1 1 260px' }}>
            <h3>Pro</h3>
            <ul>
              <li>8 products • 5 images each</li>
              <li>Unlimited links</li>
              <li>Featured product • Themes</li>
            </ul>
            <div className="row">
              <button className="button" onClick={() => startCheckout('pro_monthly')}>
                $19.95 / month
              </button>
              <button className="button secondary" onClick={() => startCheckout('pro_lifetime')}>
                $199.95 Pro lifetime
              </button>
            </div>
          </div>

          {/* Business */}
          <div className="card" style={{ flex: '1 1 260px' }}>
            <h3>Business</h3>
            <ul>
              <li>20 products • 10 images each</li>
              <li>Unlimited links</li>
              <li>Custom domain • Analytics</li>
            </ul>
            <div className="row">
              <button className="button" onClick={() => startCheckout('business_monthly')}>
                $29.95 / month
              </button>
              <button className="button secondary" onClick={() => startCheckout('business_lifetime')}>
                $299.95 Business lifetime
              </button>
            </div>
          </div>
        </div>

        <p className="small" style={{ marginTop: 12 }}>
          Start free. Upgrade anytime.
        </p>
      </div>
    </main>
  );
}
