import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import { z } from "zod";
import type { MarketEvent, Subscription } from "../../src/domain/market.ts";
import { BOOK_TR, parseFrame, subscriptionMessage, TRADE_TR, WS_URL } from "./protocol.ts";
import { KisRest } from "./rest.ts";

type Client = { items: Subscription[]; send: (event: MarketEvent) => void };
const controlSchema = z.object({ header: z.object({ tr_id: z.string(), tr_key: z.string().optional(), encrypt: z.string().optional() }), body: z.object({ rt_cd: z.string() }).optional() });
export class KisUpstream {
  private rest: KisRest;
  private maximum: number;
  private clients = new Map<string, Client>();
  private socket: WebSocket | undefined;
  private opening = false;
  private stopped = false;
  private faulted = false;
  private generation = 0;
  private failures = 0;
  private sessionId = randomUUID();
  private sequence = 0;
  private approval = "";
  private active = new Set<string>();
  private pending: { key: string; subscribe: boolean; deadline: number } | undefined;
  private lastWire = 0;
  private lastData = 0;
  private lastTimes = new Map<string, number>();
  private timer: ReturnType<typeof setInterval>;
  private retry: ReturnType<typeof setTimeout> | undefined;
  constructor(rest: KisRest, maximum: number) {
    this.rest = rest; this.maximum = maximum;
    this.timer = setInterval(() => this.tick(), 500);
  }
  private desired(clients = this.clients) {
    const refs = new Map<string, number>();
    for (const client of clients.values()) for (const item of client.items) {
      const ids = new Set(item.channels.map((channel) => channel === "orderbook" ? BOOK_TR : TRADE_TR));
      for (const id of ids) { const key = `${id}:${item.symbol}`; refs.set(key, (refs.get(key) ?? 0) + 1); }
    }
    return refs;
  }
  set(id: string, items: Subscription[], send: Client["send"]) {
    const fresh = !this.clients.has(id);
    const next = new Map(this.clients); next.set(id, { items, send });
    if (this.desired(next).size > this.maximum) throw new Error("subscription limit");
    this.clients = next;
    if (fresh && this.socket?.readyState === WebSocket.OPEN) send({ type: "reset", sessionId: this.sessionId });
    if (fresh) send({ type: "status", state: this.faulted ? "error" : "connecting", message: this.faulted ? "원천 응답을 해석할 수 없습니다. 브리지를 재시작하고 공식 스키마를 확인하세요." : "KRX 시세를 기다립니다. 미수신 구간은 복원하지 않습니다." });
    if (!this.retry) void this.connect();
  }
  remove(id: string) {
    this.clients.delete(id);
    if (!this.desired().size) {
      this.disconnect(); this.faulted = false; this.failures = 0;
    }
  }
  private broadcast(event: MarketEvent) { this.clients.forEach((client) => client.send(event)); }
  private async connect() {
    if (this.stopped || this.faulted || this.socket || this.opening || !this.desired().size) return;
    this.opening = true; const generation = this.generation;
    this.broadcast({ type: "status", state: this.failures ? "reconnecting" : "connecting" });
    try {
      const approval = await this.rest.approvalKey();
      if (generation !== this.generation || this.stopped || !this.desired().size) return;
      this.approval = approval;
      const socket = new WebSocket(WS_URL, { handshakeTimeout: 10_000, maxPayload: 512 * 1024, perMessageDeflate: false, followRedirects: false });
      this.socket = socket;
      socket.on("open", () => {
        if (this.socket !== socket) return;
        this.sessionId = randomUUID(); this.sequence = 0; this.active.clear(); this.pending = undefined; this.lastTimes.clear();
        this.lastWire = this.lastData = Date.now();
        this.broadcast({ type: "reset", sessionId: this.sessionId });
        this.broadcast({ type: "status", state: "connecting", message: "구독 확인 중입니다. 연결 이전 체결과 끊긴 구간은 포함하지 않습니다." });
      });
      socket.on("message", (data, binary) => {
        if (this.socket !== socket) return;
        this.lastWire = Date.now();
        try {
          if (binary) throw new Error("binary frame");
          const raw = data.toString();
          if (raw.startsWith("{")) {
            const message = controlSchema.parse(JSON.parse(raw));
            if (message.header.tr_id === "PINGPONG") { socket.pong(data); return; }
            if (![TRADE_TR, BOOK_TR].includes(message.header.tr_id) || message.header.encrypt === "Y" || message.body?.rt_cd !== "0") throw new Error("subscription rejected");
            const key = `${message.header.tr_id}:${message.header.tr_key}`;
            if (this.pending?.key === key) {
              if (this.pending.subscribe) this.active.add(key); else this.active.delete(key);
              this.pending = undefined;
            }
            return;
          }
          const events = parseFrame(raw, this.sessionId, () => ++this.sequence);
          this.lastData = Date.now(); this.failures = 0;
          for (const event of events) {
            if (!("payload" in event)) continue;
            const key = `${event.payload.symbol}:${event.type}`;
            if (event.payload.eventTimeMs < (this.lastTimes.get(key) ?? 0)) {
              this.broadcast({ type: "status", state: "stale", message: "시간이 역전된 원천 이벤트를 제외했습니다. 체결 집계에 누락이 있을 수 있습니다." }); continue;
            }
            this.lastTimes.set(key, event.payload.eventTimeMs);
            for (const client of this.clients.values()) if (client.items.some((item) => item.symbol === event.payload.symbol && item.channels.includes(event.type))) client.send(event);
          }
        } catch {
          this.faulted = true;
          this.broadcast({ type: "status", state: "error", message: "원천 응답 또는 구독 확인 오류입니다. 브리지를 재시작하고 공식 스키마·이용 한도를 확인하세요." });
          socket.terminate();
        }
      });
      socket.on("error", () => {}); // Never log ws errors: request context may contain the approval key.
      socket.on("close", () => {
        if (this.socket !== socket) return;
        this.socket = undefined; this.active.clear(); this.pending = undefined;
        if (!this.faulted) this.scheduleRetry();
      });
    } catch { if (generation === this.generation) this.scheduleRetry(); }
    finally { if (generation === this.generation) this.opening = false; }
  }
  private scheduleRetry() {
    if (this.stopped || this.faulted || this.retry || !this.desired().size) return;
    this.failures++;
    if (this.failures > 6) {
      this.faulted = true;
      this.broadcast({ type: "status", state: "error", message: "재연결 한도에 도달했습니다. 키와 네트워크를 확인한 뒤 브리지를 재시작하세요." }); return;
    }
    this.broadcast({ type: "status", state: "reconnecting", message: "원천 연결이 끊겼습니다. 누락 구간을 채우지 않고 새 구간에서 다시 시작합니다." });
    const ms = Math.min(60_000, 1000 * 2 ** this.failures) + Math.floor(Math.random() * 500);
    this.retry = setTimeout(() => { this.retry = undefined; void this.connect(); }, ms);
  }
  private tick() {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    if (Date.now() - this.lastWire > 90_000 || (this.pending && Date.now() > this.pending.deadline)) { socket.terminate(); return; }
    if (Date.now() - this.lastData > 30_000) {
      this.lastData = Date.now();
      this.broadcast({ type: "status", state: "stale", message: "30초 동안 새 시세를 받지 못했습니다. 장 마감·휴장 여부는 자동 판정하지 않습니다." });
    }
    if (this.pending) return;
    const desired = this.desired();
    const remove = [...this.active].find((key) => !desired.has(key));
    const add = [...desired.keys()].find((key) => !this.active.has(key));
    const key = remove ?? add;
    if (!key) return;
    this.pending = { key, subscribe: !remove, deadline: Date.now() + 10_000 };
    try { socket.send(subscriptionMessage(key, this.approval, !remove)); }
    catch { socket.terminate(); }
  }
  private disconnect() {
    this.generation++; this.opening = false;
    clearTimeout(this.retry); this.retry = undefined;
    const socket = this.socket; this.socket = undefined; socket?.terminate();
    this.active.clear(); this.pending = undefined; this.approval = "";
  }
  dispose() { this.stopped = true; clearInterval(this.timer); this.disconnect(); this.clients.clear(); }
}
