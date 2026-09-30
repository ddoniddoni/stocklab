import { localBridgeRequest } from "@/server/market/local-bridge";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(request: Request) { return localBridgeRequest(request, "history"); }
