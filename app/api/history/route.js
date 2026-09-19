import { getDatabase } from "@/lib/mongodb";
import { hasSessionData } from "@/lib/program";

export async function GET() {
  try {
    const db = await getDatabase();
    if (!db) {
      return Response.json({ sessions: [], mongoConnected: false });
    }

    const allSessions = await db
      .collection("sessions")
      .find({})
      .sort({ date: -1 })
      .limit(100)
      .toArray();

    const activeSessions = [];
    const emptyIds = [];

    for (const session of allSessions) {
      if (hasSessionData(session.items)) {
        activeSessions.push(session);
      } else {
        emptyIds.push(session._id);
      }
    }

    // Clean up legacy empty sessions
    if (emptyIds.length > 0) {
      db.collection("sessions").deleteMany({ _id: { $in: emptyIds } }).catch((err) => {
        console.warn("Failed to delete empty sessions:", err);
      });
    }

    return Response.json({ sessions: activeSessions.slice(0, 60), mongoConnected: true });
  } catch (err) {
    console.error("GET /api/history error:", err);
    return Response.json({ sessions: [], mongoConnected: false, error: err.message }, { status: 500 });
  }
}
