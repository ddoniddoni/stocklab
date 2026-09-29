import { z } from "zod";
const price = z.number().int().positive().safe();
const quantity = z.number().int().nonnegative().safe();
const sourceVenue = {
  source: z.enum(["synthetic", "kis-private"]),
  venue: z.enum(["SIM", "KRX"]),
};
const meta = z.object({
  ...sourceVenue,
  symbol: z.string().regex(/^\d{6}$/),
  sessionId: z.string().min(1),
  sequence: quantity,
  eventTimeMs: quantity,
  receivedAtMs: quantity,
});
function validSource(value: { source: string; venue: string }) {
  return value.source === "synthetic"
    ? value.venue === "SIM"
    : value.venue === "KRX";
}
export const tradeSchema = meta
  .extend({
    price,
    quantity: quantity.positive(),
    aggressor: z.enum(["buy", "sell", "unknown"]),
  })
  .refine(validSource, "source/venue mismatch");
export const quoteSchema = meta
  .extend({
    lastPrice: price,
    previousClose: price.nullable(),
    change: z.number().finite().nullable(),
    changePercent: z.number().finite().nullable(),
    cumulativeVolume: z.string().regex(/^\d+$/).nullable(),
  })
  .refine(validSource, "source/venue mismatch");
const level = z.object({ price, quantity });
export const orderBookSchema = meta
  .extend({
    kind: z.literal("snapshot"),
    asks: z.array(level).min(1).max(10),
    bids: z.array(level).min(1).max(10),
  })
  .refine(validSource, "source/venue mismatch")
  .refine((book) => {
    const ask = book.asks[0];
    const bid = book.bids[0];
    return (
      Boolean(ask && bid && ask.price > bid.price) &&
      book.asks.every(
        (item, index, items) =>
          index === 0 || item.price > items[index - 1]!.price,
      ) &&
      book.bids.every(
        (item, index, items) =>
          index === 0 || item.price < items[index - 1]!.price,
      )
    );
  }, "crossed or unsorted book");
export type MarketSource = "synthetic" | "kis-private";
export type MarketChannel = "quote" | "trade" | "orderbook";
export type ConnectionState =
  | "idle"
  | "connecting"
  | "live"
  | "paused"
  | "reconnecting"
  | "stale"
  | "error"
  | "market-closed";
export type Trade = z.infer<typeof tradeSchema>;
export type Quote = z.infer<typeof quoteSchema>;
export type OrderBook = z.infer<typeof orderBookSchema>;
export type CandleTime =
  { kind: "trading-date"; date: string } | { kind: "instant"; epochMs: number };
export type Candle = {
  time: CandleTime;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: string;
};
export type HistoryQuery = {
  symbol: string;
  interval: "1d" | "1m";
  from: string;
  to: string;
};
export type HistoryResult = {
  source: MarketSource;
  candles: readonly Candle[];
  adjustment: "raw" | "adjusted" | "synthetic";
  completeness: "complete" | "partial";
  warnings: string[];
};
export type MarketEvent =
  | { type: "quote"; payload: Quote }
  | { type: "trade"; payload: Trade }
  | { type: "orderbook"; payload: OrderBook }
  | { type: "status"; state: ConnectionState; message?: string }
  | { type: "reset"; sessionId: string };
export type Subscription = { symbol: string; channels: MarketChannel[] };
export interface MarketProvider {
  readonly source: MarketSource;
  connect(): Promise<void>;
  getHistory(query: HistoryQuery, signal?: AbortSignal): Promise<HistoryResult>;
  subscribe(
    request: Subscription,
    listener: (event: MarketEvent) => void,
  ): () => void;
  dispose(): void;
}
export type MarketSnapshot = {
  status: ConnectionState;
  message?: string;
  quote: Quote;
  orderBook: OrderBook;
  trades: readonly Trade[];
  candles: readonly Candle[];
  manifest: {
    source: "synthetic";
    generatorVersion: string;
    seed: string;
    generatedAt: string;
    scenarioId: string;
  };
};
