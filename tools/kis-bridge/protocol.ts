import { z } from "zod";
import { quoteSchema, tradeSchema, orderBookSchema, type MarketEvent } from "../../src/domain/market.ts";
import { symbolSchema } from "../../src/domain/local-market.ts";

// KIS official sample 277ec0eb7a9b7f63b6807829286c80f36649dad2, checked 2026-09-30.
export const REST_ORIGIN = "https://openapi.koreainvestment.com:9443";
export const WS_URL = "ws://ops.koreainvestment.com:21000/tryitout";
export const TRADE_TR = "H0STCNT0";
export const BOOK_TR = "H0STASP0";
const tradeFields = "MKSC_SHRN_ISCD STCK_CNTG_HOUR STCK_PRPR PRDY_VRSS_SIGN PRDY_VRSS PRDY_CTRT WGHN_AVRG_STCK_PRC STCK_OPRC STCK_HGPR STCK_LWPR ASKP1 BIDP1 CNTG_VOL ACML_VOL ACML_TR_PBMN SELN_CNTG_CSNU SHNU_CNTG_CSNU NTBY_CNTG_CSNU CTTR SELN_CNTG_SMTN SHNU_CNTG_SMTN CCLD_DVSN SHNU_RATE PRDY_VOL_VRSS_ACML_VOL_RATE OPRC_HOUR OPRC_VRSS_PRPR_SIGN OPRC_VRSS_PRPR HGPR_HOUR HGPR_VRSS_PRPR_SIGN HGPR_VRSS_PRPR LWPR_HOUR LWPR_VRSS_PRPR_SIGN LWPR_VRSS_PRPR BSOP_DATE NEW_MKOP_CLS_CODE TRHT_YN ASKP_RSQN1 BIDP_RSQN1 TOTAL_ASKP_RSQN TOTAL_BIDP_RSQN VOL_TNRT PRDY_SMNS_HOUR_ACML_VOL PRDY_SMNS_HOUR_ACML_VOL_RATE HOUR_CLS_CODE MRKT_TRTM_CLS_CODE VI_STND_PRC MARKET_CLS_CODE".split(" ");
const bookFields = [
  "MKSC_SHRN_ISCD", "BSOP_HOUR", "HOUR_CLS_CODE",
  ...["ASKP", "BIDP", "ASKP_RSQN", "BIDP_RSQN"].flatMap((prefix) => Array.from({ length: 10 }, (_, i) => `${prefix}${i + 1}`)),
  ..."TOTAL_ASKP_RSQN TOTAL_BIDP_RSQN OVTM_TOTAL_ASKP_RSQN OVTM_TOTAL_BIDP_RSQN ANTC_CNPR ANTC_CNQN ANTC_VOL ANTC_CNTG_VRSS ANTC_CNTG_VRSS_SIGN ANTC_CNTG_PRDY_CTRT ACML_VOL TOTAL_ASKP_RSQN_ICDC TOTAL_BIDP_RSQN_ICDC OVTM_TOTAL_ASKP_ICDC OVTM_TOTAL_BIDP_ICDC STCK_DEAL_CLS_CODE MID_PRC MIDP_TOTAL_RSQN MIDP_CLS_CODE MARKET_CLS_CODE".split(" "),
];
export const digits = z.string().regex(/^\d+$/);
export const decimal = z.string().regex(/^[+-]?\d+(?:\.\d+)?$/);
export function integer(value: unknown, positive = false) {
  return z.number().int().safe().min(positive ? 1 : 0).parse(Number(digits.parse(value)));
}
export function signedNumber(value: unknown) { return z.number().finite().parse(Number(decimal.parse(value))); }
export function isoDate(value: unknown) {
  const raw = z.string().regex(/^\d{8}$/).parse(value);
  return z.iso.date().parse(`${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`);
}
export function kstDate(now: number) { return new Date(now + 9 * 3_600_000).toISOString().slice(0, 10); }
function eventTime(date: string, hour: unknown) {
  const t = z.string().regex(/^(?:[01]\d|2[0-3])[0-5]\d[0-5]\d$/).parse(hour);
  return Date.parse(`${date}T${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}+09:00`);
}
export function meta(symbol: string, sessionId: string, sequence: number, now = Date.now()) {
  return { source: "kis-private" as const, venue: "KRX" as const, symbol, sessionId, sequence, eventTimeMs: now, receivedAtMs: now };
}
export function subscriptionMessage(key: string, approval: string, subscribe: boolean) {
  const [trId, symbol] = key.split(":");
  if (![TRADE_TR, BOOK_TR].includes(trId!) || !symbolSchema.safeParse(symbol).success) throw new Error("subscription");
  return JSON.stringify({ header: { approval_key: approval, custtype: "P", tr_type: subscribe ? "1" : "2", "content-type": "utf-8" }, body: { input: { tr_id: trId, tr_key: symbol } } });
}
export function parseFrame(raw: string, sessionId: string, nextSequence: () => number): MarketEvent[] {
  const parts = raw.split("|");
  if (parts.length !== 4 || parts[0] !== "0") throw new Error("unsupported frame");
  const fields = parts[1] === TRADE_TR ? tradeFields : parts[1] === BOOK_TR ? bookFields : null;
  const count = integer(parts[2], true);
  const values = parts[3]!.split("^");
  if (!fields || count > 100 || values.length !== count * fields.length) throw new Error("schema changed");
  const events: MarketEvent[] = [];
  for (let row = 0; row < count; row++) {
    const record = Object.fromEntries(fields.map((field, i) => [field, values[row * fields.length + i]!])) as Record<string, string>;
    const symbol = symbolSchema.parse(record.MKSC_SHRN_ISCD);
    const base = meta(symbol, sessionId, nextSequence());
    if (parts[1] === TRADE_TR) {
      const date = isoDate(record.BSOP_DATE);
      base.eventTimeMs = eventTime(date, record.STCK_CNTG_HOUR);
      if (base.eventTimeMs > base.receivedAtMs + 60_000) throw new Error("future event");
      const lastPrice = integer(record.STCK_PRPR, true);
      const change = signedNumber(record.PRDY_VRSS);
      const quote = quoteSchema.parse({ ...base, lastPrice, change, changePercent: signedNumber(record.PRDY_CTRT), previousClose: lastPrice - change, cumulativeVolume: digits.parse(record.ACML_VOL), timeBasis: "trade" });
      const trade = tradeSchema.parse({ ...base, price: lastPrice, quantity: integer(record.CNTG_VOL, true), aggressor: "unknown" });
      events.push({ type: "quote", payload: quote }, { type: "trade", payload: trade });
    } else {
      // Books have no business date: use the nearest receive-date candidate only within 10 minutes.
      const dates = [-1, 0, 1].map((offset) => kstDate(base.receivedAtMs + offset * 86_400_000));
      base.eventTimeMs = dates.map((date) => eventTime(date, record.BSOP_HOUR)).sort((a, b) => Math.abs(a - base.receivedAtMs) - Math.abs(b - base.receivedAtMs))[0]!;
      if (Math.abs(base.eventTimeMs - base.receivedAtMs) > 600_000) throw new Error("undated stale book");
      const levels = (prefix: "ASKP" | "BIDP") => Array.from({ length: 10 }, (_, i) => ({ price: integer(record[`${prefix}${i + 1}`]), quantity: integer(record[`${prefix}_RSQN${i + 1}`]) })).filter((level) => level.price > 0);
      events.push({ type: "orderbook", payload: orderBookSchema.parse({ ...base, kind: "snapshot", asks: levels("ASKP"), bids: levels("BIDP") }) });
    }
  }
  return events;
}
