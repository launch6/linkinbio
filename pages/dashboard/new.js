export default function NewProfile(){
  const handleCreate=async(e)=>{
    e.preventDefault();
    const form=new FormData(e.currentTarget);
    const name=form.get('name'); const slug=form.get('slug');
    const description=form.get('description')||''; const avatarUrl=form.get('avatarUrl')||'';
    const res=await fetch('/api/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,slug,description,avatarUrl})});
    const data=await res.json();
    if(!res.ok){ alert(data.error||'Failed to create profile'); return; }
    location.href=`/dashboard/${data.editToken}`;
  };
  return(<main className="container"><div className="card">
    <h2>Create your profile</h2>
    <form onSubmit={handleCreate}>
      <input className="input" name="name" placeholder="Your display name" required />
      <input className="input" name="slug" placeholder="Custom URL slug (e.g., anna-art)" pattern="^[a-z0-9-]{3,40}$" title="Lowercase letters, numbers, hyphen" required />
      <input className="input" name="avatarUrl" placeholder="Avatar Image URL (optional)" />
      <textarea className="textarea" name="description" placeholder="Short bio (optional)"></textarea>
      <button className="button" type="submit">Create profile</button>
    </form>
  </div></main>);
}
