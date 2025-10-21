// pages/[slug].js
export default function Placeholder() {
  return (
    <main className="container">
      <div className="card error">
        <strong>Temporarily offline</strong>
        <p>This profile page is being updated.</p>
      </div>
    </main>
  );
}

export async function getServerSideProps() {
  // Never throws; always returns a trivial payload.
  return { props: { profile: null } };
}
