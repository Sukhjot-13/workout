import { MongoClient } from "mongodb";

let client = null;
let clientPromise = null;
let indexesPromise = null;

function ensureIndexes(db) {
  if (!indexesPromise) {
    indexesPromise = (async () => {
      try {
        const sessions = db.collection("sessions");
        await sessions.createIndex({ date: 1, day: 1 }, { unique: true });
        await sessions.createIndex({ date: -1, day: 1 });
      } catch (err) {
        // A pre-existing duplicate {date, day} pair makes the unique index
        // impossible to build; fall back to the non-unique sort index.
        console.warn("Could not create unique {date, day} index:", err.message);
        try {
          await db.collection("sessions").createIndex({ date: -1, day: 1 });
        } catch (fallbackErr) {
          console.warn("Could not create {date, day} index:", fallbackErr.message);
        }
      }
    })();
  }
  return indexesPromise;
}

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
    const db = connectedClient.db("workout_tracker");
    await ensureIndexes(db);
    return db;
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err.message);
    clientPromise = null;
    indexesPromise = null;
    return null;
  }
}

// Deliberately free of any driver message: this payload is served
// unauthenticated, so a MongoServerSelectionError would disclose the cluster
// topology. Details go to the server log only.
export async function checkMongoStatus() {
  const uri = process.env.MONGODB_URI;
  if (!uri || !uri.trim()) {
    return { configured: false, connected: false };
  }
  try {
    const db = await getDatabase();
    if (!db) {
      return { configured: true, connected: false };
    }
    await db.command({ ping: 1 });
    return { configured: true, connected: true };
  } catch (err) {
    console.warn("MongoDB health check failed:", err.message);
    return { configured: true, connected: false };
  }
}
