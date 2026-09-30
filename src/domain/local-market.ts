import { z } from "zod";
import { getInstrument } from "./instruments.ts";
import { orderBookSchema, quoteSchema, tradeSchema, type MarketSnapshot } from "./market.ts";

// Only normalized data crosses the bridge boundary. No provider headers or raw frames.
export const localOrigins = ["http://127.0.0.1:3000", "http://localhost:3000"] as const;
export const bridgeHttp = "http://127.0.0.1:8787";
export const bridgeWs = "ws://127.0.0.1:8787/ws";
export const symbolSchema = z.string().refine((value) => Boolean(getInstrument(value)));
export const subscriptionSchema = z.object({
  symbol: symbolSchema,
  channels: z.array(z.enum(["quote", "trade", "orderbook"])).min(1).max(3),
}).strict();
export const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("auth"), ticket: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  z.object({ type: z.literal("subscriptions"), items: z.array(subscriptionSchema).max(5) }).strict(),
]);
export const ticketSchema = z.object({ ticket: z.string().regex(/^[a-f0-9]{64}$/), expiresAt: z.number().int() }).strict();
const localSource = (value: { source: string }) => value.source === "kis-private";
export const localQuoteSchema = quoteSchema.refine(localSource);
export const localEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("quote"), payload: localQuoteSchema }),
  z.object({ type: z.literal("trade"), payload: tradeSchema.refine(localSource) }),
  z.object({ type: z.literal("orderbook"), payload: orderBookSchema.refine(localSource) }),
  z.object({ type: z.literal("reset"), sessionId: z.string().min(1).max(100) }),
  z.object({ type: z.literal("status"), state: z.enum(["idle", "connecting", "live", "reconnecting", "stale", "error"]), message: z.string().max(300).optional() }),
]);
export const historyQuerySchema = z.object({
  symbol: symbolSchema, interval: z.literal("1d"), from: z.iso.date(), to: z.iso.date(),
}).strict().refine(({ from, to }) => from <= to && Date.parse(to) - Date.parse(from) <= 366 * 86_400_000);
const price = z.number().int().positive().safe();
export const localHistorySchema = z.object({
  source: z.literal("kis-private"), adjustment: z.literal("raw"), completeness: z.enum(["complete", "partial"]),
  warnings: z.array(z.string().max(300)).max(10),
  candles: z.array(z.object({
    time: z.object({ kind: z.literal("trading-date"), date: z.iso.date() }),
    open: price, high: price, low: price, close: price, volume: z.string().regex(/^\d+$/),
  }).refine((c) => c.low <= Math.min(c.open, c.close) && c.high >= Math.max(c.open, c.close))).max(367),
});
export type MarketViewSnapshot = Omit<MarketSnapshot, "quote" | "orderBook" | "manifest"> & {
  quote: MarketSnapshot["quote"] | null;
  orderBook: MarketSnapshot["orderBook"] | null;
  manifest: MarketSnapshot["manifest"] | { source: "kis-private" };
};
