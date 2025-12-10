// pages/dashboard/index.js
import Link from 'next/link';

const fontStack =
  "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', sans-serif";

export default function DashboardHome() {
  return (
    <main className="dashboard-root">
      <div className="card">
        <div className="card-inner">
          <p className="step-label">ONBOARDING COMPLETE</p>
          <h1 className="title">You’re live on Launch6 🎉</h1>

          <p className="subtitle">
            Your profile and first drop are set up. Next you’ll tweak your page
            and share your link with collectors.
          </p>

          <div className="section">
            <h2 className="section-title">Where to go next</h2>
            <ul className="list">
              <li>
                Open your public page at{' '}
                <span className="mono">
                  https://your-domain.com/<strong>your-username</strong>
                </span>{' '}
                (replace with your actual slug, like{' '}
                <span className="mono">/backyards</span>).
              </li>
              <li>
                Edit links, socials, and drops from the dashboard navigation
                (coming soon).
              </li>
            </ul>
          </div>

          <div className="actions-row">
            <Link href="/" className="btn btn-ghost">
              Back to home
            </Link>
            <a
              href="/dashboard/new-links"
              className="btn btn-primary"
            >
              Edit links & socials
            </a>
          </div>

          <p className="footer-note">
            Later we’ll personalize this dashboard with your stats and quick
            actions.
          </p>
        </div>
      </div>

      <style jsx>{`
        :global(html),
        :global(body) {
          background-color: #121219;
          margin: 0;
          padding: 0;
        }

        .dashboard-root {
          min-height: 100vh;
          background: radial-gradient(circle at top, #1d1530 0, #090814 40%, #050509 100%);
          color: #ffffff;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 20px 16px 40px;
          font-family: ${fontStack};
        }

        .card {
          width: 100%;
          display: flex;
          justify-content: center;
        }

        .card-inner {
          width: 100%;
          max-width: 640px;
          background: rgba(9, 9, 18, 0.97);
          border-radius: 32px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          box-shadow: 0 18px 60px rgba(0, 0, 0, 0.6);
          padding: 32px 32px 28px;
        }

        .step-label {
          font-size: 11px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #8b8fa5;
          margin: 0 0 8px;
        }

        .title {
          font-size: 26px;
          font-weight: 700;
          margin: 0 0 10px;
        }

        .subtitle {
          font-size: 14px;
          color: #9ca3c0;
          margin: 0 0 24px;
          line-height: 1.5;
        }

        .section {
          margin-bottom: 24px;
        }

        .section-title {
          font-size: 15px;
          font-weight: 600;
          margin: 0 0 8px;
        }

        .list {
          margin: 0;
          padding-left: 18px;
          font-size: 13px;
          color: #cbd0ff;
          line-height: 1.6;
        }

        .mono {
          font-family: 'SF Mono', ui-monospace, Menlo, Monaco, Consolas,
            'Liberation Mono', 'Courier New', monospace;
          background: rgba(255, 255, 255, 0.04);
          padding: 1px 6px;
          border-radius: 999px;
        }

        .actions-row {
          margin-top: 20px;
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .btn {
          border-radius: 999px;
          border: none;
          font-family: ${fontStack};
          font-size: 14px;
          font-weight: 500;
          padding: 12px 18px;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.08s ease, box-shadow 0.08s ease,
            background 0.12s ease, opacity 0.12s ease;
        }

        .btn-primary {
          background: linear-gradient(90deg, #6366ff, #a855f7);
          color: #ffffff;
          box-shadow: 0 10px 28px rgba(88, 92, 255, 0.55);
        }

        .btn-primary:active {
          transform: translateY(1px);
          box-shadow: 0 4px 14px rgba(88, 92, 255, 0.4);
        }

        .btn-ghost {
          background: transparent;
          color: #e5e7eb;
          border: 1px solid #3f4257;
        }

        .footer-note {
          margin-top: 16px;
          font-size: 11px;
          color: #9ca3c0;
        }

        @media (max-width: 600px) {
          .card-inner {
            padding: 28px 18px 24px;
          }

          .actions-row {
            flex-direction: column;
          }

          .btn {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
