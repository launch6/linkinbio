// lib/mongo.js
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;     // e.g. mongodb+srv://...
const dbName = process.env.MONGODB_DB;   // e.g. linkinbio

if (!uri || !dbName) {
  throw new Error("Missing MONGODB_URI or MONGODB_DB in environment.");
}

let client;
let clientPromise;

if (!global._mongoClientPromise) {
  client = new MongoClient(uri, {
    serverApi: { version: "1", strict: false, deprecationErrors: false },
  });
  global._mongoClientPromise = client.connect();
}

clientPromise = global._mongoClientPromise;

export async function getDb() {
  const c = await clientPromise;
  return c.db(dbName);
}
