import { aggregateTrade } from "@/domain/candles";
import {
  orderBookSchema,
  quoteSchema,
  tradeSchema,
  type MarketSnapshot,
} from "@/domain/market";
import { instrument, type Instrument } from "@/domain/instruments";
export const START_MS = Date.UTC(2026, 0, 5, 0, 0, 0);
export const TRADE_LIMIT = 500;
export const TICK_SIZE = 100; // A simulation rule, not a full KRX tick-size implementation.
function randomFromSeed(seed: string) {
  let state = 2166136261;
  for (const char of seed)
    state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
export class SyntheticEngine {
  private readonly random: () => number;
  private clock = START_MS;
  private sequence = 0;
  private lastPrice: number;
  private volume = 0n;
  private current!: MarketSnapshot;
  constructor(
    readonly seed: string,
    readonly sessionId: string,
    private readonly stock: Instrument = instrument,
  ) {
    this.lastPrice = stock.initialPrice;
    this.random = randomFromSeed(seed);
    // Every history candle is aggregated from the same authored trade stream.
    for (let i = 0; i < 160; i++) this.advance(15_000, START_MS);
  }
  get snapshot(): MarketSnapshot {
    return this.current;
  }
  advance(deltaMs = 1000, receivedAtMs = Date.now()): MarketSnapshot {
    if (!Number.isSafeInteger(deltaMs) || deltaMs <= 0)
      throw new Error("잘못된 가상 시간 간격");
    this.clock += deltaMs;
    const movement = Math.floor(this.random() * 5) - 2;
    const pull =
      this.lastPrice > this.stock.initialPrice + 6000
        ? -1
        : this.lastPrice < this.stock.initialPrice - 6000
          ? 1
          : 0;
    this.lastPrice = Math.max(
      10_000,
      this.lastPrice + (movement + pull) * TICK_SIZE,
    );
    const quantity = 1 + Math.floor(this.random() * 200);
    this.volume += BigInt(quantity);
    const meta = {
      source: "synthetic" as const,
      venue: "SIM" as const,
      symbol: this.stock.symbol,
      sessionId: this.sessionId,
      eventTimeMs: this.clock,
      receivedAtMs,
    };
    const trade = tradeSchema.parse({
      ...meta,
      sequence: ++this.sequence,
      price: this.lastPrice,
      quantity,
      aggressor: "unknown",
    });
    const quote = quoteSchema.parse({
      ...meta,
      sequence: ++this.sequence,
      lastPrice: trade.price,
      previousClose: this.stock.initialPrice,
      change: trade.price - this.stock.initialPrice,
      changePercent:
        ((trade.price - this.stock.initialPrice) / this.stock.initialPrice) *
        100,
      cumulativeVolume: this.volume.toString(),
    });
    const levels = (direction: number) =>
      Array.from({ length: 10 }, (_, index) => ({
        price: trade.price + direction * (index + 1) * TICK_SIZE,
        quantity: Math.floor(this.random() * 2000),
      }));
    const orderBook = orderBookSchema.parse({
      ...meta,
      sequence: ++this.sequence,
      kind: "snapshot",
      asks: levels(1),
      bids: levels(-1),
    });
    this.current = {
      status: "idle",
      quote,
      orderBook,
      trades: [trade, ...(this.current?.trades ?? [])].slice(0, TRADE_LIMIT),
      candles: aggregateTrade(this.current?.candles ?? [], trade),
      manifest: {
        source: "synthetic",
        generatorVersion: "1.1.0",
        seed: this.seed,
        generatedAt: new Date(START_MS).toISOString(),
        scenarioId: "balanced-session",
      },
    };
    return this.current;
  }
}
