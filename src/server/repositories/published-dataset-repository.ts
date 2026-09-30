import "server-only";
import { cache } from "react";
import { z } from "zod";
import { MAX_DATASET_BYTES, type ManifestEntry } from "@/domain/financials/published";
import { publicCacheConnection } from "@/lib/config";
import { CacheError, readPublishedJson, readSourceManifest, validatePublishedDataset } from "@/lib/published-files";

export const getSourceManifest = cache(readSourceManifest);

async function readRemote(entry: ManifestEntry, connection: { url: string; key: string }) {
  const query = new URLSearchParams({ select: "payload,payload_sha256", id: `eq.${entry.id}`, is_published: "eq.true", limit: "1" });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${connection.url}/rest/v1/published_datasets?${query}`, {
      headers: { apikey: connection.key, Accept: "application/json" },
      cache: "no-store", redirect: "error", signal: controller.signal,
    });
    if (!response.ok || !response.body || Number(response.headers.get("content-length")) > MAX_DATASET_BYTES + 2048)
      throw new CacheError("UPSTREAM_ERROR");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > MAX_DATASET_BYTES + 2048) { await reader.cancel(); throw new CacheError("UPSTREAM_ERROR"); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const parsed = z.array(z.object({ payload: z.unknown(), payload_sha256: z.string() }).strict()).max(1)
      .safeParse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks))));
    if (!parsed.success) throw new CacheError("UPSTREAM_ERROR");
    const row = parsed.data[0];
    if (!row) throw new CacheError("NOT_AVAILABLE");
    if (row.payload_sha256 !== entry.sha256) throw new CacheError("UPSTREAM_ERROR");
    return row.payload;
  } finally { clearTimeout(timer); }
}

// Bounded, reviewed catalog only. No DART client, refresh endpoint or private file fallback.
export const getPublishedDataset = cache(async (id: string) => {
  const manifest = await getSourceManifest();
  const entry = manifest.financials.datasets.find((item) => item.id === id);
  if (!entry) throw new CacheError("NOT_AVAILABLE");
  try {
    const connection = publicCacheConnection(process.env);
    const input = connection ? await readRemote(entry, connection) : await readPublishedJson(`${entry.id}.json`);
    return validatePublishedDataset(input, entry);
  } catch (error) {
    if (error instanceof CacheError) throw error;
    throw new CacheError("UPSTREAM_ERROR");
  }
});
export async function publishedEntries(symbol: string, year: number, basis: "CFS" | "OFS") {
  const manifest = await getSourceManifest();
  if (manifest.financials.source !== "opendart" || !manifest.financials.datasets.length) throw new CacheError("NOT_CONFIGURED");
  return manifest.financials.datasets.filter((entry) => entry.symbol === symbol && entry.year === year && entry.basis === basis)
    .sort((a, b) => b.revision - a.revision);
}
