// pages/dashboard/index.js
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

const fontStack =
  "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', sans-serif";

export default function DashboardHome() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState(null);

  // Load profile by editToken when arriving from onboarding (Step 4)
  useEffect(() => {
    if (!router.isReady) return;

    const rawToken = router.query.editToken;
    const editToken =
      typeof rawToken === 'string' && rawToken.trim().length > 0
        ? rawToken.trim()
        : '';

    // If we somehow land on /dashboard without a token,
    // fall back to a soft message instead of a hard error.
    if (!editToken) {
      setLoading(false);
      setError(
        'Missing edit token. Try starting from onboarding or contact support.'
      );
      return;
    }

    (async () => {
      try {
        const resp = await fetch(
          `/api/profile/get?editToken=${encodeURIComponent(editToken)}`
        );

        const json = await resp.json().catch(() => ({}));

        if (!resp.ok || !json?.ok) {
          // Special case: profile_not_found → set blank profile instead of blocking
          if (json?.error === 'profile_not_found') {
            setProfile({
              name: '',
              displayName: '',
              slug: '',
              bio: '',
              description: '',
              links: [],
              social: {},
            });
            setError('');
            setLoading(false);
            return;
          }

          setError(json?.error || 'Can’t open editor');
          setLoading(false);
          return;
        }

        setProfile(json.profile || null);
        setError('');
        setLoading(false);
      } catch (err) {
        console.error('Failed to load editor profile', err);
        setError('Can’t open editor');
        setLoading(false);
      }
    })();
  }, [router.isReady, router.query.editToken]);

  const handleGoToOnboarding = () => {
    router.push('/dashboard/new');
  };

  const handleViewPublic = () => {
    if (!profile?.slug) return;
    window.location.href = `/${encodeURIComponent(profile.slug)}`;
  };

  const handleGoHome = () => {
    router.push('/');
  };

  const displayName =
    profile?.displayName?.trim() ||
    profile?.name?.trim() ||
    'Your Launch6 page';

  const slug = profile?.slug?.trim() || '';
