import { getDatabase } from "@/lib/mongodb";
import { hasSessionData } from "@/lib/program";
import {
  ERROR_CODES,
  readJsonBody,
  validateSessionPayload,
  validateSessionQuery,
} from "@/lib/validate";

function errorResponse(code, status, extra = {}) {
  return Response.json(
    { error: "Request rejected", code, ...extra },
    { status }
  );
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = validateSessionQuery(searchParams);
  if (!query.ok) {
    return errorResponse(query.code, 400);
  }
  const { date, day } = query;

  try {
    const db = await getDatabase();
    if (!db) {
      return Response.json({
        items: {},
        updatedAt: null,
        programVersion: null,
        source: "local-only",
        mongoConnected: false,
      });
    }

    const session = await db.collection("sessions").findOne({ date, day });
    return Response.json({
      items: session?.items || {},
      updatedAt: session?.updatedAt || null,
      programVersion: session?.programVersion ?? null,
      source: "mongodb",
      mongoConnected: true,
    });
  } catch (err) {
    console.error("GET /api/session error:", err);
    return errorResponse(ERROR_CODES.INTERNAL, 500, { mongoConnected: false });
  }
}

export async function POST(request) {
  const read = await readJsonBody(request);
  if (!read.ok) {
    const status = read.code === ERROR_CODES.PAYLOAD_TOO_LARGE ? 413 : 400;
    return errorResponse(read.code, status);
  }

  const payload = validateSessionPayload(read.body);
  if (!payload.ok) {
    return errorResponse(payload.code, 400);
  }
  const { date, day, items, programVersion } = payload;

  try {
    const db = await getDatabase();
    if (!db) {
      return Response.json({
        success: false,
        mongoConnected: false,
        code: ERROR_CODES.NOT_FOUND,
        message: "MONGODB_URI not configured or unreachable. Saved locally.",
      });
    }

    const hasData = hasSessionData(items);

    if (!hasData) {
      await db.collection("sessions").deleteOne({ date, day });
      return Response.json({ success: true, deleted: true, mongoConnected: true });
    }

    await db.collection("sessions").updateOne(
      { date, day },
      {
        $set: {
          date,
          day,
          items,
          updatedAt: new Date(),
          programVersion: programVersion ?? null,
        },
      },
      { upsert: true }
    );

    return Response.json({ success: true, mongoConnected: true });
  } catch (err) {
    console.error("POST /api/session error:", err);
    return errorResponse(ERROR_CODES.INTERNAL, 500, { mongoConnected: false });
  }
}
