// lib/mongo.js
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;     // e.g. mongodb+srv://...
const dbName = process.env.MONGODB_DB;   // e.g. linkinbio
const mongoDisabled = !uri || !dbName;

let client;
let clientPromise;

if (!global._mongoClientPromise) {
  if (!mongoDisabled) {
    client = new MongoClient(uri, {
      serverApi: { version: "1", strict: false, deprecationErrors: false },
    });
    global._mongoClientPromise = client.connect();
  } else {
    global._mongoClientPromise = null;
  }
}

clientPromise = global._mongoClientPromise;

export async function getDb() {
  if (mongoDisabled) {
    throw new Error("MongoDB is not configured (missing MONGODB_URI/MONGODB_DB).");
  }
  const c = await clientPromise;
  return c.db(dbName);
}
