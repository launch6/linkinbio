import { getDb } from '@/lib/db';
import { PLANS } from '@/lib/plans';

export default function PublicBio({ profile }){
  if(!profile){
    return(<main className="container"><div className="card error"><strong>Not found</strong><p>This profile does not exist.</p></div></main>);
  }
  const handleSubmit=async(e)=>{
    e.preventDefault();
    const email=e.target.email.value;
    if(!email)return;
    try{
      const res=await fetch('/api/klaviyo-capture',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,listId:profile?.klaviyo?.listId,slug:profile.slug})});
      if(!res.ok)throw new Error('Failed');
      alert(profile?.klaviyo?.successMessage||'Thanks! Please check your inbox.');
      e.target.reset();
    }catch{ alert('Could not subscribe right now.'); }
  };
  const planName=PLANS[profile.plan]?.NAME||'Free';

  return(<main className="container" style={{maxWidth:560}}>
    <section className="card bio-hero">
      {profile.avatarUrl ? <img className="bio-avatar" src={profile.avatarUrl} alt={profile.name} /> : null}
      <div className="bio-title">{profile.name}</div>
      {profile.description ? <div className="bio-desc">{profile.description}</div> : null}
      <div className="small">Plan: {planName}</div>
      {profile?.klaviyo?.isActive && profile?.klaviyo?.listId ? (
        <form onSubmit={handleSubmit} style={{marginTop:18}}>
          <input className="input" type="email" name="email" placeholder={profile?.klaviyo?.placeholder||'Enter your email'} required />
          <button className="button cta" type="submit">{profile?.klaviyo?.buttonText||'Join my list'}</button>
        </form>
      ):null}
    </section>
    <section className="bio-links">
      {(profile.links||[]).map((item,idx)=>(<a key={idx} className="bio-link" href={item.url} target="_blank" rel="noreferrer">{item.label}</a>))}
      {(profile.products||[]).map((item,idx)=>(
        <div key={`p-${idx}`} className="card" style={{background:'#0e0e16'}}>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {(item.images||[]).map((img,j)=>(<img key={j} src={img?.src} alt={item.label||'product image'} style={{maxWidth:'100%',width:'160px',height:'160px',objectFit:'cover',borderRadius:12,border:'1px solid #25253a'}}/>))}
            </div>
            <a className="bio-link cta" href={item.url} target="_blank" rel="noreferrer">{item.label} • Buy</a>
          </div>
        </div>
      ))}
    </section>
    <footer style={{marginTop:24,textAlign:'center',color:'#6c6f75'}}><span className="badge">Built with Launch6</span></footer>
  </main>);
}

export async function getServerSideProps(ctx){
  const { slug } = ctx.params;
  const db = await getDb();
  const doc = await db.collection('profiles').findOne({ slug });
  if(!doc) return { props: { profile: null } };
  const { _id, editToken, ...pub } = doc;
  return { props: { profile: JSON.parse(JSON.stringify(pub)) } };
}
