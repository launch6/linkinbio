// lib/mongodb.js
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error(
    "Please define the MONGODB_URI environment variable in .env.local"
  );
}

// We'll keep a single cached connection in dev so Next.js hot reload
// doesn't open a new connection every time.
let cachedClient = null;
let cachedDb = null;

export async function getDb() {
  if (cachedDb) {
    return cachedDb;
  }

  const client = await MongoClient.connect(uri);
  const db = client.db(); // uses the default DB from your URI

  cachedClient = client;
  cachedDb = db;

  return db;
}
