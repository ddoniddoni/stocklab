import { z } from "zod";
import { instrument, instruments, getInstrument } from "@/domain/instruments";
import type {
  HistoryQuery,
  HistoryResult,
  MarketEvent,
  MarketProvider,
  MarketSnapshot,
  Subscription,
} from "@/domain/market";
import { SyntheticEngine } from "./synthetic-engine";
export type PlaybackSpeed = 1 | 2 | 4;
export interface SessionSnapshot {
  status: MarketSnapshot["status"];
  message?: string;
  speed: PlaybackSpeed;
  hidden: boolean;
  manualPaused: boolean;
  eventTimeMs: number;
  sessionId: string;
}
const historySchema = z
  .object({
    symbol: z.string().refine((value) => !!getInstrument(value)),
    interval: z.literal("1m"),
    from: z.iso.datetime({ offset: true }),
    to: z.iso.datetime({ offset: true }),
  })
  .refine((query) => Date.parse(query.from) <= Date.parse(query.to));
export class SyntheticMarketProvider implements MarketProvider {
  readonly source = "synthetic";
  private engines = new Map<string, SyntheticEngine>();
  private snapshots = new Map<string, MarketSnapshot>();
  private readonly listeners = new Map<
    symbol,
    { request: Subscription; listener: (event: MarketEvent) => void }
  >();
  private readonly sessionListeners = new Set<() => void>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private connected = false;
  private disposed = false;
  private lastWallTime = 0;
  private generation = 0;
  private session: SessionSnapshot;
  constructor(
    private readonly seed = "stocklab-v1",
    private readonly clock: () => number = Date.now,
  ) {
    this.createEngines();
    this.session = {
      status: "idle",
      speed: 1,
      hidden: false,
      manualPaused: false,
      eventTimeMs: this.getSnapshot().quote.eventTimeMs,
      sessionId: this.sessionId,
    };
  }
  private get sessionId() {
    return `synthetic:${this.seed}:${this.generation}`;
  }
  private createEngines() {
    this.engines.clear();
    this.snapshots.clear();
    for (const stock of instruments) {
      const engine = new SyntheticEngine(
        stock.symbol === instrument.symbol
          ? this.seed
          : `${this.seed}:${stock.symbol}`,
        `${this.sessionId}:${stock.symbol}`,
        stock,
      );
      this.engines.set(stock.symbol, engine);
      this.snapshots.set(stock.symbol, engine.snapshot);
    }
  }
  getSnapshot = (symbol = instrument.symbol): MarketSnapshot => {
    const value = this.snapshots.get(symbol);
    if (!value) throw new Error("지원하지 않는 종목입니다.");
    return value;
  };
  getSessionSnapshot = () => this.session;
  subscribeSession = (listener: () => void) => {
    this.sessionListeners.add(listener);
    return () => {
      this.sessionListeners.delete(listener);
    };
  };
  async connect() {
    if (this.disposed) throw new Error("종료된 공급기입니다.");
    if (this.connected) return;
    this.connected = true;
    this.setStatus(
      this.session.hidden || this.session.manualPaused ? "paused" : "live",
    );
    this.ensureTimer();
  }
  subscribe(request: Subscription, listener: (event: MarketEvent) => void) {
    if (this.disposed) throw new Error("종료된 공급기입니다.");
    if (
      !getInstrument(request.symbol) ||
      request.channels.some(
        (channel) => !["quote", "trade", "orderbook"].includes(channel),
      )
    )
      throw new Error("지원하지 않는 종목 또는 채널입니다.");
    const id = Symbol("listener");
    this.listeners.set(id, { request, listener });
    this.ensureTimer();
    return () => {
      this.listeners.delete(id);
      if (!this.listeners.size) this.clearTimer();
    };
  }
  async getHistory(
    query: HistoryQuery,
    signal?: AbortSignal,
  ): Promise<HistoryResult> {
    signal?.throwIfAborted();
    const parsed = historySchema.safeParse(query);
    if (!parsed.success)
      throw new Error("지원 종목의 시간대가 있는 1분 이력 요청만 가능합니다.");
    const from = Date.parse(parsed.data.from),
      to = Date.parse(parsed.data.to);
    const candles = this.getSnapshot(query.symbol).candles.filter(
      (candle) =>
        candle.time.kind === "instant" &&
        candle.time.epochMs >= from &&
        candle.time.epochMs <= to,
    );
    return {
      source: this.source,
      candles,
      adjustment: "synthetic",
      completeness: "partial",
      warnings: [
        "직접 생성한 데모 세션의 1분 캔들입니다. 진행 중 캔들을 포함합니다.",
      ],
    };
  }
  pause() {
    if (this.disposed) return;
    this.session = { ...this.session, manualPaused: true };
    this.clearTimer();
    this.setStatus("paused");
  }
  resume() {
    if (this.disposed) return;
    this.session = { ...this.session, manualPaused: false };
    this.setStatus(this.session.hidden ? "paused" : "live");
    this.ensureTimer();
  }
  setHidden(hidden: boolean) {
    if (this.disposed || this.session.hidden === hidden) return;
    this.session = { ...this.session, hidden };
    this.clearTimer();
    this.setStatus(
      hidden || this.session.manualPaused
        ? "paused"
        : this.connected
          ? "live"
          : "idle",
    );
    this.ensureTimer();
  }
  setSpeed(speed: PlaybackSpeed) {
    if (![1, 2, 4].includes(speed))
      throw new Error("지원하지 않는 배속입니다.");
    if (this.disposed || this.session.speed === speed) return;
    this.session = { ...this.session, speed };
    this.notifySession();
  }
  reset() {
    if (this.disposed) return;
    this.clearTimer();
    this.generation++;
    this.createEngines();
    const status =
      this.session.manualPaused || this.session.hidden ? "paused" : "live";
    for (const [symbol, snapshot] of this.snapshots)
      this.snapshots.set(symbol, { ...snapshot, status });
    this.session = {
      ...this.session,
      status,
      message: undefined,
      eventTimeMs: this.getSnapshot().quote.eventTimeMs,
      sessionId: this.sessionId,
    };
    this.emit({ type: "reset", sessionId: this.sessionId });
    this.notifySession();
    this.ensureTimer();
  }
  dispose() {
    if (this.disposed) return;
    this.clearTimer();
    this.listeners.clear();
    this.sessionListeners.clear();
    this.connected = false;
    this.disposed = true;
  }
  private setStatus(status: MarketSnapshot["status"], message?: string) {
    for (const [symbol, snapshot] of this.snapshots)
      this.snapshots.set(symbol, { ...snapshot, status, message });
    this.session = { ...this.session, status, message };
    this.emit({ type: "status", state: status, message });
    this.notifySession();
  }
  private notifySession() {
    this.sessionListeners.forEach((listener) => listener());
  }
  private emit(event: MarketEvent) {
    for (const { request, listener } of this.listeners.values()) {
      if (
        event.type === "reset" ||
        event.type === "status" ||
        (request.symbol === event.payload.symbol &&
          request.channels.includes(event.type))
      )
        listener(event);
    }
  }
  private clearTimer() {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
  }
  private ensureTimer() {
    if (
      this.timer !== undefined ||
      !this.connected ||
      this.disposed ||
      !this.listeners.size ||
      this.session.hidden ||
      this.session.manualPaused ||
      this.session.status === "error"
    )
      return;
    this.lastWallTime = this.clock();
    this.timer = setInterval(() => {
      const now = this.clock(),
        gap = now - this.lastWallTime;
      this.lastWallTime = now;
      if (gap > 5000) {
        this.setStatus(
          "stale",
          "갱신이 지연되었습니다. 다음 합성 체결부터 이어집니다.",
        );
        return;
      }
      try {
        const trades: MarketEvent[] = [];
        // Speed changes the number of virtual seconds, never the RNG sequence.
        // All symbols advance before publishing any listener-visible snapshot.
        for (let step = 0; step < this.session.speed; step++) {
          for (const [symbol, engine] of this.engines) {
            const snapshot = {
              ...engine.advance(1000, now),
              status: "live" as const,
            };
            this.snapshots.set(symbol, snapshot);
            trades.push({ type: "trade", payload: snapshot.trades[0]! });
          }
        }
        this.session = {
          ...this.session,
          status: "live",
          message: undefined,
          eventTimeMs: this.getSnapshot().quote.eventTimeMs,
        };
        for (const event of trades) this.emit(event);
        // One UI snapshot per wall tick, while every trade contributes to candles.
        for (const snapshot of this.snapshots.values()) {
          this.emit({ type: "quote", payload: snapshot.quote });
          this.emit({ type: "orderbook", payload: snapshot.orderBook });
        }
        this.notifySession();
      } catch {
        this.clearTimer();
        this.setStatus(
          "error",
          "합성 데이터를 갱신하지 못했습니다. 초기화 후 다시 시도하세요.",
        );
      }
    }, 1000);
  }
}
