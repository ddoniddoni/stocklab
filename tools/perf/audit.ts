import { setImmediate } from "node:timers/promises";
import { performance } from "node:perf_hooks";
import { isDeepStrictEqual } from "node:util";
import type { Candle, Trade } from "../../src/domain/market.ts";
import { CANDLE_LIMIT } from "../../src/domain/candles.ts";
import { Workload } from "./scenario.ts";
import type { Rate } from "./options.ts";

type Reference = { candles: Candle[]; volume: bigint; price: number };
export type Integrity = {
  status: "matched" | "mismatch" | "not_checked" | "cancelled" | "failed";
  elapsedMs: number;
  measuredDigest: string;
  replayDigest: string | null;
  replayEqual: boolean | null;
  independentCandlesEqual: boolean | null;
  cumulativeVolumeEqual: boolean | null;
  finalPriceEqual: boolean | null;
};
export function unchecked(measuredDigest: string): Integrity {
  return { status: "not_checked", elapsedMs: 0, measuredDigest, replayDigest: null, replayEqual: null,
    independentCandlesEqual: null, cumulativeVolumeEqual: null, finalPriceEqual: null };
}
// Deliberately does not call aggregateTrade: a mutable reference checks the production reducer.
function observe(reference: Reference, trade: Trade) {
  const bucket = Math.floor(trade.eventTimeMs / 60_000) * 60_000;
  const last = reference.candles.at(-1);
  if (last?.time.kind === "instant" && last.time.epochMs === bucket) {
    last.high = Math.max(last.high, trade.price);
    last.low = Math.min(last.low, trade.price);
    last.close = trade.price;
    last.volume = (BigInt(last.volume) + BigInt(trade.quantity)).toString();
  } else {
    reference.candles.push({ time: { kind: "instant", epochMs: bucket }, open: trade.price, high: trade.price,
      low: trade.price, close: trade.price, volume: String(trade.quantity) });
    if (reference.candles.length > CANDLE_LIMIT) reference.candles.shift();
  }
  reference.volume += BigInt(trade.quantity);
  reference.price = trade.price;
}

export async function audit(measured: Workload, seed: string, rate: Rate, signal: AbortSignal): Promise<Integrity> {
  const result = unchecked(measured.digest());
  const started = performance.now();
  try {
    signal.throwIfAborted();
    const replay = new Workload(seed, rate);
    const references = new Map(replay.snapshots().map((snapshot) => [snapshot.quote.symbol, {
      candles: structuredClone(snapshot.candles) as Candle[], volume: BigInt(snapshot.quote.cumulativeVolume!), price: snapshot.quote.lastPrice,
    }]));
    // Same ordered input in different chunks, outside all timed/CPU/memory metrics.
    for (let index = 0; index < measured.processed; index++) {
      const trade = replay.advance();
      observe(references.get(trade.symbol)!, trade);
      if ((index + 1) % 250 === 0) await setImmediate(undefined, { signal });
    }
    signal.throwIfAborted();
    result.replayDigest = replay.digest();
    result.replayEqual = result.measuredDigest === result.replayDigest;
    const snapshots = measured.snapshots();
    result.independentCandlesEqual = snapshots.every((snapshot) => isDeepStrictEqual(snapshot.candles, references.get(snapshot.quote.symbol)!.candles));
    result.cumulativeVolumeEqual = snapshots.every((snapshot) => snapshot.quote.cumulativeVolume === references.get(snapshot.quote.symbol)!.volume.toString());
    result.finalPriceEqual = snapshots.every((snapshot) => snapshot.quote.lastPrice === references.get(snapshot.quote.symbol)!.price);
    result.status = result.replayEqual && result.independentCandlesEqual && result.cumulativeVolumeEqual && result.finalPriceEqual ? "matched" : "mismatch";
  } catch {
    result.status = signal.aborted ? "cancelled" : "failed";
  }
  result.elapsedMs = performance.now() - started;
  return result;
}
