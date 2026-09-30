import { z } from "zod";
import { setTimeout as delay } from "node:timers/promises";
import { historyQuerySchema, localHistorySchema, symbolSchema } from "../../src/domain/local-market.ts";
import { quoteSchema, type Candle } from "../../src/domain/market.ts";
import type { BridgeConfig } from "./config.ts";
import { decimal, digits, integer, isoDate, kstDate, meta, REST_ORIGIN, signedNumber } from "./protocol.ts";

const envelope = z.object({ rt_cd: z.literal("0") });
const quoteResponse = envelope.extend({ output: z.object({ stck_prpr: digits, prdy_vrss: decimal, prdy_ctrt: decimal, acml_vol: digits }) });
const historyResponse = envelope.extend({ output2: z.array(z.object({ stck_bsop_date: z.string(), stck_oprc: digits, stck_hgpr: digits, stck_lwpr: digits, stck_clpr: digits, acml_vol: digits })).max(100) });
export class KisRest {
  private config: BridgeConfig;
  private tail: Promise<unknown> = Promise.resolve();
  private queued = 0;
  private nextAt = 0;
  private cooldown = 0;
  private token: { value: string; expiresAt: number } | undefined;
  private tokenFlight: Promise<string> | undefined;
  private approvalFlight: Promise<string> | undefined;
  private approval: string | undefined;
  private approvalAt = 0;
  private lifetime = new AbortController();
  constructor(config: BridgeConfig) { this.config = config; }
  private async request(path: string, init: RequestInit, signal?: AbortSignal): Promise<unknown> {
    if (this.queued >= 24 || Date.now() < this.cooldown) throw new Error("busy");
    this.queued++;
    const run = this.tail.then(async () => {
      const combined = AbortSignal.any([this.lifetime.signal, ...(signal ? [signal] : [])]);
      combined.throwIfAborted();
      await delay(Math.max(0, this.nextAt - Date.now()), undefined, { signal: combined });
      combined.throwIfAborted();
      if (Date.now() < this.cooldown) throw new Error("cooldown");
      this.nextAt = Date.now() + Math.ceil(1000 / this.config.KIS_REST_RPS);
      const response = await fetch(`${REST_ORIGIN}${path}`, { ...init, redirect: "error", cache: "no-store", signal: AbortSignal.any([combined, AbortSignal.timeout(15_000)]) });
      if (!response.ok) {
        this.cooldown = Date.now() + 60_000;
        if (response.status === 401) this.token = undefined;
        await response.body?.cancel();
        throw new Error("upstream unavailable");
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("empty response");
      const chunks: Uint8Array[] = []; let size = 0;
      try {
        for (;;) {
          const chunk = await reader.read(); if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > 512 * 1024) throw new Error("response too large");
          chunks.push(chunk.value);
        }
      } finally { await reader.cancel(); reader.releaseLock(); }
      const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (value && typeof value === "object" && "rt_cd" in value && value.rt_cd !== "0") {
        // Provider messages can include sensitive context. Do not forward or log them.
        this.cooldown = Date.now() + 60_000;
        throw new Error("provider rejected request");
      }
      return value;
    });
    this.tail = run.catch(() => {});
    try { return await run; } finally { this.queued--; }
  }
  private async accessToken() {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    if (!this.tokenFlight) this.tokenFlight = (async () => {
      const value = z.object({ access_token: z.string().min(1), access_token_token_expired: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/) }).parse(await this.request("/oauth2/tokenP", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ grant_type: "client_credentials", appkey: this.config.KIS_APP_KEY, appsecret: this.config.KIS_APP_SECRET }),
      }));
      const expiresAt = Date.parse(`${value.access_token_token_expired.replace(" ", "T")}+09:00`);
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() + 60_000) throw new Error("expired token");
      this.token = { value: value.access_token, expiresAt }; return value.access_token;
    })().catch(() => { this.cooldown = Date.now() + 60_000; throw new Error("authentication unavailable"); }).finally(() => { this.tokenFlight = undefined; });
    return this.tokenFlight;
  }
  async approvalKey() {
    if (this.approval && Date.now() - this.approvalAt < 23 * 3_600_000) return this.approval;
    if (!this.approvalFlight) this.approvalFlight = (async () => {
      const response = z.object({ approval_key: z.string().min(1) }).parse(await this.request("/oauth2/Approval", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ grant_type: "client_credentials", appkey: this.config.KIS_APP_KEY, secretkey: this.config.KIS_APP_SECRET }),
      }));
      this.approval = response.approval_key; this.approvalAt = Date.now(); return this.approval;
    })().catch(() => { this.cooldown = Date.now() + 60_000; throw new Error("approval unavailable"); }).finally(() => { this.approvalFlight = undefined; });
    return this.approvalFlight;
  }
  private async get(path: string, trId: string, params: Record<string, string>, signal: AbortSignal) {
    signal.throwIfAborted();
    const token = await this.accessToken();
    return this.request(`${path}?${new URLSearchParams(params)}`, { headers: { authorization: `Bearer ${token}`, appkey: this.config.KIS_APP_KEY, appsecret: this.config.KIS_APP_SECRET, tr_id: trId, custtype: "P", "content-type": "application/json; charset=utf-8" } }, signal);
  }
  async quote(symbolInput: string, signal: AbortSignal) {
    const symbol = symbolSchema.parse(symbolInput);
    const { output } = quoteResponse.parse(await this.get("/uapi/domestic-stock/v1/quotations/inquire-price", "FHKST01010100", { FID_COND_MRKT_DIV_CODE: "J", FID_INPUT_ISCD: symbol }, signal));
    const lastPrice = integer(output.stck_prpr, true); const change = signedNumber(output.prdy_vrss);
    return quoteSchema.parse({ ...meta(symbol, "rest-snapshot", 0), lastPrice, previousClose: lastPrice - change, change, changePercent: signedNumber(output.prdy_ctrt), cumulativeVolume: output.acml_vol, timeBasis: "retrieved" });
  }
  async history(input: unknown, signal: AbortSignal) {
    const query = historyQuerySchema.parse(input);
    if (query.to > kstDate(Date.now())) throw new Error("future date");
    const candles = new Map<string, Candle>();
    const warnings = ["KRX 원주가 일봉입니다. 거래정지·휴장·미제공 기간의 완전성은 보장하지 않습니다."];
    let completed = 0;
    // At most 90 calendar days per call, below the documented 100-record limit.
    for (let start = Date.parse(query.from); start <= Date.parse(query.to); start += 90 * 86_400_000) {
      signal.throwIfAborted();
      const from = new Date(start).toISOString().slice(0, 10);
      const to = new Date(Math.min(start + 89 * 86_400_000, Date.parse(query.to))).toISOString().slice(0, 10);
      try {
        const { output2 } = historyResponse.parse(await this.get("/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice", "FHKST03010100", { FID_COND_MRKT_DIV_CODE: "J", FID_INPUT_ISCD: query.symbol, FID_INPUT_DATE_1: from.replaceAll("-", ""), FID_INPUT_DATE_2: to.replaceAll("-", ""), FID_PERIOD_DIV_CODE: "D", FID_ORG_ADJ_PRC: "1" }, signal));
        const batch = output2.map((row) => ({ time: { kind: "trading-date" as const, date: isoDate(row.stck_bsop_date) }, open: integer(row.stck_oprc, true), high: integer(row.stck_hgpr, true), low: integer(row.stck_lwpr, true), close: integer(row.stck_clpr, true), volume: row.acml_vol }));
        localHistorySchema.parse({ source: "kis-private", adjustment: "raw", completeness: "partial", warnings: [], candles: batch });
        for (const candle of batch) {
          if (candle.time.date < from || candle.time.date > to || candles.has(candle.time.date)) throw new Error("unexpected date");
        }
        for (const candle of batch) candles.set(candle.time.date, candle);
        completed++;
      } catch {
        signal.throwIfAborted();
        if (!completed) throw new Error("history unavailable");
        warnings.push("조회 도중 오류가 발생하여 일부 기간만 표시합니다."); break;
      }
    }
    return localHistorySchema.parse({ source: "kis-private", adjustment: "raw", completeness: "partial", warnings, candles: [...candles.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, candle]) => candle) });
  }
  dispose() { this.lifetime.abort(); this.token = undefined; this.approval = undefined; }
}
