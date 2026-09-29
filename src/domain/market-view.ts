import { getInstrument, instruments } from "./instruments";
import type { Candle } from "./market";
export const periods = ["session", "30m", "15m"] as const;
export const tabs = ["overview", "orderbook", "trades"] as const;
export type DetailView = {
  period: (typeof periods)[number];
  tab: (typeof tabs)[number];
};
export function parseDetailView(
  query: Record<string, string | string[] | undefined>,
): DetailView {
  return {
    period: periods.find((value) => value === query.period) ?? "session",
    tab: tabs.find((value) => value === query.tab) ?? "overview",
  };
}
export function detailHref(symbol: string, view: DetailView) {
  return `/stocks/${symbol}?period=${view.period}&tab=${view.tab}`;
}
export function visibleCandles(
  candles: readonly Candle[],
  period: DetailView["period"],
  eventTimeMs: number,
) {
  if (period === "session") return candles;
  const minutes = period === "30m" ? 30 : 15;
  const currentMinute = Math.floor(eventTimeMs / 60000) * 60000;
  return candles.filter(
    (candle) =>
      candle.time.kind === "instant" &&
      candle.time.epochMs > currentMinute - minutes * 60000,
  );
}
export function parseWatchSymbols(value: string | null) {
  if (value === null)
    return instruments.slice(0, 3).map((stock) => stock.symbol);
  return [
    ...new Set(value.split(",").filter((symbol) => !!getInstrument(symbol))),
  ].slice(0, instruments.length);
}
export function watchHref(symbols: readonly string[], watchOnly: boolean) {
  const query = new URLSearchParams({
    view: watchOnly ? "watchlist" : "all",
    symbols: symbols.join(","),
  });
  return `/?${query}`;
}
