export default function Home() {
  return (
    <main className="page">
      <section className="hero">
        <div className="hero-inner">
          <div className="eyebrow">Launch6</div>

          <h1 className="headline">
            Link-in-bio for artists who want to sell, not patch together tools.
          </h1>

          <p className="subhead">
            Build your page, drop products, connect Stripe, collect emails, and
            launch fast from one clean setup.
          </p>

          <div className="cta-row">
            <a className="btn btn-primary" href="/pricing">
              See plans
            </a>
            <a className="btn btn-secondary" href="/dashboard/new">
              Create your page
            </a>
          </div>

          <div className="hero-note">
            Public pages live at <strong>l6.io/your-name</strong>
          </div>
        </div>
      </section>

      <section className="proof">
        <div className="proof-grid">
          <div className="proof-card">
            <h2>Sell your drops</h2>
            <p>
              Connect Stripe, add a product, set quantity, and launch limited
              releases without building a full ecommerce store.
            </p>
          </div>

          <div className="proof-card">
            <h2>Grow your audience</h2>
            <p>
              Add your links, socials, and email capture so every visit can turn
              into a follower, subscriber, or buyer.
            </p>
          </div>

          <div className="proof-card">
            <h2>Launch fast</h2>
            <p>
              Get a clean creator page up quickly, without fighting themes,
              plugins, or bloated site builders.
            </p>
          </div>
        </div>
      </section>

      <section className="feature-band">
        <div className="feature-band-inner">
          <div className="feature-copy">
            <div className="section-label">Why Launch6</div>
            <h3>Built for creators with something to sell.</h3>
            <p>
              Most link-in-bio tools stop at links. Launch6 is built around
              links, products, drops, and audience growth in one flow.
            </p>
          </div>

          <div className="feature-list">
            <div className="feature-item">Stripe-powered product drops</div>
            <div className="feature-item">Simple creator pages</div>
            <div className="feature-item">Email capture on paid plans</div>
            <div className="feature-item">Fast onboarding and launch flow</div>
          </div>
        </div>
      </section>

      <section className="bottom-cta">
        <div className="bottom-cta-card">
          <div className="section-label">Ready to launch?</div>
          <h3>Start free, then upgrade when you need more firepower.</h3>
          <p>
            Build your page, test the flow, and move up when you want more
            products and growth tools.
          </p>

          <div className="cta-row center">
            <a className="btn btn-primary" href="/pricing">
              Get started
            </a>
          </div>
        </div>
      </section>

      <style jsx>{`
        :global(html),
        :global(body) {
          margin: 0;
          padding: 0;
          background: #0b0d14;
          color: #ffffff;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text",
            "Inter", sans-serif;
        }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top, rgba(99, 102, 255, 0.18), transparent 30%),
            linear-gradient(180deg, #0b0d14 0%, #121622 100%);
        }

        .hero {
          padding: 72px 20px 44px;
        }

        .hero-inner {
          max-width: 980px;
          margin: 0 auto;
          text-align: center;
        }

        .eyebrow {
          display: inline-block;
          font-size: 12px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #a5b4fc;
          border: 1px solid rgba(165, 180, 252, 0.25);
          padding: 8px 12px;
          border-radius: 999px;
          margin-bottom: 22px;
          background: rgba(255, 255, 255, 0.03);
        }

        .headline {
          font-size: clamp(38px, 6vw, 72px);
          line-height: 0.98;
          letter-spacing: -0.04em;
          margin: 0 auto 18px;
          max-width: 900px;
        }

        .subhead {
          max-width: 760px;
          margin: 0 auto;
          font-size: 20px;
          line-height: 1.5;
          color: #b7bfd3;
        }

        .cta-row {
          display: flex;
          gap: 14px;
          justify-content: center;
          flex-wrap: wrap;
          margin-top: 30px;
        }

        .cta-row.center {
          justify-content: center;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          border-radius: 999px;
          padding: 14px 22px;
          font-size: 15px;
          font-weight: 600;
          transition: transform 0.08s ease, opacity 0.12s ease;
        }

        .btn:hover {
          transform: translateY(-1px);
        }

        .btn-primary {
          background: linear-gradient(90deg, #6366ff, #a855f7);
          color: #fff;
          box-shadow: 0 14px 40px rgba(99, 102, 255, 0.28);
        }

        .btn-secondary {
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.16);
          background: rgba(255, 255, 255, 0.04);
        }

        .hero-note {
          margin-top: 18px;
          color: #8e97ae;
          font-size: 14px;
        }

        .proof {
          padding: 18px 20px 34px;
        }

        .proof-grid {
          max-width: 1100px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
        }

        .proof-card {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          padding: 24px;
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.22);
        }

        .proof-card h2 {
          margin: 0 0 10px;
          font-size: 22px;
        }

        .proof-card p {
          margin: 0;
          color: #aeb6ca;
          line-height: 1.6;
          font-size: 15px;
        }

        .feature-band {
          padding: 20px 20px 42px;
        }

        .feature-band-inner {
          max-width: 1100px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 22px;
          align-items: stretch;
        }

        .feature-copy,
        .feature-list {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 28px;
          padding: 28px;
        }

        .section-label {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          color: #8ea2ff;
          margin-bottom: 12px;
        }

        .feature-copy h3,
        .bottom-cta-card h3 {
          margin: 0 0 12px;
          font-size: 34px;
          line-height: 1.05;
          letter-spacing: -0.03em;
        }

        .feature-copy p,
        .bottom-cta-card p {
          margin: 0;
          color: #aeb6ca;
          line-height: 1.7;
          font-size: 16px;
        }

        .feature-list {
          display: grid;
          gap: 12px;
        }

        .feature-item {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 18px;
          padding: 16px 18px;
          color: #eef2ff;
          font-size: 15px;
          font-weight: 500;
        }

        .bottom-cta {
          padding: 8px 20px 72px;
        }

        .bottom-cta-card {
          max-width: 880px;
          margin: 0 auto;
          text-align: center;
          background: linear-gradient(
            180deg,
            rgba(99, 102, 255, 0.12),
            rgba(168, 85, 247, 0.08)
          );
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 30px;
          padding: 34px 24px;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.24);
        }

        @media (max-width: 900px) {
          .proof-grid,
          .feature-band-inner {
            grid-template-columns: 1fr;
          }

          .hero {
            padding-top: 56px;
          }

          .subhead {
            font-size: 18px;
          }

          .feature-copy h3,
          .bottom-cta-card h3 {
            font-size: 28px;
          }
        }
      `}</style>
    </main>
  );
}