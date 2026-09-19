import { MongoClient } from "mongodb";

let client = null;
let clientPromise = null;

export async function getDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri || !uri.trim()) {
    return null;
  }

  try {
    if (!clientPromise) {
      client = new MongoClient(uri.trim());
      clientPromise = client.connect();
    }
    const connectedClient = await clientPromise;
    return connectedClient.db("workout_tracker");
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err.message);
    clientPromise = null;
    return null;
  }
}

export async function checkMongoStatus() {
  const uri = process.env.MONGODB_URI;
  if (!uri || !uri.trim()) {
    return { configured: false, connected: false, message: "No MONGODB_URI in .env" };
  }
  try {
    const db = await getDatabase();
    if (!db) {
      return { configured: true, connected: false, message: "Could not connect to MongoDB" };
    }
    await db.command({ ping: 1 });
    return { configured: true, connected: true, message: "Connected to MongoDB" };
  } catch (err) {
    return { configured: true, connected: false, message: err.message };
  }
}
