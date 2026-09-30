import { instruments } from "@/domain/instruments";
import { aggregateTrade } from "@/domain/candles";
import type { MarketViewSnapshot } from "@/domain/local-market";
import type { MarketEvent, HistoryQuery, HistoryResult } from "@/domain/market";
import type { LocalBridgeMarketProvider } from "../providers/local-bridge-market-provider";
import type { PlaybackSpeed, SessionSnapshot } from "../providers/synthetic-market-provider";

export class LocalMarketStore {
  readonly mode = "kis-private" as const;
  private initial: MarketViewSnapshot = { status: "idle", quote: null, orderBook: null, trades: [], candles: [], manifest: { source: "kis-private" } };
  private initialSession: SessionSnapshot = { status: "idle", speed: 1, hidden: false, manualPaused: false, eventTimeMs: 0, sessionId: "local-pending" };
  private session = this.initialSession;
  private snapshots = new Map(instruments.map(({ symbol }) => [symbol, this.initial]));
  private listeners = new Map<string, Set<() => void>>();
  private sessionListeners = new Set<() => void>();
  private details = new Map<string, number>();
  private detailSubscriptions = new Map<string, () => void>();
  private provider: LocalBridgeMarketProvider | undefined;
  private generation = 0;
  private started = false;
  private dirty = new Set<string>();
  private sessionDirty = false;
  private timer: ReturnType<typeof setInterval> | undefined;
  readonly views = new Map(instruments.map(({ symbol }) => [symbol, {
    getSnapshot: () => this.snapshots.get(symbol)!, getServerSnapshot: () => this.initial,
    getQuote: () => this.snapshots.get(symbol)!.quote, getServerQuote: () => null,
    subscribe: (listener: () => void) => this.listen(symbol, listener, false),
    subscribeDetail: (listener: () => void) => this.listen(symbol, listener, true),
  }]));
  private listen(symbol: string, listener: () => void, detail: boolean) {
    const listeners = this.listeners.get(symbol) ?? new Set<() => void>(); listeners.add(listener); this.listeners.set(symbol, listeners);
    if (detail) { this.details.set(symbol, (this.details.get(symbol) ?? 0) + 1); this.attachDetail(symbol); }
    let active = true;
    return () => {
      if (!active) return; active = false; listeners.delete(listener);
      if (detail) {
        const count = (this.details.get(symbol) ?? 1) - 1; this.details.set(symbol, count);
        if (!count) { this.detailSubscriptions.get(symbol)?.(); this.detailSubscriptions.delete(symbol); }
      }
    };
  }
  private attachDetail(symbol: string) {
    if (!this.provider || !this.details.get(symbol) || this.detailSubscriptions.has(symbol)) return;
    // Returning to a detail screen starts a fresh observed segment, with no gap filling.
    const previous = this.snapshots.get(symbol)!;
    this.snapshots.set(symbol, { ...previous, trades: [], candles: [], orderBook: null }); this.dirty.add(symbol);
    this.detailSubscriptions.set(symbol, this.provider.subscribe({ symbol, channels: ["trade", "orderbook"] }, (event) => {
      if (event.type === "trade" || event.type === "orderbook") this.receive(symbol, event);
    }));
  }
  private receive(symbol: string, event: MarketEvent) {
    const previous = this.snapshots.get(symbol)!;
    let next = previous;
    if (event.type === "reset") {
      next = { ...this.initial, quote: previous.quote?.timeBasis === "retrieved" ? previous.quote : null, status: "connecting", message: "새 수신 구간입니다. 연결 전·끊긴 구간의 체결은 포함하지 않습니다." };
      this.session = { ...this.session, sessionId: event.sessionId, eventTimeMs: 0, status: "connecting", message: next.message };
    } else if (event.type === "status") {
      next = { ...previous, status: event.state, message: event.message, ...(event.state === "error" || event.state === "reconnecting" ? { orderBook: null, trades: [], candles: [] } : {}) };
      this.session = { ...this.session, status: event.state, message: event.message };
    } else if (event.type === "quote") {
      const stale = event.payload.timeBasis === "retrieved" || Date.now() - event.payload.eventTimeMs > 30_000;
      next = { ...previous, quote: event.payload, status: stale ? "stale" : "live" };
      this.session = { ...this.session, status: next.status, eventTimeMs: event.payload.receivedAtMs, message: stale ? "조회 스냅샷 또는 오래된 시세입니다. 실시간 수신 여부를 확인하세요." : "실제 수신 구간만 집계합니다. 연결 전·중단 구간은 포함하지 않습니다." };
    } else if (event.type === "orderbook") next = { ...previous, orderBook: event.payload };
    else if (event.type === "trade") {
      try { next = { ...previous, trades: [event.payload, ...previous.trades].slice(0, 500), candles: aggregateTrade(previous.candles, event.payload) }; }
      catch { next = { ...previous, status: "stale", message: "집계할 수 없는 체결을 제외했습니다. 누락 가능성이 있습니다." }; }
    }
    this.snapshots.set(symbol, next); this.dirty.add(symbol); this.sessionDirty = true;
  }
  private flush = () => {
    for (const [symbol, snapshot] of this.snapshots) if (snapshot.orderBook && Date.now() - snapshot.orderBook.receivedAtMs > 30_000) {
      this.snapshots.set(symbol, { ...snapshot, orderBook: null, message: "30초 이상 갱신되지 않은 호가를 비웠습니다. 시세와 호가는 각각 수신 여부를 확인하세요." }); this.dirty.add(symbol);
    }
    for (const [symbol, snapshot] of this.snapshots) if (snapshot.status === "live" && snapshot.quote && Date.now() - snapshot.quote.receivedAtMs > 30_000) {
      this.snapshots.set(symbol, { ...snapshot, status: "stale" }); this.dirty.add(symbol);
    }
    if (this.session.status === "live" && Date.now() - this.session.eventTimeMs > 30_000) {
      this.session = { ...this.session, status: "stale", message: "30초 동안 새 시세가 없습니다. 장 운영 상태는 자동 판정하지 않습니다." }; this.sessionDirty = true;
    }
    const dirty = [...this.dirty]; this.dirty.clear();
    dirty.forEach((symbol) => this.listeners.get(symbol)?.forEach((listener) => listener()));
    if (this.sessionDirty) { this.sessionDirty = false; this.sessionListeners.forEach((listener) => listener()); }
  };
  getSessionSnapshot = () => this.session;
  getServerSessionSnapshot = () => this.initialSession;
  subscribeSession = (listener: () => void) => { this.sessionListeners.add(listener); return () => { this.sessionListeners.delete(listener); }; };
  start = (hidden = false) => {
    if (this.started) return; this.started = true; this.session = { ...this.session, hidden }; this.sessionDirty = true;
    this.timer = setInterval(this.flush, 100);
    if (!hidden && !this.session.manualPaused) void this.open();
  };
  private async open() {
    const generation = ++this.generation;
    this.session = { ...this.session, status: "connecting" }; this.sessionDirty = true;
    try {
      const { LocalBridgeMarketProvider } = await import("../providers/local-bridge-market-provider");
      if (!this.started || generation !== this.generation) return;
      const provider = new LocalBridgeMarketProvider(); this.provider = provider;
      for (const { symbol } of instruments) {
        provider.subscribe({ symbol, channels: ["quote"] }, (event) => this.receive(symbol, event)); this.attachDetail(symbol);
      }
      await provider.connect();
    } catch {
      if (!this.started || generation !== this.generation) return;
      this.session = { ...this.session, status: "error", message: "로컬 시세 모듈을 불러오지 못했습니다." }; this.sessionDirty = true;
    }
  }
  private disconnect() {
    this.generation++; this.provider?.dispose(); this.provider = undefined; this.detailSubscriptions.clear();
    for (const { symbol } of instruments) { this.snapshots.set(symbol, { ...this.initial, status: "idle" }); this.dirty.add(symbol); }
  }
  stop = () => { this.started = false; this.disconnect(); clearInterval(this.timer); this.timer = undefined; };
  pause = () => { this.disconnect(); this.session = { ...this.session, status: "paused", manualPaused: true, eventTimeMs: 0, message: "수신을 중단했습니다. 재연결 시 새 구간에서 시작합니다." }; this.sessionDirty = true; };
  resume = () => { this.session = { ...this.session, manualPaused: false }; if (!this.session.hidden) { this.disconnect(); void this.open(); } };
  reset = () => this.resume();
  setSpeed = (speed: PlaybackSpeed) => { if (speed !== 1) throw new Error("실제 시세에는 배속을 적용하지 않습니다."); };
  setHidden = (hidden: boolean) => {
    if (this.session.hidden === hidden) return;
    this.session = { ...this.session, hidden }; this.sessionDirty = true;
    if (hidden) { this.disconnect(); this.session = { ...this.session, status: "paused", eventTimeMs: 0, message: "숨긴 탭은 수신을 해제합니다. 복귀 시 새 구간에서 시작합니다." }; }
    else if (!this.session.manualPaused) void this.open();
  };
  getHistory = async (query: HistoryQuery, signal?: AbortSignal): Promise<HistoryResult> => {
    if (!this.provider) throw new Error("로컬 시세에 연결한 뒤 일봉을 조회하세요.");
    return this.provider.getHistory(query, signal);
  };
}
