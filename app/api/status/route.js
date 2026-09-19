import { checkMongoStatus } from "@/lib/mongodb";

export async function GET() {
  const status = await checkMongoStatus();
  return Response.json(status);
}
