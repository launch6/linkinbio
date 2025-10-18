import { getDb } from '@/lib/db';
function genCode(len=8){ const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let out=''; for(let i=0;i<len;i++) out+=chars[Math.floor(Math.random()*chars.length)]; return out; }
export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({ error:'Method not allowed' });
  const { editToken } = req.query; if(!editToken) return res.status(400).json({ error:'Missing editToken' });
  const db=await getDb(); const col=db.collection('profiles'); const doc=await col.findOne({ editToken });
  if(!doc) return res.status(404).json({ error:'Not found' });
  if(doc.refCode) return res.json({ refCode: doc.refCode });
  let tries=0, code=''; do{ code=genCode(8); const exists=await col.findOne({ refCode: code }); if(!exists) break; tries++; } while(tries<5);
  if(!code) return res.status(500).json({ error:'Could not generate code' });
  await col.updateOne({ _id: doc._id }, { $set: { refCode: code } });
  return res.json({ refCode: code });
}