const publicUrl = slug ? `https://www.l6.io/${slug}` : '';

  // --- Render ----------------------------------------------------------------

  if (loading) {
    return (
      <div className="full-screen bg">
        <div className="card loading-card">
          <p className="loading-text">Loading your editor…</p>
        </div>

        <style jsx>{`
          .full-screen {
            min-height: 100vh;
            background-color: #121219;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            font-family: ${fontStack};
            color: #ffffff;
          }

          .bg {
            background: radial-gradient(circle at top, #181826 0%, #02010a 55%);
          }

          .card {
            max-width: 520px;
            width: 100%;
            border-radius: 28px;
            border: 1px solid rgba(255, 255, 255, 0.12);
            background: rgba(9, 9, 18, 0.98);
            box-shadow: 0 24px 80px rgba(0, 0, 0, 0.75);
            padding: 24px 28px;
          }

          .loading-card {
            text-align: center;
          }

          .loading-text {
            margin: 0;
            font-size: 14px;
            opacity: 0.8;
          }
        `}</style>
      </div>
    );
  }

  return (
    <main className="shell">
      <div className="logo-row">
        <img
          src="/launch6_white.png"
          alt="Launch6"
          className="logo"
        />
      </div>

      <div className="card">
        <header className="card-header">
          <p className="eyebrow">Dashboard</p>
          <h1 className="title">{displayName}</h1>
          {slug ? (
            <p className="subtitle">
              Your public page is live at{' '}
              <a
                href={`/${encodeURIComponent(slug)}`}
                className="link-inline"
                target="_blank"
                rel="noopener noreferrer"
              >
                l6.io/{slug}
              </a>
              .
            </p>
          ) : (
            <p className="subtitle">
              Finish setting up your profile and drop so collectors can start
              buying.
            </p>
          )}
        </header>

        {error && (
          <div className="error-box">
            <p className="error-title">Can’t open editor</p>
            <p className="error-body">{error}</p>
          </div>
        )}

        <section className="grid">
          <div className="panel primary-panel">
            <h2 className="panel-title">Edit your profile & links</h2>
            <p className="panel-text">
              Update your photo, bio, and buttons anytime from your dashboard.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleGoToOnboarding}
            >
              Open editor
            </button>
          </div>

          <div className="panel">
            <h2 className="panel-title">View your public page</h2>
            <p className="panel-text">
              See your page the way your collectors see it and share that URL
              in your bio.
            </p>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={slug ? handleViewPublic : handleGoHome}
              disabled={!slug}
            >
              {slug ? 'View l6.io/' + slug : 'Back to homepage'}
            </button>
            {publicUrl && (
              <p className="panel-url">
                <span>Public URL:</span> {publicUrl}
              </p>
            )}
          </div>
        </section>
      </div>

      <style jsx>{`
        :global(html),
        :global(body) {
          margin: 0;
          padding: 0;
        }

        .shell {
          min-height: 100vh;
          background: radial-gradient(circle at top, #181826 0%, #02010a 55%);
          color: #ffffff;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 18px 16px 40px;
          font-family: ${fontStack};
        }

        .logo-row {
          margin-bottom: 14px;
        }

        .logo {
          height: 44px;
          width: auto;
        }

        .card {
          width: 100%;
          max-width: 720px;
          background: rgba(9, 9, 18, 0.97);
          border-radius: 32px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          box-shadow: 0 22px 70px rgba(0, 0, 0, 0.75);
          padding: 26px 26px 28px;
        }

        .card-header {
          text-align: left;
          margin-bottom: 20px;
        }

        .eyebrow {
          font-size: 11px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #9ca3c0;
          margin: 0 0 4px;
        }

        .title {
          font-size: 24px;
          font-weight: 700;
          margin: 0 0 6px;
        }

        .subtitle {
          margin: 0;
          font-size: 14px;
          color: #a1a4c0;
        }

        .link-inline {
          color: #c4c6ff;
          text-decoration: underline;
        }

        .error-box {
          border-radius: 14px;
          border: 1px solid rgba(248, 113, 113, 0.6);
          background: rgba(127, 29, 29, 0.4);
          padding: 10px 12px;
          margin-bottom: 16px;
        }

        .error-title {
          margin: 0 0 4px;
          font-size: 13px;
          font-weight: 600;
        }

        .error-body {
          margin: 0;
          font-size: 12px;
          opacity: 0.9;
        }

        .grid {
          display: grid;
          grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
          gap: 14px;
        }

        @media (max-width: 720px) {
          .grid {
            grid-template-columns: minmax(0, 1fr);
          }
        }

        .panel {
          background: #181a26;
          border-radius: 18px;
          border: 1px solid #272a3e;
          padding: 14px 16px 16px;
        }

        .primary-panel {
          background: radial-gradient(circle at top left, #312e81 0%, #020617 60%);
          border-color: #4f46e5;
        }

        .panel-title {
          margin: 0 0 6px;
          font-size: 14px;
          font-weight: 600;
        }

        .panel-text {
          margin: 0 0 12px;
          font-size: 13px;
          color: #d1d5db;
        }

        .panel-url {
          margin: 8px 0 0;
          font-size: 11px;
          color: #9ca3c0;
          word-break: break-all;
        }

        .panel-url span {
          font-weight: 500;
          margin-right: 4px;
        }

        .btn {
          border-radius: 999px;
          border: none;
          font-family: ${fontStack};
          font-size: 14px;
          font-weight: 500;
          padding: 10px 14px;
          cursor: pointer;
          transition: transform 0.08s ease, box-shadow 0.08s ease,
            background 0.12s ease, opacity 0.12s ease;
        }

        .btn-primary {
          background: linear-gradient(90deg, #6366ff, #a855f7);
          color: #ffffff;
          box-shadow: 0 10px 26px rgba(88, 92, 255, 0.6);
        }

        .btn-primary:active {
          transform: translateY(1px);
          box-shadow: 0 4px 16px rgba(88, 92, 255, 0.45);
        }

        .btn-ghost {
          background: transparent;
          color: #e5e7eb;
          border: 1px solid #3f3f46;
        }

        .btn-ghost:disabled {
          opacity: 0.5;
          cursor: default;
        }

        .btn-ghost:not(:disabled):active {
          transform: translateY(1px);
        }
      `}</style>
    </main>
  );
}
