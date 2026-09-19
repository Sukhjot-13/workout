import { getDatabase } from "@/lib/mongodb";

export async function GET() {
  try {
    const db = await getDatabase();
    if (!db) {
      return Response.json({ sessions: [], mongoConnected: false });
    }

    const sessions = await db
      .collection("sessions")
      .find({})
      .sort({ date: -1 })
      .limit(60)
      .toArray();

    return Response.json({ sessions, mongoConnected: true });
  } catch (err) {
    console.error("GET /api/history error:", err);
    return Response.json({ sessions: [], mongoConnected: false, error: err.message }, { status: 500 });
  }
}
