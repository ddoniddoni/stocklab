import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import { DartError, fail } from "./errors.ts";
import { json, parse } from "./schema.ts";

export const MAX_RESPONSE_BYTES = 20 * 1024 * 1024;
export type Endpoint = "corpCode.xml" | "company.json" | "list.json" | "fnlttSinglAcntAll.json";
const statusSchema = z.object({ status: z.string().regex(/^\d{3}$/) });
export function businessStatus(input: unknown) {
  const { status } = parse(statusSchema, input);
  if (status === "000" || status === "013") return status;
  if (["010", "011", "012", "901"].includes(status)) fail("AUTH");
  if (status === "020") fail("RATE_LIMITED");
  if (["800", "900"].includes(status)) fail("UPSTREAM");
  fail("SCHEMA");
}

export class DartClient {
  private readonly key: string;
  private readonly signal: AbortSignal;
  private readonly timeoutMs: number;
  private readonly beforeRequest: () => Promise<void>;
  private lastRequestAt: number;

  constructor(options: {
    key: string; signal: AbortSignal; timeoutMs: number;
    lastRequestAt: number; beforeRequest: () => Promise<void>;
  }) {
    this.key = options.key;
    this.signal = options.signal;
    this.timeoutMs = options.timeoutMs;
    this.beforeRequest = options.beforeRequest;
    this.lastRequestAt = options.lastRequestAt;
  }

  async request<T>(endpoint: Endpoint, parameters: Record<string, string>, decode: (bytes: Uint8Array, empty: boolean) => T) {
    // Fixed origin and paths; callers never supply an arbitrary URL or credential.
    if ("crtfc_key" in parameters) fail("INVALID_INPUT");
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await delay(Math.max(0, this.lastRequestAt + 700 - Date.now()), undefined, { signal: this.signal });
        if (this.signal.aborted) fail("CANCELLED");
        await this.beforeRequest(); // Persist budget BEFORE making any request.
        this.lastRequestAt = Date.now();
        const result = await this.fetchOnce(endpoint, parameters);
        return { ...result, data: decode(result.bytes, result.empty) };
      } catch (error) {
        if (this.signal.aborted) fail("CANCELLED");
        const safe = error instanceof DartError ? error : new DartError("UPSTREAM");
        if (safe.code !== "UPSTREAM" || attempt === 2) throw safe;
        try { await delay(1000 * 2 ** attempt, undefined, { signal: this.signal }); }
        catch { fail("CANCELLED"); }
      }
    }
    return fail("UPSTREAM");
  }

  private async fetchOnce(endpoint: Endpoint, parameters: Record<string, string>) {
    const url = new URL(`https://opendart.fss.or.kr/api/${endpoint}`);
    url.search = new URLSearchParams({ ...parameters, crtfc_key: this.key }).toString();
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), this.timeoutMs);
    const signal = AbortSignal.any([this.signal, timeout.signal]);
    try {
      const response = await fetch(url, { signal, redirect: "error", cache: "no-store" });
      if (!response.ok) {
        await response.body?.cancel();
        if (response.status === 401 || response.status === 403) fail("AUTH");
        if (response.status === 429) fail("RATE_LIMITED");
        fail(response.status >= 500 ? "UPSTREAM" : "SCHEMA");
      }
      const length = Number(response.headers.get("content-length"));
      if (length > MAX_RESPONSE_BYTES) { await response.body?.cancel(); fail("TOO_LARGE"); }
      if (!response.body) fail("SCHEMA");
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_RESPONSE_BYTES) { await reader.cancel(); fail("TOO_LARGE"); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      const bytes = Buffer.concat(chunks);
      // Refuse to archive even a successful response if it echoes credentials.
      if (bytes.includes(this.key)) fail("SCHEMA");
      const empty = endpoint.endsWith(".json") && businessStatus(json(bytes)) === "013";
      return { bytes, empty, fetchedAt: new Date().toISOString() };
    } catch (error) {
      if (this.signal.aborted) fail("CANCELLED");
      if (error instanceof DartError) throw error;
      fail("UPSTREAM");
    } finally { clearTimeout(timer); }
  }
}
