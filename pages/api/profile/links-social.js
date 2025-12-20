// pages/api/profile/links-social.js
import { MongoClient } from 'mongodb';

const { MONGODB_URI, MONGODB_DB = 'linkinbio' } = process.env;

// --- DB bootstrap with global cache ---
let _client = global._launch6MongoClient;
async function getClient() {
  if (_client) return _client;
  if (!MONGODB_URI) throw new Error('Missing MONGODB_URI');
  const c = new MongoClient(MONGODB_URI);
  await c.connect();
  _client = c;
  global._launch6MongoClient = c;
  return c;
}

function noStore(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
}

function send(res, status, body) {
  noStore(res);
  return res.status(status).json(body);
}

// small helper to normalize URLs (prefix https:// if missing)
function normalizeLinkUrl(value) {
  let url = (value || '').trim();
  if (!url) return '';

  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url;
}

// POST /api/profile/links-social
// Body: { editToken, links, social }
export default async function handler(req, res) {
  noStore(res);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const { editToken, links, social, theme } = req.body || {};

  const token = String(editToken || '').trim();
  if (!token) {
    return send(res, 400, { ok: false, error: 'missing_edit_token' });
  }

  // Normalize links: keep only rows with URL; trim label; normalize URL
  const safeLinks = Array.isArray(links)
    ? links
        .map((l) => {
          const label = (l?.label || '').trim();
          const rawUrl = (l?.url || '').trim();
          if (!rawUrl) return null;

          const url = normalizeLinkUrl(rawUrl);
          return { label, url };
        })
        .filter(Boolean)
    : [];

  // Normalize socials: only keep known keys, trim strings
  const allowedSocialKeys = [
    'instagram',
    'facebook',
    'tiktok',
    'youtube',
    'x',
    'website',
  ];

  const safeSocial = {};
  if (social && typeof social === 'object') {
    for (const key of allowedSocialKeys) {
      const raw = social[key];
      if (typeof raw === 'string' && raw.trim()) {
        safeSocial[key] = raw.trim();
      }
    }
  }

  try {
    const client = await getClient();
    const db = client.db(MONGODB_DB);
    const Profiles = db.collection('profiles');

// Theme allowlist (prevents arbitrary CSS / junk data)
const allowedThemes = new Set(['launch6', 'pastel', 'modern']);
const safeTheme = typeof theme === 'string' ? theme.trim().toLowerCase() : '';
const themeUpdate = allowedThemes.has(safeTheme) ? { theme: safeTheme } : {};

const result = await Profiles.updateOne(
  { editToken: token },
  {
    $set: {
      links: safeLinks,
      social: safeSocial,
      ...themeUpdate,
      updatedAt: new Date(),
    },
  }
);


    if (!result.matchedCount) {
      return send(res, 404, { ok: false, error: 'profile_not_found' });
    }

    return send(res, 200, { ok: true });
  } catch (err) {
    console.error('profile:links-social ERROR', err?.message || err);
    return send(res, 500, { ok: false, error: 'server_error' });
  }
}
