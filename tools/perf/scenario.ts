import { createHash } from "node:crypto";
import { instruments, instrument } from "../../src/domain/instruments.ts";
import { CANDLE_LIMIT } from "../../src/domain/candles.ts";
import { SyntheticEngine, TRADE_LIMIT } from "../../src/features/market/providers/synthetic-engine.ts";
import type { MarketSnapshot } from "../../src/domain/market.ts";
import type { Rate } from "./options.ts";

export const scenario = {
  id: "five-symbol-trades-v1",
  inputUnit: "synthetic-trade",
  symbols: instruments.map(({ symbol }) => symbol),
  schedulerIntervalMs: 10,
  maxBatchTrades: 100,
  batchBudgetMs: 5,
  drainLimitMs: 5000,
  eventLoopResolutionMs: 10,
  memorySampleIntervalMs: 1000,
  limits: { tradesPerSymbol: TRADE_LIMIT, candlesPerSymbol: CANDLE_LIMIT },
} as const;

// A separate paced driver for the existing engine; it never changes the app provider.
// One input is one trade. Each engine step also creates one quote and one book.
export class Workload {
  readonly engines: SyntheticEngine[];
  readonly deltaMs: number;
  processed = 0;
  maxTradeBuffer = 0;
  maxCandleBuffer = 0;
  bufferLimitExceeded = false;
  constructor(seed: string, rate: Rate) {
    this.deltaMs = 1000 * instruments.length / rate;
    this.engines = instruments.map((stock) => new SyntheticEngine(
      stock.symbol === instrument.symbol ? seed : `${seed}:${stock.symbol}`,
      `perf:${seed}:${stock.symbol}`, stock,
    ));
    for (const snapshot of this.snapshots()) this.observeBounds(snapshot);
  }
  snapshots() { return this.engines.map((engine) => engine.snapshot); }
  advance() {
    const engine = this.engines[this.processed % this.engines.length]!;
    // Virtual event/receipt times depend only on index, seed and rate, never wall time.
    const nextTime = engine.snapshot.quote.eventTimeMs + this.deltaMs;
    const snapshot = engine.advance(this.deltaMs, nextTime);
    this.processed++;
    this.observeBounds(snapshot);
    return snapshot.trades[0]!;
  }
  private observeBounds(snapshot: MarketSnapshot) {
    this.maxTradeBuffer = Math.max(this.maxTradeBuffer, snapshot.trades.length);
    this.maxCandleBuffer = Math.max(this.maxCandleBuffer, snapshot.candles.length);
    if (snapshot.trades.length > TRADE_LIMIT || snapshot.candles.length > CANDLE_LIMIT) this.bufferLimitExceeded = true;
  }
  digest() {
    return createHash("sha256").update(JSON.stringify(this.snapshots())).digest("hex");
  }
}
