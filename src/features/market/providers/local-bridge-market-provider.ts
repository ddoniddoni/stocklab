import { bridgeWs, historyQuerySchema, localEventSchema, localHistorySchema, localOrigins, localQuoteSchema, subscriptionSchema, ticketSchema } from "@/domain/local-market";
import type { HistoryQuery, HistoryResult, MarketEvent, MarketProvider, Subscription } from "@/domain/market";

export class LocalBridgeMarketProvider implements MarketProvider {
  readonly source = "kis-private";
  private listeners = new Map<symbol, { request: Subscription; listener: (event: MarketEvent) => void }>();
  private socket: WebSocket | undefined;
  private opening = false;
  private disposed = false;
  private terminal = false;
  private lifetime = new AbortController();
  private attempt = 0;
  private generation = 0;
  private sessionId = "";
  private ordering = new Map<string, { sequence: number; time: number }>();
  private liveVersions = new Map<string, number>();
  private retry: ReturnType<typeof setTimeout> | undefined;
  private handshake: ReturnType<typeof setTimeout> | undefined;
  private queued = false;
  private emit(event: MarketEvent) {
    for (const { request, listener } of this.listeners.values()) {
      if (!("payload" in event) || (request.symbol === event.payload.symbol && request.channels.includes(event.type))) listener(event);
    }
  }
  private currentRequests() {
    const map = new Map<string, Set<Subscription["channels"][number]>>();
    for (const { request } of this.listeners.values()) {
      const channels = map.get(request.symbol) ?? new Set(); request.channels.forEach((channel) => channels.add(channel)); map.set(request.symbol, channels);
    }
    return [...map].map(([symbol, channels]) => ({ symbol, channels: [...channels] }));
  }
  private sync() {
    if (this.queued) return; this.queued = true;
    queueMicrotask(() => {
      this.queued = false;
      if (!this.disposed && this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ type: "subscriptions", items: this.currentRequests() }));
    });
  }
  subscribe(request: Subscription, listener: (event: MarketEvent) => void) {
    const validated = subscriptionSchema.parse(request); const id = Symbol();
    this.listeners.set(id, { request: validated, listener }); this.sync();
    let active = true;
    return () => { if (!active) return; active = false; this.listeners.delete(id); this.sync(); };
  }
  async connect(): Promise<void> {
    if (this.disposed || this.opening || this.socket || !this.listeners.size) return;
    if (process.env.NODE_ENV !== "development" || process.env.NEXT_PUBLIC_MARKET_MODE !== "kis-private" || !(localOrigins as readonly string[]).includes(window.location.origin)) {
      this.emit({ type: "status", state: "error", message: "개인 로컬 개발 모드에서만 연결할 수 있습니다." }); return;
    }
    this.opening = true; const generation = ++this.generation;
    this.emit({ type: "status", state: this.attempt ? "reconnecting" : "connecting" });
    try {
      const response = await fetch("/api/local/bridge-session", { method: "POST", cache: "no-store", signal: AbortSignal.any([this.lifetime.signal, AbortSignal.timeout(10_000)]) });
      if (!response.ok) throw new Error("session unavailable");
      const { ticket, expiresAt } = ticketSchema.parse(await response.json());
      if (this.disposed || generation !== this.generation) return;
      if (expiresAt <= Date.now()) throw new Error("expired ticket");
      const socket = new WebSocket(bridgeWs); this.socket = socket;
      this.handshake = setTimeout(() => { if (this.socket === socket) socket.close(); }, 8000);
      socket.onopen = () => {
        if (this.disposed || this.socket !== socket) { socket.close(); return; }
        // One-use ticket stays in this closure; never put it in a URL or storage.
        socket.send(JSON.stringify({ type: "auth", ticket })); this.sync();
        for (const { symbol } of this.currentRequests()) void this.initialQuote(symbol, generation);
      };
      socket.onmessage = (message) => {
        if (this.socket !== socket || this.disposed) return;
        try {
          if (typeof message.data !== "string" || message.data.length > 64 * 1024) throw new Error("frame limit");
          const event = localEventSchema.parse(JSON.parse(message.data));
          clearTimeout(this.handshake);
          if (event.type === "reset") {
            if (this.sessionId === event.sessionId) return;
            this.sessionId = event.sessionId; this.ordering.clear(); this.terminal = false;
          }
          if (event.type === "status" && event.state === "error") this.terminal = true;
          if ("payload" in event) {
            if (event.payload.sessionId !== this.sessionId) return;
            const key = `${event.type}:${event.payload.symbol}`; const previous = this.ordering.get(key);
            if (previous && (event.payload.sequence <= previous.sequence || event.payload.eventTimeMs < previous.time)) {
              this.emit({ type: "status", state: "stale", message: "늦게 도착한 시세를 제외했습니다. 집계에 누락이 있을 수 있습니다." }); return;
            }
            this.ordering.set(key, { sequence: event.payload.sequence, time: event.payload.eventTimeMs });
            if (event.type === "quote") this.liveVersions.set(event.payload.symbol, (this.liveVersions.get(event.payload.symbol) ?? 0) + 1);
            this.attempt = 0;
          }
          this.emit(event);
        } catch {
          this.emit({ type: "status", state: "error", message: "브리지 응답 형식을 확인할 수 없습니다. 연결을 다시 시작하세요." });
          this.attempt = 6; socket.close(1008, "invalid data");
        }
      };
      socket.onerror = () => {}; // onclose owns retries; never expose transport payloads.
      socket.onclose = (event) => {
        if (this.socket !== socket) return;
        this.socket = undefined; this.generation++; clearTimeout(this.handshake);
        if (event.code === 1008) this.attempt = 6;
        this.scheduleRetry();
      };
    } catch { if (!this.disposed && generation === this.generation) this.scheduleRetry(); }
    finally { this.opening = false; }
  }
  private async initialQuote(symbol: string, generation: number) {
    const version = this.liveVersions.get(symbol) ?? 0;
    try {
      const response = await fetch(`/api/local/quote?symbol=${symbol}`, { cache: "no-store", signal: AbortSignal.any([this.lifetime.signal, AbortSignal.timeout(20_000)]) });
      if (!response.ok) throw new Error("quote unavailable");
      const quote = localQuoteSchema.parse(await response.json());
      // A response started before a WS tick must never overwrite that tick.
      if (this.disposed || this.terminal || generation !== this.generation || version !== (this.liveVersions.get(symbol) ?? 0) || quote.symbol !== symbol) return;
      this.emit({ type: "quote", payload: quote });
    } catch {
      if (!this.disposed && !this.terminal && generation === this.generation && version === (this.liveVersions.get(symbol) ?? 0)) this.emit({ type: "status", state: "stale", message: "초기 현재가 조회에 실패했습니다. 실시간 수신을 기다립니다." });
    }
  }
  private scheduleRetry() {
    if (this.disposed || this.retry) return;
    if (++this.attempt > 6) { this.emit({ type: "status", state: "error", message: "로컬 연결을 복구하지 못했습니다. 브리지 실행 상태를 확인하고 재연결하세요." }); return; }
    this.emit({ type: "status", state: "reconnecting", message: "로컬 연결이 끊겼습니다. 누락 구간은 복원하지 않습니다." });
    this.retry = setTimeout(() => { this.retry = undefined; void this.connect(); }, Math.min(30_000, 1000 * 2 ** this.attempt) + Math.floor(Math.random() * 300));
  }
  async getHistory(input: HistoryQuery, signal?: AbortSignal): Promise<HistoryResult> {
    const query = historyQuerySchema.parse(input);
    const response = await fetch("/api/local/history", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(query), cache: "no-store", signal: AbortSignal.any([this.lifetime.signal, AbortSignal.timeout(90_000), ...(signal ? [signal] : [])]) });
    if (!response.ok) throw new Error("일봉을 불러오지 못했습니다. 잠시 후 다시 요청하세요.");
    const result = localHistorySchema.parse(await response.json());
    if (result.candles.some((c, i, rows) => c.time.date < query.from || c.time.date > query.to || (i > 0 && c.time.date <= rows[i - 1]!.time.date))) throw new Error("일봉의 날짜 순서를 확인할 수 없습니다.");
    return result;
  }
  dispose() {
    this.disposed = true; this.generation++; this.lifetime.abort();
    clearTimeout(this.retry); clearTimeout(this.handshake);
    const socket = this.socket; this.socket = undefined;
    if (socket) { socket.onmessage = null; socket.onclose = null; socket.close(); }
    this.listeners.clear(); this.ordering.clear(); this.liveVersions.clear();
  }
}
