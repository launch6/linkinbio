// lib/mongodb.js
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

// In Preview/Dev without DB creds, we want API routes to return a clean error
// instead of crashing the entire function at import-time.
const mongoDisabled = !uri;

// We'll keep a single cached connection in dev so Next.js hot reload
// doesn't open a new connection every time.
let cachedClient = null;
let cachedDb = null;

export async function getDb() {
  if (cachedDb) {
    return cachedDb;
  }

  if (mongoDisabled) {
    throw new Error("MongoDB is not configured (missing MONGODB_URI).");
  }

  const client = await MongoClient.connect(uri);
  const db = client.db(); // uses the default DB from your URI

  cachedClient = client;
  cachedDb = db;

  return db;
}
