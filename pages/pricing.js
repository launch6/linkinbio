import { useEffect, useState } from 'react';

export default function Pricing(){
  const [code,setCode]=useState('');

  useEffect(()=>{
    const q=new URLSearchParams(location.search);
    if(q.get('code')) setCode(q.get('code'));
  },[]);

  const startCheckout = async (kind) => {
    const q=new URLSearchParams(location.search);
    const ref=q.get('ref');
    const res=await fetch('/api/checkout/create',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ kind, promoCode: code || null, ref })
    });
    const data=await res.json();
    if(!res.ok){ alert(data.error||'Checkout failed'); return; }
    location.href=data.url;
  };

  return(<main className="container">
    <div className="card">
      <h2>Pricing</h2>
      <p className="small">Referral or course code? Enter it before checkout.</p>
      <input className="input" placeholder="Referral / Course Code (optional)"
        value={code} onChange={e=>setCode(e.target.value)} />
      <div className="row">
        <div className="card" style={{flex:'1 1 260px'}}>
          <h3>Free</h3>
          <ul>
            <li>1 product • 3 images</li>
            <li>5 links</li>
            <li>Email capture: ❌</li>
          </ul>
          <a className="button secondary" href="/dashboard/new">Start free</a>
        </div>
        <div className="card" style={{flex:'1 1 260px'}}>
          <h3>Starter</h3>
          <ul>
            <li>3 products • 3 images each</li>
            <li>15 links</li>
            <li>Email capture (Klaviyo)</li>
            <li>Course/referral: 6 months free</li>
          </ul>
          <div className="row">
            <button className="button" onClick={()=>startCheckout('starter_monthly')}>$9 / month</button>
            <button className="button secondary" onClick={()=>startCheckout('starter_lifetime')}>$89 lifetime</button>
          </div>
        </div>
        <div className="card" style={{flex:'1 1 260px'}}>
          <h3>Pro</h3>
          <ul>
            <li>8 products • 5 images each</li>
            <li>Unlimited links</li>
            <li>Connect your own Klaviyo</li>
            <li>Featured product • Themes</li>
          </ul>
          <button className="button" onClick={()=>startCheckout('pro_monthly')}>$19 / month</button>
        </div>
        <div className="card" style={{flex:'1 1 260px'}}>
          <h3>Business</h3>
          <ul>
            <li>20 products • 10 images each</li>
            <li>Unlimited links</li>
            <li>Custom domain • Analytics</li>
            <li>Priority support</li>
          </ul>
          <button className="button" onClick={()=>startCheckout('business_monthly')}>$29 / month</button>
        </div>
      </div>
      <p className="small">Referred by a friend or took the course? Use the code to apply 6 months free on Starter monthly.</p>
    </div>
  </main>);
}
