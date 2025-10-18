import Stripe from 'stripe';
import { getDb } from '@/lib/db';

export const config = { api: { bodyParser: false } };

function rawBody(req){ return new Promise((resolve,reject)=>{ let data=''; req.on('data',c=>data+=c); req.on('end',()=>resolve(Buffer.from(data))); req.on('error',reject); }); }

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).send('Method Not Allowed');

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-06-20' });
  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const buf = await rawBody(req);

  let event;
  try{ event = stripe.webhooks.constructEvent(buf, sig, secret); }
  catch(err){ console.error('Webhook signature verification failed.', err.message); return res.status(400).send(`Webhook Error: ${err.message}`); }

  if(event.type==='checkout.session.completed'){
    const s = event.data.object;
    const plan = s?.metadata?.plan || 'starter';
    const ref = s?.metadata?.ref || '';
    const isMonthly = s.mode === 'subscription';

    try {
      const db = await getDb();
      await db.collection('orders').insertOne({
        type:'checkout.session.completed',
        plan, ref, isMonthly,
        sessionId:s.id,
        customer:s.customer||null,
        email:s.customer_details?.email||null,
        createdAt:new Date()
      });
    } catch(e){ console.error('DB insert error', e); }
  }

  res.json({ received:true });
}
