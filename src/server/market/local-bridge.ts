import "server-only";
import { bridgeHttp, historyQuerySchema, localHistorySchema, localOrigins, localQuoteSchema, symbolSchema, ticketSchema } from "@/domain/local-market";
import { validateEnvironment } from "@/lib/config";

type Operation = "ticket" | "quote" | "history";
function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff", "Vary": "Origin, Host" } });
}
async function readBody(request: Request) {
  const reader = request.body?.getReader(); if (!reader) throw new Error("body required");
  let text = ""; let size = 0; const decoder = new TextDecoder();
  try {
    for (;;) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength; if (size > 1024) throw new Error("body limit");
      text += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode()) as unknown;
  } finally { await reader.cancel(); reader.releaseLock(); }
}
export async function localBridgeRequest(request: Request, operation: Operation) {
  // Unavailable in all production/preview/public and ordinary synthetic sessions.
  if (process.env.NODE_ENV !== "development" || process.env.APP_ENV !== "local" || process.env.VERCEL || process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_MARKET_MODE !== "kis-private" || process.env.KIS_LOCAL_ENABLED !== "1") return json({ error: "사용할 수 없는 경로입니다." }, 404);
  const origin = `http://${request.headers.get("host")}`;
  if (!(localOrigins as readonly string[]).includes(origin) || request.headers.get("sec-fetch-site") !== "same-origin" ||
    (request.method === "POST" ? request.headers.get("origin") !== origin : request.headers.has("origin") && request.headers.get("origin") !== origin)) return json({ error: "허용하지 않는 요청입니다." }, 403);
  try {
    validateEnvironment(process.env);
    const headers: Record<string, string> = { "x-stocklab-secret": process.env.KIS_BRIDGE_SHARED_SECRET!, "x-stocklab-origin": origin };
    let path: string = operation; let body: string | undefined;
    const url = new URL(request.url);
    if (operation === "quote") {
      if ([...url.searchParams.keys()].join(",") !== "symbol") return json({ error: "종목 요청 오류" }, 400);
      const symbol = symbolSchema.safeParse(url.searchParams.get("symbol"));
      if (!symbol.success) return json({ error: "지원하지 않는 종목입니다." }, 400);
      path += `?symbol=${symbol.data}`;
    } else {
      if (url.search) return json({ error: "요청 오류" }, 400);
      if (operation === "history") {
        const query = historyQuerySchema.safeParse(await readBody(request));
        if (!query.success) return json({ error: "기간은 최대 366일, 간격은 일봉으로 요청하세요." }, 400);
        headers["content-type"] = "application/json"; body = JSON.stringify(query.data);
      }
    }
    const response = await fetch(`${bridgeHttp}/${path}`, { method: operation === "quote" ? "GET" : "POST", headers, body, cache: "no-store", redirect: "error", signal: AbortSignal.any([request.signal, AbortSignal.timeout(operation === "history" ? 90_000 : 20_000)]) });
    if (!response.ok) { await response.body?.cancel(); return json({ error: "로컬 브리지 요청이 거절되었습니다. 잠시 후 다시 시도하세요." }, 503); }
    const data: unknown = await response.json();
    return json(operation === "ticket" ? ticketSchema.parse(data) : operation === "quote" ? localQuoteSchema.parse(data) : localHistorySchema.parse(data));
  } catch { return json({ error: "로컬 브리지를 사용할 수 없습니다. 실행 상태와 설정을 확인하세요." }, 503); }
}
