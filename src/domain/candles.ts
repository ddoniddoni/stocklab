import { tradeSchema, type Candle, type Trade } from "./market.ts";
export const CANDLE_LIMIT = 240;
export function aggregateTrade(
  candles: readonly Candle[],
  input: Trade,
): Candle[] {
  const trade = tradeSchema.parse(input);
  const bucket = Math.floor(trade.eventTimeMs / 60_000) * 60_000;
  const previous = candles.at(-1);
  if (previous?.time.kind === "instant" && bucket < previous.time.epochMs) {
    throw new Error("시간이 역전된 체결은 집계할 수 없습니다.");
  }
  if (previous?.time.kind === "instant" && previous.time.epochMs === bucket) {
    return [
      ...candles.slice(0, -1),
      {
        ...previous,
        high: Math.max(previous.high, trade.price),
        low: Math.min(previous.low, trade.price),
        close: trade.price,
        volume: (BigInt(previous.volume) + BigInt(trade.quantity)).toString(),
      },
    ];
  }
  return [
    ...candles,
    {
      time: { kind: "instant" as const, epochMs: bucket },
      open: trade.price,
      high: trade.price,
      low: trade.price,
      close: trade.price,
      volume: String(trade.quantity),
    },
  ].slice(-CANDLE_LIMIT);
}
