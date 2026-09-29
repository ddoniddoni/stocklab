import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SyntheticEngine,
  START_MS,
  TRADE_LIMIT,
} from "@/features/market/providers/synthetic-engine";
import { SyntheticMarketProvider } from "@/features/market/providers/synthetic-market-provider";
import { MarketStore } from "@/features/market/stores/market-store";
import { aggregateTrade, CANDLE_LIMIT } from "@/domain/candles";
import {
  orderBookSchema,
  quoteSchema,
  tradeSchema,
  type MarketEvent,
} from "@/domain/market";
const request = {
  symbol: "005930",
  channels: ["quote", "trade", "orderbook"] as (
    "quote" | "trade" | "orderbook"
  )[],
};
afterEach(() => {
  vi.useRealTimers();
});
describe("deterministic synthetic engine", () => {
  it("reproduces history and live values for the same seed", () => {
    const a = new SyntheticEngine("same", "session");
    const b = new SyntheticEngine("same", "session");
    expect(a.snapshot).toEqual(b.snapshot);
    for (let i = 0; i < 200; i++)
      expect(a.advance(1000, START_MS)).toEqual(b.advance(1000, START_MS));
    expect(
      new SyntheticEngine("different", "session").snapshot.quote.lastPrice,
    ).not.toBe(a.snapshot.quote.lastPrice);
  });
  it("keeps quote, trade, candle, spread, volumes and event metadata coherent", () => {
    const engine = new SyntheticEngine("coherence", "session");
    let cumulative = BigInt(engine.snapshot.quote.cumulativeVolume!);
    for (let i = 0; i < 150; i++) {
      const value = engine.advance(1000, START_MS);
      const trade = value.trades[0]!;
      const candle = value.candles.at(-1)!;
      cumulative += BigInt(trade.quantity);
      expect(value.quote.lastPrice).toBe(trade.price);
      expect(candle.close).toBe(trade.price);
      expect(candle.high).toBeGreaterThanOrEqual(candle.close);
      expect(candle.low).toBeLessThanOrEqual(candle.open);
      expect(value.orderBook.asks[0]!.price).toBeGreaterThan(trade.price);
      expect(value.orderBook.bids[0]!.price).toBeLessThan(trade.price);
      expect(value.quote.cumulativeVolume).toBe(cumulative.toString());
      expect(value.quote.eventTimeMs).toBe(trade.eventTimeMs);
      expect(value.orderBook.eventTimeMs).toBe(trade.eventTimeMs);
      expect(orderBookSchema.safeParse(value.orderBook).success).toBe(true);
      expect(quoteSchema.safeParse(value.quote).success).toBe(true);
    }
  });
  it("bounds retained buffers without sampling candle volume", () => {
    const engine = new SyntheticEngine("bounded", "session");
    let expected = 0n;
    // Start in a new minute and compute an independent baseline from every trade.
    for (let i = 0; i < 15000; i++) {
      const value = engine.advance(1000, START_MS);
      const trade = value.trades[0]!;
      if (trade.eventTimeMs % 60000 === 0) expected = 0n;
      if (i === 0)
        expected =
          BigInt(value.candles.at(-1)!.volume) - BigInt(trade.quantity);
      expected += BigInt(trade.quantity);
      expect(value.candles.at(-1)!.volume).toBe(expected.toString());
    }
    expect(engine.snapshot.trades).toHaveLength(TRADE_LIMIT);
    expect(engine.snapshot.candles).toHaveLength(CANDLE_LIMIT);
  });
  it("aggregates separate identical trades and rejects older candle buckets", () => {
    const trade = new SyntheticEngine("test", "s").snapshot.trades[0]!;
    const first = aggregateTrade([], trade);
    const second = aggregateTrade(first, {
      ...trade,
      sequence: trade.sequence + 1,
    });
    expect(second[0]!.volume).toBe(String(trade.quantity * 2));
    expect(() =>
      aggregateTrade(second, {
        ...trade,
        eventTimeMs: trade.eventTimeMs - 60000,
      }),
    ).toThrow();
    expect(() => aggregateTrade([], { ...trade, price: Number.NaN })).toThrow();
  });
  it("rejects invalid prices, quantities, source/venue and crossed books", () => {
    const { trades, orderBook } = new SyntheticEngine("test", "s").snapshot;
    for (const price of [-1, Infinity, NaN, 0])
      expect(tradeSchema.safeParse({ ...trades[0], price }).success).toBe(
        false,
      );
    expect(tradeSchema.safeParse({ ...trades[0], quantity: -1 }).success).toBe(
      false,
    );
    expect(tradeSchema.safeParse({ ...trades[0], venue: "KRX" }).success).toBe(
      false,
    );
    expect(
      orderBookSchema.safeParse({ ...orderBook, asks: orderBook.bids }).success,
    ).toBe(false);
  });
});
describe("provider lifecycle", () => {
  async function setup() {
    vi.useFakeTimers();
    vi.setSystemTime(START_MS);
    const provider = new SyntheticMarketProvider();
    const listener = vi.fn<(event: MarketEvent) => void>();
    const unsubscribe = provider.subscribe(request, listener);
    await provider.connect();
    return { provider, listener, unsubscribe };
  }
  it("pauses virtual time, all values and resumes from the same point", async () => {
    const { provider } = await setup();
    vi.advanceTimersByTime(2000);
    provider.pause();
    const snapshot = provider.getSnapshot();
    vi.advanceTimersByTime(10000);
    expect(provider.getSnapshot()).toBe(snapshot);
    provider.resume();
    vi.advanceTimersByTime(1000);
    expect(provider.getSnapshot().quote.eventTimeMs).toBe(
      snapshot.quote.eventTimeMs + 1000,
    );
    provider.dispose();
  });
  it("resets the session and buffers, preserves pause and uses only one timer", async () => {
    const { provider } = await setup();
    const initial = provider.getSnapshot();
    vi.advanceTimersByTime(3000);
    provider.pause();
    provider.reset();
    expect(provider.getSnapshot().quote.sessionId).not.toBe(
      initial.quote.sessionId,
    );
    expect(provider.getSnapshot().quote.lastPrice).toBe(
      initial.quote.lastPrice,
    );
    expect(provider.getSnapshot().candles).toEqual(initial.candles);
    expect(provider.getSnapshot().trades.length).toBe(initial.trades.length);
    expect(provider.getSnapshot().status).toBe("paused");
    expect(vi.getTimerCount()).toBe(0);
    provider.resume();
    provider.resume();
    await provider.connect();
    expect(vi.getTimerCount()).toBe(1);
    provider.reset();
    expect(vi.getTimerCount()).toBe(1);
    provider.dispose();
  });
  it("unsubscribes just one listener and stops the final timer", async () => {
    const { provider, listener, unsubscribe } = await setup();
    const other = vi.fn();
    const off = provider.subscribe(request, other);
    listener.mockClear();
    unsubscribe();
    unsubscribe();
    vi.advanceTimersByTime(1000);
    expect(listener).not.toHaveBeenCalled();
    expect(other).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(1);
    off();
    expect(vi.getTimerCount()).toBe(0);
    provider.dispose();
    provider.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("filters channel events and keeps observed snapshots atomic", async () => {
    const { provider } = await setup();
    const types: string[] = [];
    provider.subscribe({ symbol: "005930", channels: ["quote"] }, (event) => {
      types.push(event.type);
      expect(provider.getSnapshot().quote.lastPrice).toBe(
        provider.getSnapshot().candles.at(-1)!.close,
      );
    });
    vi.advanceTimersByTime(1000);
    expect(types).toEqual(["quote"]);
    provider.dispose();
  });
  it("marks delayed data stale without replaying a backlog", async () => {
    const { provider } = await setup();
    const before = provider.getSnapshot().quote.eventTimeMs;
    vi.setSystemTime(START_MS + 10000);
    vi.advanceTimersByTime(1000);
    expect(provider.getSnapshot().status).toBe("stale");
    expect(provider.getSnapshot().quote.eventTimeMs).toBe(before);
    vi.advanceTimersByTime(1000);
    expect(provider.getSnapshot().status).toBe("live");
    expect(provider.getSnapshot().quote.eventTimeMs).toBe(before + 1000);
    provider.dispose();
  });
  it("handles history ranges, cancellation and unsupported requests", async () => {
    const { provider } = await setup();
    const query = {
      symbol: "005930",
      interval: "1m" as const,
      from: new Date(START_MS).toISOString(),
      to: new Date(START_MS + 86400000).toISOString(),
    };
    expect((await provider.getHistory(query)).candles).toEqual(
      provider.getSnapshot().candles,
    );
    expect(
      (await provider.getHistory({ ...query, from: query.to })).candles,
    ).toHaveLength(0);
    await expect(
      provider.getHistory({ ...query, interval: "1d" }),
    ).rejects.toThrow();
    await expect(
      provider.getHistory({ ...query, from: "2026-01-05" }),
    ).rejects.toThrow();
    await expect(
      provider.getHistory(query, AbortSignal.abort()),
    ).rejects.toThrow();
    expect(() =>
      provider.subscribe({ ...request, symbol: "000000" }, () => {}),
    ).toThrow();
    provider.dispose();
  });
  it("survives Strict Mode-style start/stop/start without duplicate schedulers", () => {
    vi.useFakeTimers();
    const store = new MarketStore("strict");
    const notify = vi.fn();
    const unsubscribe = store.subscribe(notify);
    store.start();
    store.stop();
    store.start();
    store.start();
    expect(vi.getTimerCount()).toBe(1);
    notify.mockClear();
    vi.advanceTimersByTime(1000);
    expect(notify).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.stop();
    store.stop();
    expect(vi.getTimerCount()).toBe(0);
  });
});
