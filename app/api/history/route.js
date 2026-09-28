import { getDatabase } from "@/lib/mongodb";
import { logServerError } from "@/lib/manager";
import { hasSessionData, migrateItems } from "@/lib/program";
import { ERROR_CODES } from "@/lib/validate";

const HISTORY_SCAN_LIMIT = 100;
const HISTORY_RETURN_LIMIT = 60;
const ACTIVE_FILTER = { items: { $exists: true } };

let cleanupPromise = null;

// One-shot per process: legacy empty documents are a startup migration, not
// something every history request should pay for.
function cleanupEmptySessions(db) {
  if (!cleanupPromise) {
    cleanupPromise = (async () => {
      try {
        const stale = await db
          .collection("sessions")
          .find(
            { ...ACTIVE_FILTER },
            { projection: { items: 1 } }
          )
          .limit(HISTORY_SCAN_LIMIT)
          .toArray();
        const emptyIds = stale
          .filter((s) => !hasSessionData(s.items))
          .map((s) => s._id);
        if (emptyIds.length > 0) {
          await db.collection("sessions").deleteMany({ _id: { $in: emptyIds } });
        }
      } catch (err) {
        console.warn("Empty session cleanup failed:", err.message);
        cleanupPromise = null;
      }
    })();
  }
  return cleanupPromise;
}

export async function GET() {
  try {
    const db = await getDatabase();
    if (!db) {
      return Response.json({ sessions: [], mongoConnected: false });
    }

    await cleanupEmptySessions(db);

    const allSessions = await db
      .collection("sessions")
      .find(ACTIVE_FILTER, { projection: { _id: 0 } })
      .sort({ date: -1, day: 1 })
      .limit(HISTORY_SCAN_LIMIT)
      .toArray();

    const sessions = [];
    for (const session of allSessions) {
      if (!hasSessionData(session.items)) continue;
      const { items, ...rest } = session;
      const migrated = migrateItems(items, session.day);
      sessions.push({ ...rest, items: migrated.items, unmappedItems: migrated.unmapped });
      if (sessions.length >= HISTORY_RETURN_LIMIT) break;
    }

    return Response.json({ sessions, mongoConnected: true });
  } catch (err) {
    console.error("GET /api/history error:", err);
    logServerError("history_read_failed", err);
    return Response.json(
      { sessions: [], mongoConnected: false, code: ERROR_CODES.INTERNAL },
      { status: 500 }
    );
  }
}
