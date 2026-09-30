import { localBridgeRequest } from "@/server/market/local-bridge";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return localBridgeRequest(request, "quote"); }
