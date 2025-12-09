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
  const [enableForm, setEnableForm] = useState(true);
  const [collectName, setCollectName] = useState(true);
  const [selectedList, setSelectedList] = useState('main-list');
  const [launching, setLaunching] = useState(false);

  const handleConnectKlaviyo = () => {
    // Later: open a real OAuth / API connection flow.
    if (!klaviyoConnected) {
      setKlaviyoConnected(true);
      alert('Pretending to connect Klaviyo (we will wire this up later).');
    } else {
      setKlaviyoConnected(false);
      alert('Klaviyo disconnected for now.');
    }
  };

  const finishOnboarding = async (enableEmailCapture) => {
    if (launching) return;
    setLaunching(true);

    try {
      // TODO: call a real API to persist email form settings
      // await fetch('/api/onboarding/email-settings', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     token,
      //     enableForm: enableEmailCapture,
      //     collectName,
      //     klaviyoListKey: selectedList,
      //   }),
      // });

      router.push('/dashboard');
    } catch (err) {
      console.error(err);
      alert('Something went wrong finishing setup. Try again.');
      setLaunching(false);
    }
  };

  const handleSkip = () => {
    finishOnboarding(false);
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
            {/* 1. Email Marketing Integration */}
            <section className="panel panel-main">
              <div className="panel-header">
                <span className="panel-title">Email Marketing Integration</span>
              </div>

              {/* Klaviyo connect button */}
              <button
                type="button"
                className={`klaviyo-connect ${
                  klaviyoConnected ? 'connected' : ''
                }`}
                onClick={handleConnectKlaviyo}
              >
                <div className="klaviyo-left">
                  <span className="klaviyo-icon">K</span>
                  <span className="klaviyo-label">
                    {klaviyoConnected
                      ? 'Connected to Klaviyo'
                      : 'Connect to Klaviyo'}
                  </span>
                </div>
                <span className="klaviyo-status">
                  {klaviyoConnected ? '✓' : '→'}
                </span>
              </button>

              {/* List dropdown (visible whether or not connected, for now) */}
              <div className="list-select-block">
                <label className="list-label" htmlFor="klaviyo-list">
                  Sync signups to list
                </label>
                <select
                  id="klaviyo-list"
                  className="list-select"
                  value={selectedList}
                  onChange={(e) => setSelectedList(e.target.value)}
                >
                  <option value="main-list">
                    Launch6 – Primary Subscriber List (Default)
                  </option>
                  <option value="drop-signups">Aurora Drop Signups</option>
                  <option value="waitlist">General Waitlist</option>
                  <option value="legacy-subscribers">
                    Legacy Subscribers
                  </option>
                </select>
                <p className="helper-text">
                  This is where new emails from your drop page will be added.
                </p>
              </div>

              {/* Enable email capture toggle */}
              <div className="toggle-row panel-toggle with-border">
                <div className="toggle-text">
                  <span className="toggle-label">
                    Enable email capture form
                  </span>
                  <span className="toggle-subtext">
                    Show a simple form on your drop page so fans can join your
                    list.
                  </span>
                </div>
                <button
                  type="button"
                  className={`toggle-switch ${enableForm ? 'on' : 'off'}`}
                  onClick={() => setEnableForm((v) => !v)}
                >
                  <div className="toggle-thumb" />
                </button>
              </div>
            </section>

            {/* 2. Form Preview & Settings */}
            <section className="panel">
              <div className="panel-header">
                <span className="panel-title">Form Preview &amp; Settings</span>
              </div>

              <div
                className={`form-preview ${
                  !enableForm ? 'disabled' : ''
                }`}
              >
                <h2 className="preview-title">
                  Get Notified About Future Drops
                </h2>

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

              {/* Collect name toggle */}
              <div className="toggle-row collect-name-row with-border">
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

            {/* NOTE: Advanced settings / SMS panel removed per your request */}

            {/* Actions */}
            <div className="actions-row">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleSkip}
                disabled={launching}
              >
                Skip for now
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={launching}
              >
                {launching ? 'Launching…' : 'Launch Your Page! 🔗'}
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
          background: radial-gradient(
            circle at top,
            #1d1530 0,
            #090814 40%,
            #050509 100%
          );
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
          text-transform: uppercase;
          letter-spacing: 0.08em;
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

        .klaviyo-connect:hover {
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

        .klaviyo-status {
          font-size: 14px;
          opacity: 0.75;
        }

        .list-select-block {
          margin-top: 12px;
        }

        .list-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          margin: 0 0 4px 2px;
          color: #e5e7ff;
        }

        .list-select {
          width: 100%;
          box-sizing: border-box;
          background: #181a26;
          border: 1px solid #34384f;
          border-radius: 10px;
          padding: 8px 12px;
          color: #f9fafb;
          font-size: 13px;
          font-family: ${fontStack};
          outline: none;
          appearance: none;
          background-image: linear-gradient(
              45deg,
              transparent 50%,
              #9ca3c0 50%
            ),
            linear-gradient(135deg, #9ca3c0 50%, transparent 50%);
          background-position: calc(100% - 14px) 50%, calc(100% - 9px) 50%;
          background-size: 5px 5px, 5px 5px;
          background-repeat: no-repeat;
        }

        .list-select:focus {
          border-color: #7e8bff;
        }

        .helper-text {
          font-size: 11px;
          color: #9ca3c0;
          margin-top: 4px;
          margin-left: 2px;
        }

        .toggle-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        .panel-toggle {
          margin-top: 10px;
        }

        .with-border {
          border-top: 1px solid #252837;
          padding-top: 10px;
          margin-top: 12px;
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

        .form-preview.disabled {
          opacity: 0.4;
        }

        .preview-title {
          font-size: 14px;
          font-weight: 600;
          margin: 0 0 10px;
          text-align: center;
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

        .actions-row {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          margin-top: 6px;
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
          flex: 1;
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

        .btn-ghost {
          min-width: 110px;
          background: transparent;
          color: #e5e7eb;
          border: 1px solid #3f4257;
        }

        .btn-ghost:disabled {
          opacity: 0.6;
          cursor: default;
        }

        .footer-note {
          margin-top: 8px;
          font-size: 11px;
          color: #9e9fb7;
          text-align: center;
        }

        @media (max-width: 600px) {
          .card-inner {
            padding: 28px 18px 24px;
          }

          .actions-row {
            flex-direction: column;
          }

          .btn-ghost,
          .btn-primary {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
