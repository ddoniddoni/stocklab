import { searchInstruments } from "@/domain/instruments";
import { publicRoute, publicSuccess, queryParameters, safeHeaders } from "@/server/public-api";
export async function GET(request: Request) {
  return publicRoute(async () => {
    const { q = "" } = queryParameters(request, ["q"]);
    if (q.length > 50) return Response.json({ ok: false, error: { code: "INVALID_INPUT", message: "검색어는 최대 50자입니다.",
      retryable: false, requestId: crypto.randomUUID() } }, { status: 400, headers: safeHeaders });
    return publicSuccess(searchInstruments(q).slice(0, 20).map(({ symbol, name, kind, venue }) => ({ symbol, name, kind, venue })),
      { source: "synthetic", fetchedAt: null, stale: false, warnings: [] });
  });
}
