import { useRouter } from 'next/router';
import { useState } from 'react';

const fontStack =
  "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', sans-serif";

export default function NewDrop() {
  const router = useRouter();
  const { token } = router.query;
  const [saving, setSaving] = useState(false);

  const goToEditor = () => {
    if (saving) return;
    setSaving(true);

    if (token) {
      window.location.href = `/dashboard/${token}`;
    } else {
      window.location.href = `/dashboard`;
    }
  };

  const handleContinue = (e) => {
    e.preventDefault();
    goToEditor();
  };

  const handleSkip = (e) => {
    e.preventDefault();
    goToEditor();
  };

  return (
    <main className="onboarding-root">
      <div className="logo-row">
        <img src="/launch6_white.png" alt="Launch6" className="logo" />
      </div>

      <div className="card">
        <div className="card-inner">
          <p className="step-label">STEP 3 OF 3</p>
          <h1 className="title">Add your drop &amp; email capture</h1>

          <div className="subtitle-block">
            <p className="subtitle-line">
              This is your last onboarding step. We&apos;ll wire in full drop + timer
              controls next.
            </p>
            <p className="subtitle-line">
              For now, hit Continue to jump into your editor and finish setting things up.
            </p>
          </div>

          <form onSubmit={handleContinue} className="form">
            {/* Placeholder body we’ll replace when we design Step 3 */}
            <div className="placeholder-block">
              <p className="placeholder-text">
                Coming soon: quick setup for your first drop, stock, and email capture.
              </p>
            </div>

                        <div className="actions-row content-rail">
              <button
                type="submit"
                className="btn btn-primary btn-full-width"
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Continue'}
              </button>
            </div>

            <p className="footer-note">
              You can always edit links and socials later from your dashboard.
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

        @media (max-width: 600px) {
          .card-inner {
            padding: 28px 18px 24px;
            border-radius: 24px;
          }
        }

        .step-label {
          font-size: 11px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #8b8fa5;
          margin-bottom: 8px;
          margin-top: 0;
        }

        .title {
          font-size: 24px;
          font-weight: 700;
          margin: 0 0 16px;
          text-align: center;
        }

        .subtitle-block {
          text-align: center;
          width: 100%;
          margin-bottom: 22px;
        }

        .subtitle-line {
          font-size: 16px;
          color: #ffffff;
          margin: 0;
          line-height: 1.5;
          font-weight: 400;
        }

        .form {
          width: 100%;
          margin-top: 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .content-rail {
          width: 100%;
          max-width: 100%;
        }

        .placeholder-block {
          width: 100%;
          border-radius: 16px;
          border: 1px dashed rgba(255, 255, 255, 0.16);
          background: #151623;
          padding: 18px 16px;
          text-align: center;
          margin-bottom: 22px;
        }

        .placeholder-text {
          font-size: 13px;
          color: #a1a4c0;
          margin: 0;
        }

        .actions-row {
          margin-top: 10px;
          display: flex;
        }

        .btn {
          flex: 1;
          border-radius: 999px;
          border: none;
          font-family: ${fontStack};
          font-size: 14px;
          font-weight: 500;
          padding: 12px 16px;
          cursor: pointer;
          transition: transform 0.08s ease, box-shadow 0.08s ease,
            background 0.12s ease;
        }

        .btn-primary {
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

        .btn-full-width {
          width: 100%;
        }

        .skip-link-button {
          margin-top: 10px;
          border: none;
          background: transparent;
          color: #8b8fa5;
          font-size: 13px;
          cursor: pointer;
        }

        .skip-link-button:hover {
          text-decoration: underline;
          color: #ffffff;
        }

        .footer-note {
          margin-top: 18px;
          font-size: 12px;
          color: #8b8fa5;
          text-align: center;
          max-width: 100%;
        }
      `}</style>
    </main>
  );
}
