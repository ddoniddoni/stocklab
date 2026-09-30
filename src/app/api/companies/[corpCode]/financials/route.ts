import { financialResponse, publicRoute } from "@/server/public-api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ corpCode: string }> }) {
  return publicRoute(async () => financialResponse((await context.params).corpCode, request));
}
