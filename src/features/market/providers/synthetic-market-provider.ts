import { z } from "zod";
import { instrument } from "@/domain/instruments";
import type {
  HistoryQuery,
  HistoryResult,
  MarketEvent,
  MarketProvider,
  MarketSnapshot,
  Subscription,
} from "@/domain/market";
import { SyntheticEngine } from "./synthetic-engine";
const historySchema = z
  .object({
    symbol: z.literal(instrument.symbol),
    interval: z.literal("1m"),
    from: z.iso.datetime({ offset: true }),
    to: z.iso.datetime({ offset: true }),
  })
  .refine((query) => Date.parse(query.from) <= Date.parse(query.to));
export class SyntheticMarketProvider implements MarketProvider {
  readonly source = "synthetic";
  private engine: SyntheticEngine;
  private current: MarketSnapshot;
  private readonly listeners = new Map<
    symbol,
    { request: Subscription; listener: (event: MarketEvent) => void }
  >();
  private timer: ReturnType<typeof setInterval> | undefined;
  private connected = false;
  private disposed = false;
  private lastWallTime = 0;
  private generation = 0;
  constructor(
    private readonly seed = "stocklab-v1",
    private readonly clock: () => number = Date.now,
  ) {
    this.engine = new SyntheticEngine(seed, `synthetic:${seed}:0`);
    this.current = this.engine.snapshot;
  }
  getSnapshot = () => this.current;
  async connect() {
    if (this.disposed) throw new Error("종료된 공급기입니다.");
    if (this.connected) return;
    this.connected = true;
    this.setStatus("connecting");
    this.setStatus("live");
    this.ensureTimer();
  }
  subscribe(request: Subscription, listener: (event: MarketEvent) => void) {
    if (this.disposed) throw new Error("종료된 공급기입니다.");
    if (
      request.symbol !== instrument.symbol ||
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
    const candles = this.current.candles.filter(
      (candle) =>
        candle.time.kind === "instant" &&
        candle.time.epochMs >= from &&
        candle.time.epochMs <= to,
    );
    // The current candle is still forming and this bounded session is not full market history.
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
    if (!this.disposed) {
      this.clearTimer();
      this.setStatus("paused");
    }
  }
  resume() {
    if (!this.disposed) {
      this.setStatus("live");
      this.ensureTimer();
    }
  }
  reset() {
    if (this.disposed) return;
    const paused = this.current.status === "paused";
    this.clearTimer();
    this.engine = new SyntheticEngine(
      this.seed,
      `synthetic:${this.seed}:${++this.generation}`,
    );
    this.current = {
      ...this.engine.snapshot,
      status: paused ? "paused" : "live",
    };
    this.emit({ type: "reset", sessionId: this.current.quote.sessionId });
    this.ensureTimer();
  }
  dispose() {
    if (!this.disposed) {
      this.clearTimer();
      this.listeners.clear();
      this.connected = false;
      this.disposed = true;
    }
  }
  private setStatus(status: MarketSnapshot["status"], message?: string) {
    this.current = { ...this.current, status, message };
    this.emit({ type: "status", state: status, message });
  }
  private emit(event: MarketEvent) {
    for (const { request, listener } of this.listeners.values()) {
      if (
        event.type === "reset" ||
        event.type === "status" ||
        request.channels.includes(event.type)
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
      this.current.status === "paused" ||
      this.current.status === "error"
    )
      return;
    this.lastWallTime = this.clock();
    this.timer = setInterval(() => {
      const now = this.clock();
      const gap = now - this.lastWallTime;
      this.lastWallTime = now;
      if (gap > 5000) {
        this.setStatus(
          "stale",
          "갱신이 지연되었습니다. 다음 합성 체결부터 이어집니다.",
        );
        return;
      }
      try {
        // Publish an atomic snapshot before any listener observes this tick.
        this.current = { ...this.engine.advance(1000, now), status: "live" };
        const trade = this.current.trades[0]!;
        this.emit({ type: "trade", payload: trade });
        this.emit({ type: "quote", payload: this.current.quote });
        this.emit({ type: "orderbook", payload: this.current.orderBook });
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
