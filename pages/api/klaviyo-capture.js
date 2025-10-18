export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const { email, listId } = req.body||{};
  if(!email||!listId) return res.status(400).json({ error:'Missing email or listId' });
  const apiKey=process.env.KLAVIYO_PRIVATE_API_KEY;
  if(!apiKey) return res.status(500).json({ error:'Server missing Klaviyo key' });
  try{
    const endpoint=`https://a.klaviyo.com/api/v2/list/${encodeURIComponent(listId)}/subscribe?api_key=${encodeURIComponent(apiKey)}`;
    const payload={ profiles:[{ email }] };
    const resp=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if(!resp.ok){ const txt=await resp.text(); return res.status(400).json({ error:'Klaviyo error', details:txt }); }
    return res.json({ ok:true });
  }catch{ return res.status(500).json({ error:'Failed to subscribe' }); }
}
