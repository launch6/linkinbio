
export default function Home() {
  const username = "artistname"; // temporary placeholder until dynamic user info is added

  return (
    <main className="container">
      <div className="card">
        <h1>Link-in-Bio for Artists</h1>
        <p>
          Sell prints with Stripe, capture emails with Klaviyo, and share all
          your links — no website required.
        </p>

        <div className="row">
          <a className="button" href="/pricing">
            See plans
          </a>
          <a className="button secondary" href="/dashboard/new">
            Create your page
          </a>
        </div>

        <p className="small" style={{ marginTop: 12 }}>
          Public pages live at <strong>l6.io/&lt;your-name&gt;</strong>
        </p>
      </div>
    </main>
  );
}
