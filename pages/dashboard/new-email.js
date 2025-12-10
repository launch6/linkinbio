// pages/dashboard/new-email.js
import { useState } from 'react';
import { useRouter } from 'next/router';

const fontStack =
  "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', sans-serif";

export default function NewEmailStep() {
  const router = useRouter();
  const { token } = router.query;

  // Basic state for this step
  const [klaviyoConnected, setKlaviyoConnected] = useState(false);
  const [enableForm, setEnableForm] = useState(false); // OFF by default
  const [collectName, setCollectName] = useState(true);
  const [klaviyoListId, setKlaviyoListId] = useState('');
  const [launching, setLaunching] = useState(false);

  // Connect to Klaviyo via our API route
  const handleConnectKlaviyo = async () => {
    if (klaviyoConnected || launching) return;

    try {
      const resp = await fetch('/api/klaviyo/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const json = await resp.json().catch(() => ({}));

      if (!resp.ok || !json?.ok) {
        throw new Error(
          json?.error || 'Unable to connect Klaviyo. Please try again.'
        );
      }

      // Mark as connected and automatically enable the form
      setKlaviyoConnected(true);
      setEnableForm(true);
    } catch (err) {
      console.error(err);
      alert(err.message || 'There was a problem connecting Klaviyo.');
    }
  };

  // Finish onboarding + redirect to the next step
  const finishOnboarding = async (enableEmailCapture) => {
    if (launching) return;
    setLaunching(true);

    try {
      // TODO: later POST these settings to your backend
      // await fetch('/api/onboarding/email-settings', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     token,
      //     enableForm: enableEmailCapture,
      //     collectName,
      //     klaviyoListId: klaviyoListId.trim() || null,
      //   }),
      // });

      const base = '/dashboard/new-links';
      const target = token
        ? `${base}?token=${encodeURIComponent(String(token))}`
        : base;

      router.push(target);
    } catch (err) {
      console.error(err);
      alert('Something went wrong finishing setup. Try again.');
      setLaunching(false);
    }
  };

  const handleLaunch = (e) => {
    e.preventDefault();
    finishOnboarding(enableForm);
  };

  return (
    <main className="onboarding-root">
      <div className="logo-row">
        <img src="/launch6_white.png" alt="Launch6" className="logo" />
      </div>

      <div className="card">
        <div className="card-inner">
          {/* Progress bar – STEP 4 OF 4 (100% filled) */}
          <div className="progress-bar-container">
            <div className="progress-bar-fill step-4" />
          </div>

          <p className="step-label">STEP 4 OF 4</p>
          <h1 className="title">Amplify Your Audience</h1>

          <p className="subtitle">
            Connect your marketing tools to grow your collectors.
          </p>

          <form onSubmit={handleLaunch} className="stack-form">
            {/* 1. Email Marketing / Klaviyo row */}
            <section className="panel panel-main">
              <div className="panel-header">
                <span className="panel-title">Email Marketing</span>
              </div>

              <button
                type="button"
                className={`klaviyo-connect ${klaviyoConnected ? 'connected' : ''}`}
                onClick={handleConnectKlaviyo}
                disabled={launching}
              >
                <div className="klaviyo-left">
                  <span className="klaviyo-icon">K</span>
                  <span className="klaviyo-label">
                    {klaviyoConnected ? 'Connected to Klaviyo' : 'Connect to Klaviyo'}
                  </span>
                </div>
                <span
                  className={`klaviyo-status ${
                    klaviyoConnected ? 'status-connected' : ''
                  }`}
                >
                  {klaviyoConnected ? '✓' : '→'}
                </span>
              </button>

              {/* List selection lives directly under the Klaviyo button */}
              {klaviyoConnected && (
                <div className="list-select">
                  <label className="sync-label" htmlFor="klaviyo-list-input">
                    Sync signups to list
                  </label>
                  <input
                    id="klaviyo-list-input"
                    type="text"
                    className="input-field"
                    value={klaviyoListId}
                    onChange={(e) => setKlaviyoListId(e.target.value)}
                    placeholder="Klaviyo List ID (e.g., RZCAJQ)"
                  />
                  <p className="helper-text">
                    This is where new emails from your drop page will be added. If
                    left blank, we’ll use your default list in Launch6.
                  </p>
                </div>
              )}

              <div className="toggle-row panel-toggle">
                <div className="toggle-text">
                  <span className="toggle-label">Enable email capture form</span>
                  <span className="toggle-subtext">
                    Show a simple form on your drop page so fans can join your list.
                  </span>
                </div>
                <button
                  type="button"
                  className={`toggle-switch ${enableForm ? 'on' : 'off'}`}
                  onClick={() => setEnableForm((v) => !v)}
                  disabled={!klaviyoConnected}
                >
                  <div className="toggle-thumb" />
                </button>
              </div>
            </section>

            {/* 2. Form Preview – only show when email capture is enabled */}
            {enableForm && (
              <section className="panel">
                <div className="panel-header">
                  <span className="panel-title">Form Preview</span>
                </div>

                <div className="form-preview">
                  <h2 className="preview-title">Get Notified About Future Drops</h2>

                  {collectName && (
                    <div className="preview-field">
                      <input
                        type="text"
                        disabled
                        className="preview-input"
                        placeholder="Full Name (optional)"
                      />
                    </div>
                  )}

                  <div className="preview-field">
                    <input
                      type="email"
                      disabled
                      className="preview-input"
                      placeholder="Email Address"
                    />
                  </div>

                  <button
                    type="button"
                    disabled
                    className="preview-submit"
                  >
                    Submit
                  </button>
                </div>

                <div className="toggle-row collect-name-row">
                  <div className="toggle-text">
                    <span className="toggle-label">Collect full name</span>
                    <span className="toggle-subtext">
                      Helpful for more personal emails. Optional for collectors.
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`toggle-switch ${collectName ? 'on' : 'off'}`}
                    onClick={() => setCollectName((v) => !v)}
                  >
                    <div className="toggle-thumb" />
                  </button>
                </div>
              </section>
            )}

            {/* Actions – single primary CTA */}
            <div className="actions-row actions-single">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={launching}
              >
                {launching ? 'Launching…' : 'Launch your project 🚀'}
              </button>
            </div>

            <p className="footer-note">
              Don’t worry, you can always update this from your Dashboard.
            </p>
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
          background: radial-gradient(circle at top, #1d1530 0, #090814 40%, #050509 100%);
          color: #ffffff;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 15px 16px 40px;
          font-family: ${fontStack};
        }

        .logo-row {
          margin-bottom: 18px;
        }

        .logo {
          height: 44px;
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
          background: rgba(9, 9, 18, 0.97);
          border-radius: 32px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          box-shadow: 0 18px 60px rgba(0, 0, 0, 0.6);
          padding: 32px 32px 28px;
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

        .progress-bar-fill.step-4 {
          width: 100%;
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
          gap: 18px;
        }

        .panel {
          width: 100%;
          background: #181a26;
          border-radius: 18px;
          border: 1px solid #272a3e;
          padding: 14px 14px 16px;
        }

        .panel-main {
          background: #1c1f2e;
        }

        .panel-header {
          margin-bottom: 10px;
        }

        .panel-title {
          font-size: 13px;
          font-weight: 600;
          color: #e5e7ff;
        }

        .klaviyo-connect {
          width: 100%;
          margin-top: 4px;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid #2e3248;
          background: #0f111b;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          color: #f9fafb;
          font-size: 13px;
          font-weight: 500;
          transition: border-color 0.15s, background 0.15s, transform 0.08s;
        }

        .klaviyo-connect:hover:not(:disabled) {
          border-color: #6366ff;
        }

        .klaviyo-connect.connected {
          background: rgba(99, 102, 255, 0.12);
          border-color: #6366ff;
        }

        .klaviyo-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .klaviyo-icon {
          width: 24px;
          height: 24px;
          border-radius: 8px;
          background: radial-gradient(circle at 20% 0, #a855f7, #4f46e5);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 700;
        }

        .klaviyo-label {
          white-space: nowrap;
        }

        .klaviyo-status {
          font-size: 14px;
          opacity: 0.75;
        }

        .klaviyo-status.status-connected {
          color: #4ade80;
        }

        .list-select {
          margin-top: 10px;
        }

        .sync-label {
          font-size: 13px;
          font-weight: 500;
          color: #e5e7ff;
          display: block;
          margin-bottom: 4px;
        }

        .toggle-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 12px;
          gap: 10px;
        }

        .panel-toggle {
          margin-top: 14px;
        }

        .toggle-text {
          flex: 1;
          min-width: 0;
        }

        .toggle-label {
          font-size: 13px;
          font-weight: 500;
        }

        .toggle-subtext {
          font-size: 11px;
          color: #9ca3c0;
          margin-top: 2px;
        }

        .toggle-switch {
          width: 44px;
          height: 24px;
          border-radius: 999px;
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

        .toggle-switch:disabled {
          opacity: 0.5;
          cursor: default;
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

        .form-preview {
          margin-top: 8px;
          padding: 14px 14px 16px;
          border-radius: 14px;
          background: #050712;
          border: 1px solid #252838;
        }

        .preview-title {
          font-size: 14px;
          font-weight: 600;
          margin: 0 0 10px;
        }

        .preview-field {
          margin-bottom: 8px;
        }

        .preview-input {
          width: 100%;
          box-sizing: border-box;
          border-radius: 999px;
          border: 1px solid #252838;
          background: #0f111b;
          padding: 10px 14px;
          color: #9ca3c0;
          font-size: 13px;
          outline: none;
        }

        .preview-submit {
          width: 100%;
          margin-top: 4px;
          border-radius: 999px;
          border: none;
          padding: 12px 16px;
          font-size: 14px;
          font-weight: 600;
          background: linear-gradient(90deg, #6366ff, #a855f7);
          color: #ffffff;
        }

        .collect-name-row {
          margin-top: 10px;
        }

        .input-field {
          width: 100%;
          box-sizing: border-box;
          background: #181a26;
          border: 1px solid #34384f;
          border-radius: 10px;
          padding: 10px 12px;
          color: #ffffff;
          font-size: 13px;
          font-family: ${fontStack};
          outline: none;
        }

        .input-field:focus {
          border-color: #7e8bff;
        }

        .helper-text {
          font-size: 11px;
          color: #9ca3c0;
          margin-top: 4px;
        }

        .actions-row {
          display: flex;
          justify-content: center;
          gap: 10px;
          margin-top: 6px;
        }

        .actions-single .btn-primary {
          width: 100%;
        }

        .btn {
          border-radius: 999px;
          border: none;
          font-family: ${fontStack};
          font-size: 14px;
          font-weight: 500;
          padding: 13px 16px;
          cursor: pointer;
          transition: transform 0.08s ease, box-shadow 0.08s ease,
            background 0.12s ease, opacity 0.12s ease;
        }

        .btn-primary {
          background: linear-gradient(90deg, #6366ff, #a855f7);
          color: #ffffff;
          box-shadow: 0 10px 28px rgba(88, 92, 255, 0.55);
          text-align: center;
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

        .footer-note {
          margin-top: 8px;
          font-size: 11px;
          color: #9ca3c0;
          text-align: center;
        }

        @media (max-width: 600px) {
          .card-inner {
            padding: 28px 18px 24px;
          }

          .actions-row {
            flex-direction: column;
          }

          .btn-primary {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
