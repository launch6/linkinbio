import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { PLANS, DEFAULT_PLAN } from '@/lib/plans';
import { isAllowedImageUrl } from '@/lib/limits';

function getPlanLimits(p){ const key=(p?.plan)||DEFAULT_PLAN; return PLANS[key]||PLANS[DEFAULT_PLAN]; }

function validateProfilePayload(p){
  if(!p) return 'Empty payload';
  if(!p.slug || !/^[a-z0-9-]{3,40}$/.test(p.slug)) return 'Invalid slug';
  const L=getPlanLimits(p);
  const links=Array.isArray(p.links)?p.links:[];
  if(links.length> L.MAX_LINKS) return `Too many links (max ${L.MAX_LINKS}).`;
  const prods=Array.isArray(p.products)?p.products:[];
  if(prods.length> L.MAX_PRODUCTS) return `Too many products (max ${L.MAX_PRODUCTS}).`;
  for(let i=0;i<prods.length;i++){
    const prod=prods[i]||{}; const imgs=Array.isArray(prod.images)?prod.images:[];
    if(imgs.length> L.MAX_IMAGES) return `Product #${i+1} has too many images (max ${L.MAX_IMAGES}).`;
    for(let j=0;j<imgs.length;j++){
      const src=(imgs[j]&&imgs[j].src)||''; if(!src) return `Product #${i+1} image #${j+1} is missing a URL.`;
      if(!isAllowedImageUrl(src)) return `Product #${i+1} image #${j+1} must be JPG/PNG/WebP.`;
    }
  }
  if(p?.klaviyo?.isActive && !L.EMAIL_CAPTURE) return 'Email capture is not available on your current plan.';
  return null;
}

export default async function handler(req,res){
  const db=await getDb(); const col=db.collection('profiles');

  if(req.method==='GET'){
    const { slug, editToken } = req.query;
    if(slug||editToken){
      const query = slug ? { slug } : { editToken };
      let doc = await col.findOne(query);
      if(!doc) return res.status(404).json({ error: 'Not found' });

      // Auto-expiry
      if(doc.planExpiresAt && new Date(doc.planExpiresAt) < new Date()){
        if(doc.plan === 'starter_plus'){ await col.updateOne({_id:doc._id},{$set:{plan:'starter',planExpiresAt:null}}); doc.plan='starter'; doc.planExpiresAt=null; }
        else if(doc.plan === 'starter'){ await col.updateOne({_id:doc._id},{$set:{plan:'free',planExpiresAt:null}}); doc.plan='free'; doc.planExpiresAt=null; }
      }

      if(slug){ const { _id, editToken:secret, ...pub } = doc; return res.json({ profile: pub }); }
      else return res.json({ profile: doc });
    }
    return res.status(400).json({ error: 'Provide slug or editToken' });
  }

  if(req.method==='POST'){
    const { editToken } = req.query;
    if(editToken){
      const payload=req.body||{}; delete payload._id; delete payload.editToken;
      const vErr=validateProfilePayload(payload); if(vErr) return res.status(400).json({ error: vErr });
      payload.updatedAt=new Date();
      const result=await col.findOneAndUpdate({editToken},{ $set: payload },{returnDocument:'after'});
      if(!result.value) return res.status(404).json({ error:'Not found' });
      return res.json({ ok:true });
    }else{
      const { name, slug, description='', avatarUrl='' } = req.body||{};
      if(!name || !slug || !/^[a-z0-9-]{3,40}$/.test(slug)) return res.status(400).json({ error:'Missing name or invalid slug' });
      const exists=await col.findOne({ slug }); if(exists) return res.status(409).json({ error:'Slug already in use' });
      const editTokenNew = uuidv4();
      const doc = {
        name, slug, description, avatarUrl,
        plan:'free', planExpiresAt:null,
        links:[], products:[], refCode:null,
        klaviyo:{ isActive:false, listId:'', buttonText:'Join my list', successMessage:'Thanks for subscribing!' },
        editToken:editTokenNew, createdAt:new Date(), updatedAt:new Date()
      };
      await col.insertOne(doc);
      return res.status(201).json({ ok:true, editToken:editTokenNew, slug });
    }
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
