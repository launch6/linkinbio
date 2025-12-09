// pages/dashboard/new-email.js
import { useState } from "react";
import { useRouter } from "next/router";

const fontStack =
  "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', sans-serif";

export default function NewEmail() {
  const router = useRouter();
  const { token } = router.query;

  // For now we assume Klaviyo is “logically connected”.
  // Later you’ll replace this with a real OAuth / API check.
  const [klaviyoConnected] = useState(true);

  const [selectedList, setSelectedList] = useState("main-list");
  const [emailCaptureEnabled, setEmailCaptureEnabled] = useState(true);
  const [collectFullName, setCollectFullName] = useState(true);
  const [requireSms, setRequireSms] = useState(false);

  const handleSkip = () => {
    router.push("/dashboard");
  };

  const handleLaunch = () => {
    // TODO: later this should “publish” the drop.
    // For now, send them back to the dashboard.
    if (token) {
      router.push(`/dashboard?token=${encodeURIComponent(token)}`);
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <main className="onboarding-root">
      <div className="logo-row">
        <img src="/launch6_white.png" alt="Launch6" className="logo" />
      </div>

      <div className="card">
        <div className="card-inner">
          {/* Progress bar – STEP 4 OF 4 (100%) */}
          <div className="progress-bar-container">
            <div className="progress-bar-fill step-4" />
          </div>

          <p className="step-label">STEP 4 OF 4</p>
          <h1 className="title">Amplify Your Audience</h1>
          <p className="subtitle">
            Connect your marketing tools to grow your collectors.
          </p>

          <div className="stack-form">
            {/* 1. Email Marketing Integration */}
            <section className="panel panel-primary">
              <div className="panel-header">
                <span className="panel-label">EMAIL MARKETING INTEGRATION</span>
              </div>

              {/* Klaviyo connect (visually connected) */}
              <button
                type="button"
                className="klaviyo-connect-btn"
                disabled={!klaviyoConnected}
              >
                <div className="klaviyo-left">
                  <div className="klaviyo-icon">K</div>
                  <span>
                    {klaviyoConnected
                      ? "Connected to Klaviyo"
                      : "Connect to Klaviyo"}
                  </span>
                </div>
                {klaviyoConnected && (
                  <span className="klaviyo-status">✓ Connected</span>
                )}
              </button>

              {/* List dropdown */}
              {klaviyoConnected && (
                <div className="panel-body-block">
                  <label className="field-label" htmlFor="klaviyo-list">
                    Sync signups to list
                  </label>
                  <div className="select-wrap">
                    <select
                      id="klaviyo-list"
                      className="select-field"
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
                  </div>
                  <p className="helper-text">
                    This is where new emails from your drop page will be added.
                  </p>
                </div>
              )}

              {/* Enable email capture toggle */}
              <div className="panel-toggle-row">
                <div className="panel-toggle-copy">
                  <span className="toggle-title">
                    Enable email capture form
                  </span>
                  <span className="toggle-sub">
                    Show a simple form on your drop page so fans can join your
                    list.
                  </span>
                </div>
                <button
                  type="button"
                  className={`toggle-switch ${
                    emailCaptureEnabled ? "on" : "off"
                  }`}
                  onClick={() =>
                    setEmailCaptureEnabled((current) => !current)
                  }
                >
                  <div className="toggle-thumb" />
                </button>
              </div>
            </section>

            {/* 2. Form Preview & Settings */}
            <section className="panel">
              <div className="panel-header">
                <span className="panel-label">FORM PREVIEW & SETTINGS</span>
              </div>

              <div className="form-preview-box">
                <h2 className="form-preview-title">
                  Get Notified About Future Drops
                </h2>

                <div className="form-field">
                  <input
                    type="text"
                    disabled
                    className="preview-input"
                    placeholder="Full Name (optional)"
                  />
                </div>
                <div className="form-field">
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
                  className="preview-submit-btn"
                >
                  Submit
                </button>
              </div>

              {/* Collect full name toggle */}
              <div className="panel-toggle-row">
                <div className="panel-toggle-copy">
                  <span className="toggle-title">Collect full name</span>
                  <span className="toggle-sub">
                    Helpful for more personal emails. Optional for collectors.
                  </span>
                </div>
                <button
                  type="button"
                  className={`toggle-switch ${
                    collectFullName ? "on" : "off"
                  }`}
                  onClick={() => setCollectFullName((current) => !current)}
                >
                  <div className="toggle-thumb" />
                </button>
              </div>
            </section>

            {/* 3. Advanced Form Settings */}
            <section className="panel">
              <div className="panel-header">
                <span className="panel-label">ADVANCED FORM SETTINGS</span>
              </div>

              <div className="panel-toggle-row">
                <div className="panel-toggle-copy">
                  <span className="toggle-title">
                    Require SMS opt-in (US only)
                  </span>
                  <span className="toggle-sub">
                    Add an optional phone number field for SMS updates.
                  </span>
                </div>
                <button
                  type="button"
                  className={`toggle-switch ${requireSms ? "on" : "off"}`}
                  onClick={() => setRequireSms((current) => !current)}
                >
                  <div className="toggle-thumb" />
                </button>
              </div>
            </section>

            {/* Actions */}
            <div className="actions-row">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleSkip}
              >
                Skip for now
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleLaunch}
              >
                Launch Your Page! 🔗
              </button>
            </div>

            <p className="footer-note">
              Don’t worry, you can always update this from your Dashboard.
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        :global(html),
        :global(body) {
          margin: 0;
          padding: 0;
          background-color: #121219; /* same as other steps */
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
          margin-bottom: 18px;
        }

        .logo {
          height: 40px;
          width: auto;
        }

        .card {
          width: 100%;
          display: flex;
          justify-content: center;
        }

        .card-inner {
          width: 100%;
          max-width: 420px; /* slimmer “phone-card” look */
          background: rgba(9, 9, 18, 0.97);
          border-radius: 32px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          box-shadow: 0 18px 60px rgba(0, 0, 0, 0.55);
          padding: 28px 24px 24px;
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
          font-size: 22px;
          font-weight: 700;
          margin: 0 0 6px;
          text-align: center;
        }

        .subtitle {
          font-size: 13px;
          color: #8b8fa5;
          text-align: center;
          margin: 0 0 20px;
          line-height: 1.4;
        }

        .stack-form {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .panel {
          width: 100%;
          border-radius: 18px;
          background: #181a26;
          border: 1px solid #2e3247;
          padding: 14px 14px 12px;
        }

        .panel-primary {
          background: #1c1f2e;
        }

        .panel-header {
          margin-bottom: 10px;
        }

        .panel-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #d0d2ff;
        }

        .klaviyo-connect-btn {
          width: 100%;
          border-radius: 12px;
          padding: 10px 12px;
          border: 1px solid #6366ff;
          background: rgba(99, 102, 255, 0.16);
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 13px;
          font-weight: 500;
          color: #ffffff;
          cursor: default;
        }

        .klaviyo-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .klaviyo-icon {
          height: 26px;
          width: 26px;
          border-radius: 8px;
          background: linear-gradient(135deg, #a855f7, #6366ff);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 700;
        }

        .klaviyo-status {
          font-size: 11px;
          font-weight: 600;
          color: #c7d2ff;
        }

        .panel-body-block {
          margin-top: 10px;
        }

        .field-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #ffffff;
          margin-bottom: 6px;
          margin-left: 2px;
        }

        .select-wrap {
          position: relative;
        }

        .select-field {
          width: 100%;
          box-sizing: border-box;
          border-radius: 12px;
          padding: 10px 34px 10px 12px;
          background: #181a26;
          border: 1px solid #34384f;
          color: #e5e7eb;
          font-size: 13px;
          font-family: ${fontStack};
          outline: none;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%239ca3c0'%3E%3Cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z' clip-rule='evenodd' /%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
          background-size: 16px 16px;
        }

        .select-field:focus {
          border-color: #7e8bff;
        }

        .helper-text {
          font-size: 11px;
          color: #9ca3c0;
          margin: 6px 0 0 2px;
        }

        .panel-toggle-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
          margin-top: 12px;
          padding-top: 10px;
          border-top: 1px solid #252837;
        }

        .panel-toggle-copy {
          flex: 1;
          min-width: 0;
        }

        .toggle-title {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: #ffffff;
        }

        .toggle-sub {
          display: block;
          margin-top: 3px;
          font-size: 11px;
          color: #9ca3c0;
        }

        .toggle-switch {
          width: 44px;
          height: 24px;
          border-radius: 999px;
          border: none;
          position: relative;
          cursor: pointer;
          transition: background 0.2s;
          flex-shrink: 0;
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
          left: 2px;
          transition: left 0.2s;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
        }

        .toggle-switch.on .toggle-thumb {
          left: 22px;
        }

        .form-preview-box {
          background: #050712;
          border-radius: 16px;
          border: 1px solid #252838;
          padding: 14px 14px 12px;
        }

        .form-preview-title {
          font-size: 14px;
          font-weight: 600;
          text-align: center;
          margin: 0 0 10px;
        }

        .form-field {
          margin-bottom: 8px;
        }

        .preview-input {
          width: 100%;
          box-sizing: border-box;
          border-radius: 12px;
          padding: 9px 12px;
          background: #181a26;
          border: 1px solid #34384f;
          color: #e5e7eb;
          font-size: 13px;
          font-family: ${fontStack};
        }

        .preview-input::placeholder {
          color: #7d84a3;
        }

        .preview-submit-btn {
          margin-top: 4px;
          width: 100%;
          border-radius: 999px;
          padding: 10px 14px;
          border: none;
          background: linear-gradient(90deg, #6366ff, #a855f7);
          color: #ffffff;
          font-size: 14px;
          font-weight: 600;
          box-shadow: 0 6px 16px rgba(88, 92, 255, 0.4);
        }

        .actions-row {
          display: flex;
          gap: 10px;
          margin-top: 10px;
        }

        .btn {
          border-radius: 999px;
          border: none;
          font-family: ${fontStack};
          font-size: 13px;
          font-weight: 500;
          padding: 11px 14px;
          cursor: pointer;
          transition: transform 0.08s ease, box-shadow 0.08s ease,
            background 0.12s ease, border-color 0.12s ease;
        }

        .btn-secondary {
          flex: 1;
          background: transparent;
          color: #ffffff;
          border: 1px solid #3f4257;
        }

        .btn-secondary:hover {
          border-color: #7e8bff;
        }

        .btn-primary {
          flex: 1.5;
          background: linear-gradient(90deg, #6366ff, #a855f7);
          color: #ffffff;
          box-shadow: 0 10px 28px rgba(88, 92, 255, 0.55);
        }

        .btn-primary:active {
          transform: translateY(1px);
          box-shadow: 0 4px 14px rgba(88, 92, 255, 0.4);
        }

        .footer-note {
          margin-top: 6px;
          font-size: 11px;
          color: #8b8fa5;
          text-align: center;
        }

        @media (max-width: 480px) {
          .card-inner {
            padding: 24px 18px 20px;
          }
        }
      `}</style>
    </main>
  );
}
