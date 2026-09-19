import { getDatabase } from "@/lib/mongodb";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const day = searchParams.get("day");

  if (!date || !day) {
    return Response.json(
      { error: "Missing date or day query parameter" },
      { status: 400 }
    );
  }

  try {
    const db = await getDatabase();
    if (!db) {
      return Response.json({
        items: {},
        source: "local-only",
        mongoConnected: false,
      });
    }

    const session = await db.collection("sessions").findOne({ date, day });
    return Response.json({
      items: session?.items || {},
      updatedAt: session?.updatedAt || null,
      source: "mongodb",
      mongoConnected: true,
    });
  } catch (err) {
    console.error("GET /api/session error:", err);
    return Response.json(
      { error: err.message, mongoConnected: false },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { date, day, items } = body;

    if (!date || !day) {
      return Response.json(
        { error: "Missing date or day in payload" },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    if (!db) {
      return Response.json({
        success: false,
        mongoConnected: false,
        message: "MONGODB_URI not configured or unreachable. Saved locally.",
      });
    }

    await db.collection("sessions").updateOne(
      { date, day },
      {
        $set: {
          date,
          day,
          items: items || {},
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    return Response.json({ success: true, mongoConnected: true });
  } catch (err) {
    console.error("POST /api/session error:", err);
    return Response.json(
      { error: err.message, mongoConnected: false },
      { status: 500 }
    );
  }
}
