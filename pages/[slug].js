// pages/[slug].js

// ✅ No build-time imports from /lib — prevents “collect page data” crashes

const PLAN_NAMES = {
  FREE: 'Free',
  STARTER: 'Starter',
  STARTER_PLUS: 'Starter+',
  PRO: 'Pro',
  BUSINESS: 'Business',
};

export default function PublicBio({ profile }) {
  if (!profile) {
    return (
      <main className="container">
        <div className="card error">
          <strong>Not found</strong>
          <p>This profile does not exist.</p>
        </div>
      </main>
    );
  }

  const planName =
    PLAN_NAMES[(profile?.plan || 'FREE').toString().toUpperCase()] || 'Free';

  const handleSubmit = async (e) => {
    e.preventDefault();
    const email = e.target.email.value;
    if (!email) return;
    try {
      const res = await fetch('/api/klaviyo-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          listId: profile?.klaviyo?.listId,
          slug: profile.slug,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      alert(profile?.klaviyo?.successMessage || 'Thanks! Please check your inbox.');
      e.target.reset();
    } catch {
      alert('Could not subscribe right now.');
    }
  };

  return (
    <main className="container" style={{ maxWidth: 560 }}>
      <section className="card bio-hero">
        {profile.avatarUrl ? (
          <img className="bio-avatar" src={profile.avatarUrl} alt={profile.name} />
        ) : null}
        <div className="bio-title">{profile.name}</div>
        {profile.description ? <div className="bio-desc">{profile.description}</div> : null}
        <div className="small">Plan: {planName}</div>

        {profile?.klaviyo?.isActive && profile?.klaviyo?.listId ? (
          <form onSubmit={handleSubmit} style={{ marginTop: 18 }}>
            <input
              className="input"
              type="email"
              name="email"
              placeholder={profile?.klaviyo?.placeholder || 'Enter your email'}
              required
            />
            <button className="button cta" type="submit">
              {profile?.klaviyo?.buttonText || 'Join my list'}
            </button>
          </form>
        ) : null}
      </section>

      <section className="bio-links">
        {(profile.links || []).map((item, idx) => (
          <a
            key={idx}
            className="bio-link"
            href={item.url}
            target="_blank"
            rel="noreferrer"
          >
            {item.label}
          </a>
        ))}

        {(profile.products || []).map((item, idx) => (
          <div key={`p-${idx}`} className="card" style={{ background: '#0e0e16' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(item.images || []).map((img, j) => (
                  <img
                    key={j}
                    src={img?.src}
                    alt={item.label || 'product image'}
                    style={{
                      maxWidth: '100%',
                      width: '160px
