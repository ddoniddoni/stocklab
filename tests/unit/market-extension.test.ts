import { afterEach, describe, expect, it, vi } from "vitest";
import { instruments, getInstrument } from "@/domain/instruments";
import {
  parseDetailView,
  parseWatchSymbols,
  visibleCandles,
  detailHref,
} from "@/domain/market-view";
import { SyntheticMarketProvider } from "@/features/market/providers/synthetic-market-provider";
import { MarketStore } from "@/features/market/stores/market-store";
async function setup(speed: 1 | 2 | 4 = 1) {
  const provider = new SyntheticMarketProvider("multi", () => 1000);
  provider.subscribe({ symbol: "005930", channels: ["quote"] }, () => {});
  provider.setSpeed(speed);
  await provider.connect();
  return provider;
}
afterEach(() => vi.useRealTimers());
describe("multi-symbol playback", () => {
  it.each([1, 2, 4] as const)(
    "reproduces the same trades and OHLC at %sx for equal virtual time",
    async (speed) => {
      vi.useFakeTimers();
      const baseline = await setup();
      vi.advanceTimersByTime(12000);
      baseline.pause();
      const accelerated = await setup(speed);
      vi.advanceTimersByTime(12000 / speed);
      for (const stock of instruments) {
        const a = baseline.getSnapshot(stock.symbol),
          b = accelerated.getSnapshot(stock.symbol);
        expect(b.quote).toEqual(a.quote);
        expect(b.trades).toEqual(a.trades);
        expect(b.orderBook).toEqual(a.orderBook);
        expect(b.candles).toEqual(a.candles);
      }
      baseline.dispose();
      accelerated.dispose();
    },
  );
  it("shares one timer and time, isolates channel/symbol listeners, resets every buffer atomically", async () => {
    vi.useFakeTimers();
    const provider = await setup(4);
    const first = instruments.map((stock) =>
      provider.getSnapshot(stock.symbol),
    );
    const trades: number[] = [];
    const quotes = vi.fn();
    provider.subscribe({ symbol: "000660", channels: ["trade"] }, (event) => {
      if (event.type !== "trade") return;
      expect(event.payload.symbol).toBe("000660");
      trades.push(event.payload.eventTimeMs);
    });
    provider.subscribe({ symbol: "035420", channels: ["quote"] }, quotes);
    vi.advanceTimersByTime(1000);
    expect(vi.getTimerCount()).toBe(1);
    expect(trades).toHaveLength(4);
    expect(trades[3]! - trades[0]!).toBe(3000);
    expect(quotes).toHaveBeenCalledOnce();
    const times = instruments.map(
      (stock) => provider.getSnapshot(stock.symbol).quote.eventTimeMs,
    );
    expect(new Set(times).size).toBe(1);
    provider.pause();
    provider.subscribe({ symbol: "005930", channels: ["quote"] }, (event) => {
      if (event.type !== "reset") return;
      instruments.forEach((stock, index) => {
        const value = provider.getSnapshot(stock.symbol);
        expect(value.quote.sessionId).not.toBe(first[index]!.quote.sessionId);
        expect(value.quote.lastPrice).toBe(first[index]!.quote.lastPrice);
        expect(value.candles).toEqual(first[index]!.candles);
        expect(value.trades.length).toBe(160);
      });
    });
    provider.reset();
    expect(provider.getSessionSnapshot()).toMatchObject({
      manualPaused: true,
      speed: 4,
      status: "paused",
    });
    expect(vi.getTimerCount()).toBe(0);
    provider.resume();
    provider.reset();
    expect(vi.getTimerCount()).toBe(1);
    provider.dispose();
  });
  it("stops hidden time, skips backlog, and never cancels manual pause on visibility return", async () => {
    vi.useFakeTimers();
    const provider = await setup(2);
    provider.setHidden(true);
    const before = provider.getSnapshot();
    vi.advanceTimersByTime(120000);
    expect(provider.getSnapshot()).toBe(before);
    expect(vi.getTimerCount()).toBe(0);
    provider.setHidden(false);
    vi.advanceTimersByTime(1000);
    expect(provider.getSnapshot().quote.eventTimeMs).toBe(
      before.quote.eventTimeMs + 2000,
    );
    provider.pause();
    provider.setHidden(true);
    provider.reset();
    provider.setHidden(false);
    expect(provider.getSessionSnapshot()).toMatchObject({
      status: "paused",
      manualPaused: true,
      hidden: false,
      speed: 2,
    });
    expect(vi.getTimerCount()).toBe(0);
    provider.dispose();
  });
  it("does not start a hidden session and validates all supported histories and unknown symbols", async () => {
    vi.useFakeTimers();
    const provider = new SyntheticMarketProvider();
    provider.setHidden(true);
    provider.subscribe({ symbol: "066570", channels: ["quote"] }, () => {});
    await provider.connect();
    expect(vi.getTimerCount()).toBe(0);
    for (const stock of instruments) {
      const result = await provider.getHistory({
        symbol: stock.symbol,
        interval: "1m",
        from: "2026-01-05T00:00:00Z",
        to: "2026-01-06T00:00:00Z",
      });
      expect(result.candles).toEqual(
        provider.getSnapshot(stock.symbol).candles,
      );
    }
    expect(() => provider.getSnapshot("000000")).toThrow();
    expect(() => provider.setSpeed(3 as 1)).toThrow();
    provider.dispose();
  });
  it("notifies quotes once per wall tick and replaces detailed subscriptions during route churn", () => {
    vi.useFakeTimers();
    const store = new MarketStore("store");
    store.start();
    const nav = vi.fn(),
      samsung = vi.fn(),
      session = vi.fn();
    const offNav = store.views.get("035420")!.subscribe(nav);
    const offSamsung = store.views.get("005930")!.subscribe(samsung);
    const offSession = store.subscribeSession(session);
    for (let i = 0; i < 20; i++) {
      const off = store.views
        .get(instruments[i % 5]!.symbol)!
        .subscribeDetail(() => {});
      off();
      off();
    }
    store.setSpeed(4);
    session.mockClear();
    vi.advanceTimersByTime(1000);
    expect(nav).toHaveBeenCalledOnce();
    expect(samsung).toHaveBeenCalledOnce();
    expect(session).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(1);
    offNav();
    offSamsung();
    offSession();
    store.stop();
    expect(vi.getTimerCount()).toBe(0);
  });
});
describe("URL views and periods", () => {
  it("normalizes invalid or repeated parameters and filters unsupported/duplicate selection codes", () => {
    expect(parseDetailView({ period: "1d", tab: "financial" })).toEqual({
      period: "session",
      tab: "overview",
    });
    expect(
      parseDetailView({ period: ["15m", "30m"], tab: ["trades"] }),
    ).toEqual({ period: "session", tab: "overview" });
    expect(parseWatchSymbols("000660,000660,000000,035420")).toEqual([
      "000660",
      "035420",
    ]);
    expect(parseWatchSymbols("")).toEqual([]);
    expect(getInstrument("005380")?.name).toBe("현대자동차");
    expect(detailHref("000660", { period: "15m", tab: "orderbook" })).toBe(
      "/stocks/000660?period=15m&tab=orderbook",
    );
  });
  it("uses a viewing window independent of 1m aggregation, retaining the forming candle", () => {
    const provider = new SyntheticMarketProvider();
    const { candles, quote } = provider.getSnapshot();
    expect(visibleCandles(candles, "session", quote.eventTimeMs)).toBe(candles);
    expect(visibleCandles(candles, "30m", quote.eventTimeMs)).toHaveLength(30);
    const short = visibleCandles(candles, "15m", quote.eventTimeMs);
    expect(short).toHaveLength(15);
    expect(short.at(-1)).toBe(candles.at(-1));
    expect(visibleCandles([], "15m", quote.eventTimeMs)).toEqual([]);
    provider.dispose();
  });
});
