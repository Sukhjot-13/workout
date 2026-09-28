import { checkMongoStatus } from "@/lib/mongodb";

export async function GET() {
  const status = await checkMongoStatus();
  return Response.json({ configured: status.configured, connected: status.connected });
}
