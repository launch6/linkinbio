import { useEffect, useState } from 'react';
import { PLANS, DEFAULT_PLAN } from '@/lib/plans';

export default function Dashboard(){
  const [state,setState]=useState({loading:true,profile:null,error:null});
  const [saving,setSaving]=useState(false);
  const [refLink,setRefLink]=useState('');

  useEffect(()=>{
    const token=window.location.pathname.split('/').pop();
    (async()=>{
      const res=await fetch('/api/profile?editToken='+token); const data=await res.json();
      if(!res.ok) setState({loading:false,profile:null,error:data.error||'Not found'});
      else setState({loading:false,profile:data.profile,error:null});
    })();
  },[]);

  if(state.loading) return <main className="container"><div className="card"><p>Loading…</p></div></main>;
  if(state.error) return <main className="container"><div className="card error">{state.error}</div></main>;

  const profile=state.profile;
  const planKey=profile.plan||DEFAULT_PLAN;
  const L=PLANS[planKey];

  const updateField=(path,value)=>{
    setState(s=>{ const next={...s.profile}; const keys=path.split('.'); let ref=next;
      for(let i=0;i<keys.length-1;i++) ref = ref[keys[i]] = ref[keys[i]] ?? {};
      ref[keys[keys.length-1]] = value; return {...s,profile:next}; });
  };

  const addLink=()=>{
    const curr=(profile.links||[]);
    if(curr.length>=L.MAX_LINKS){ alert(`Max ${L.MAX_LINKS} links on ${planKey} plan.`); return; }
    updateField('links',[...curr,{label:'New Link',url:'https://'}]);
  };

  const addProduct=()=>{
    const curr=(profile.products||[]);
    if(curr.length>=L.MAX_PRODUCTS){ alert(`Max ${L.MAX_PRODUCTS} products on ${planKey} plan.`); return; }
    updateField('products',[...curr,{label:'New Product',url:'https://',images:[]}]);
  };

  const removeAt=(key,idx)=>updateField(key,(profile[key]||[]).filter((_,i)=>i!==idx));

  const save=async()=>{
    setSaving(true);
    const token=window.location.pathname.split('/').pop();
    const res=await fetch('/api/profile?editToken='+token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(profile)});
    const data=await res.json(); setSaving(false);
    if(!res.ok) alert(data.error||'Failed to save'); else alert('Saved! Public page: /'+profile.slug);
  };

  const genReferral=async()=>{
    const token=window.location.pathname.split('/').pop();
    const res=await fetch('/api/ref/generate?editToken='+token,{method:'POST'});
    const data=await res.json(); if(!res.ok){ alert(data.error||'Could not create referral link'); return; }
    setRefLink(`${location.origin}/ref/${data.refCode}`);
  };

  return(<main className="container"><div className="card">
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <h2>Link‑in‑Bio Editor</h2>
      <a className="badge" href={'/'+profile.slug} target="_blank" rel="noreferrer">View public page</a>
    </div>

    <div className="alert">Current Plan: <strong>{PLANS[planKey].NAME}</strong>{profile.planExpiresAt?` • Expires: ${new Date(profile.planExpiresAt).toLocaleDateString()}`:''}</div>

    <div className="row">
      <div style={{flex:'1 1 320px'}}>
        <label>Name</label>
        <input className="input" value={profile.name||''} onChange={e=>updateField('name',e.target.value)} />
        <label>Slug (URL)</label>
        <input className="input" value={profile.slug||''} pattern="^[a-z0-9-]{3,40}$" onChange={e=>updateField('slug',e.target.value)} />
        <label>Avatar URL</label>
        <input className="input" value={profile.avatarUrl||''} onChange={e=>updateField('avatarUrl',e.target.value)} />
        <label>Description</label>
        <textarea className="textarea" value={profile.description||''} onChange={e=>updateField('description',e.target.value)} />
      </div>
      <div style={{flex:'1 1 320px'}}>
        <div className="card" style={{background:'#0e0e16'}}>
          <strong>Klaviyo</strong>
          <p className="badge">Email capture</p>
          <label>Enabled</label>
          <select className="select" value={profile?.klaviyo?.isActive?'yes':'no'} onChange={e=>{
            if(!L.EMAIL_CAPTURE && e.target.value==='yes'){ alert('Email capture is available on Starter and above.'); return; }
            updateField('klaviyo.isActive', e.target.value==='yes');
          }}>
            <option value="yes">Yes</option><option value="no">No</option>
          </select>
          <label>List ID</label>
          <input className="input" value={profile?.klaviyo?.listId||''} onChange={e=>updateField('klaviyo.listId',e.target.value)} />
          <label>Button Text</label>
          <input className="input" value={profile?.klaviyo?.buttonText||''} onChange={e=>updateField('klaviyo.buttonText',e.target.value)} />
          <label>Success Message</label>
          <input className="input" value={profile?.klaviyo?.successMessage||''} onChange={e=>updateField('klaviyo.successMessage',e.target.value)} />
        </div>
      </div>
    </div>

    <hr/>
    <h3>Links ({(profile.links||[]).length}/{L.MAX_LINKS})</h3>
    <div className="row">
      {(profile.links||[]).map((item,idx)=>(
        <div key={idx} className="linkItem" style={{flex:'1 1 360px'}}>
          <div style={{flex:1}}>
            <input className="input" value={item.label||''} onChange={e=>{const arr=[...(profile.links||[])]; arr[idx]={...item,label:e.target.value}; updateField('links',arr);}} />
            <input className="input" value={item.url||''} onChange={e=>{const arr=[...(profile.links||[])]; arr[idx]={...item,url:e.target.value}; updateField('links',arr);}} />
          </div>
          <button className="button secondary" onClick={()=>{const arr=[...(profile.links||[])].filter((_,i)=>i!==idx); updateField('links',arr);}}>Remove</button>
        </div>
      ))}
    </div>
    <button className="button" onClick={addLink} disabled={(profile.links||[]).length>=L.MAX_LINKS}>+ Add Link</button>

    <hr/>
    <h3>Products ({(profile.products||[]).length}/{L.MAX_PRODUCTS})</h3>
    <p className="small">Each product can include up to {L.MAX_IMAGES} images.</p>
    <div className="row">
      {(profile.products||[]).map((item,idx)=>(
        <div key={idx} className="linkItem" style={{flex:'1 1 360px',alignItems:'stretch',gap:12}}>
          <div style={{flex:1}}>
            <label>Product Label</label>
            <input className="input" value={item.label||''} onChange={e=>{const arr=[...(profile.products||[])]; arr[idx]={...item,label:e.target.value}; updateField('products',arr);}} />
            <label>Stripe Checkout Link</label>
            <input className="input" value={item.url||''} onChange={e=>{const arr=[...(profile.products||[])]; arr[idx]={...item,url:e.target.value}; updateField('products',arr);}} />
            <label>Images (URLs)</label>
            <div>
              {((item.images)||[]).map((img,j)=>(
                <div key={j} style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}>
                  <input className="input" placeholder="https://example.com/art.webp" value={img?.src||''}
                    onChange={e=>{const arr=[...(profile.products||[])]; const imgs=[...((arr[idx].images)||[])]; imgs[j]={src:e.target.value}; arr[idx]={...arr[idx],images:imgs}; updateField('products',arr);}} />
                  <button className="button secondary" type="button" onClick={()=>{
                    const arr=[...(profile.products||[])]; const imgs=[...((arr[idx].images)||[])].filter((_,k)=>k!==j);
                    arr[idx]={...arr[idx],images:imgs}; updateField('products',arr);
                  }}>Remove</button>
                </div>
              ))}
              <button className="button" type="button" disabled={((item.images||[]).length)>=L.MAX_IMAGES} onClick={()=>{
                const arr=[...(profile.products||[])]; const imgs=[...((arr[idx].images)||[])];
                if(imgs.length<L.MAX_IMAGES){ imgs.push({src:''}); arr[idx]={...arr[idx],images:imgs}; updateField('products',arr); }
              }}>+ Add Image URL</button>
            </div>
          </div>
          <button className="button secondary" onClick={()=>removeAt('products',idx)}>Remove Product</button>
        </div>
      ))}
    </div>
    <button className="button" onClick={addProduct} disabled={(profile.products||[]).length>=L.MAX_PRODUCTS}>+ Add Product</button>

    <hr/>
    <div className="row">
      <button className="button" onClick={save} disabled={saving}>{saving?'Saving…':'Save changes'}</button>
      <a className="button secondary" href={'/'+profile.slug} target="_blank" rel="noreferrer">View public page</a>
    </div>

    <hr/>
    <h3>Referral</h3>
    <p className="small">Share your referral link so other artists get the same 6‑month deal on Starter monthly.</p>
    <div className="row">
      <button className="button" onClick={genReferral}>Generate referral link</button>
      {refLink && <input className="input" readOnly value={refLink} />}
    </div>
  </div></main>);
}
