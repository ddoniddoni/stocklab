import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import { bridgeHttp, clientMessageSchema, historyQuerySchema, localOrigins, symbolSchema } from "../../src/domain/local-market.ts";
import { readBridgeConfig } from "./config.ts";
import { KisRest } from "./rest.ts";
import { KisUpstream } from "./upstream.ts";

async function jsonBody(request: IncomingMessage) {
  let size = 0; const chunks: Buffer[] = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 4096) throw new Error("body limit");
    chunks.push(Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}
function reply(response: ServerResponse, status: number, value: unknown) {
  if (response.destroyed || response.writableEnded) return;
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store, private", "x-content-type-options": "nosniff" });
  response.end(JSON.stringify(value));
}
async function main() {
  const config = await readBridgeConfig();
  const rest = new KisRest(config); const upstream = new KisUpstream(rest, config.KIS_MAX_SUBSCRIPTIONS);
  const tickets = new Map<string, { origin: string; expiresAt: number }>();
  const websocket = new WebSocketServer({ noServer: true, maxPayload: 4096, perMessageDeflate: false });
  let activeRequests = 0; let windowAt = Date.now(); let requests = 0;
  const allowedOrigin = (value: unknown): value is string => typeof value === "string" && (localOrigins as readonly string[]).includes(value);
  const localRequest = (request: IncomingMessage) => request.headers.host === "127.0.0.1:8787" && request.socket.remoteAddress === "127.0.0.1";
  const authorized = (request: IncomingMessage) => {
    const value = request.headers["x-stocklab-secret"];
    if (typeof value !== "string" || value.length !== config.KIS_BRIDGE_SHARED_SECRET.length) return false;
    const a = Buffer.from(value); const b = Buffer.from(config.KIS_BRIDGE_SHARED_SECRET);
    return a.length === b.length && timingSafeEqual(a, b);
  };
  const server = createServer({ requestTimeout: 10_000, headersTimeout: 5000, maxHeaderSize: 8192 }, async (request, response) => {
    if (!localRequest(request) || request.headers.origin || !authorized(request)) { reply(response, 403, { error: "요청을 허용하지 않습니다." }); return; }
    if (Date.now() - windowAt > 60_000) { requests = 0; windowAt = Date.now(); }
    if (++requests > 120 || activeRequests >= 12) { reply(response, 429, { error: "잠시 후 다시 요청하세요." }); return; }
    activeRequests++;
    const abort = new AbortController();
    response.on("close", () => { if (!response.writableEnded) abort.abort(); });
    const timeout = setTimeout(() => abort.abort(), 90_000);
    try {
      const url = new URL(request.url ?? "/", bridgeHttp);
      if (request.method === "POST" && url.pathname === "/ticket" && !url.search) {
        const origin = request.headers["x-stocklab-origin"];
        if (!allowedOrigin(origin)) { reply(response, 403, { error: "Origin 오류" }); return; }
        for (const [key, value] of tickets) if (value.expiresAt <= Date.now()) tickets.delete(key);
        if (tickets.size >= 64) { reply(response, 429, { error: "티켓 발급 한도" }); return; }
        const ticket = randomBytes(32).toString("hex"); const expiresAt = Date.now() + 30_000;
        tickets.set(ticket, { origin, expiresAt }); reply(response, 200, { ticket, expiresAt });
      } else if (request.method === "GET" && url.pathname === "/quote" && [...url.searchParams.keys()].join(",") === "symbol") {
        reply(response, 200, await rest.quote(symbolSchema.parse(url.searchParams.get("symbol")), abort.signal));
      } else if (request.method === "POST" && url.pathname === "/history" && !url.search) {
        reply(response, 200, await rest.history(historyQuerySchema.parse(await jsonBody(request)), abort.signal));
      } else { reply(response, 404, { error: "지원하지 않는 경로입니다." }); }
    } catch { reply(response, 503, { error: "로컬 시세 요청에 실패했습니다. 설정·인증·이용 한도를 확인하세요." }); }
    finally { activeRequests--; clearTimeout(timeout); }
  });
  server.on("upgrade", (request, socket, head) => {
    socket.on("error", () => {});
    if (!localRequest(request) || request.url !== "/ws" || !allowedOrigin(request.headers.origin) || websocket.clients.size >= 12) { socket.destroy(); return; }
    websocket.handleUpgrade(request, socket, head, (ws) => websocket.emit("connection", ws, request));
  });
  websocket.on("connection", (socket, request) => {
    const id = randomUUID(); let authenticated = false; let alive = true;
    let messageWindow = Date.now(); let messageCount = 0;
    const authTimer = setTimeout(() => socket.close(1008, "authentication timeout"), 5000);
    const heartbeat = setInterval(() => { if (!alive) { socket.terminate(); return; } alive = false; socket.ping(); }, 30_000);
    const send = (event: unknown) => {
      if (socket.readyState !== WebSocket.OPEN) return;
      if (socket.bufferedAmount > 512 * 1024) { socket.terminate(); return; }
      socket.send(JSON.stringify(event));
    };
    socket.on("pong", () => { alive = true; });
    socket.on("error", () => {});
    socket.on("message", (data, binary) => {
      try {
        if (binary) throw new Error("binary message");
        if (Date.now() - messageWindow > 60_000) { messageCount = 0; messageWindow = Date.now(); }
        if (++messageCount > 60) throw new Error("message limit");
        const message = clientMessageSchema.parse(JSON.parse(data.toString()));
        if (!authenticated) {
          if (message.type !== "auth") throw new Error("authentication required");
          const ticket = tickets.get(message.ticket); tickets.delete(message.ticket);
          if (!ticket || ticket.expiresAt <= Date.now() || ticket.origin !== request.headers.origin) throw new Error("ticket invalid");
          authenticated = true; clearTimeout(authTimer);
          send({ type: "status", state: "connecting", message: "로컬 브리지에 연결했습니다. 원천 시세를 기다립니다." });
        } else {
          if (message.type !== "subscriptions") throw new Error("already authenticated");
          upstream.set(id, message.items, send);
        }
      } catch { socket.close(1008, "invalid local request"); }
    });
    socket.on("close", () => { clearTimeout(authTimer); clearInterval(heartbeat); upstream.remove(id); });
  });
  const stop = () => {
    upstream.dispose(); rest.dispose(); tickets.clear();
    websocket.clients.forEach((socket) => socket.terminate()); websocket.close(); server.close(); server.closeAllConnections();
  };
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  server.on("error", () => { console.error("KIS_BRIDGE: 로컬 포트를 열 수 없습니다."); stop(); process.exitCode = 1; });
  server.listen(8787, "127.0.0.1", () => {
    console.log("KIS_BRIDGE: 127.0.0.1:8787에서 개인용 읽기 전용 브리지를 시작했습니다.");
    process.send?.({ type: "ready" });
  });
}
await main().catch(() => { console.error("KIS_BRIDGE: 로컬 설정이 올바르지 않습니다. tools/kis-bridge/.env.local을 확인하세요."); process.exitCode = 1; });
