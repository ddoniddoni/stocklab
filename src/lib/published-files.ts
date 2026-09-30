// Node-only shared code for the read repository and local publication tool.
// Never imports ingestion, environment files, or a privileged database client.
import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { MAX_DATASET_BYTES, publishedDatasetSchema, sourceManifestSchema, type ManifestEntry } from "../domain/financials/published.ts";

export class CacheError extends Error {
  readonly code: "NOT_CONFIGURED" | "NOT_AVAILABLE" | "UPSTREAM_ERROR";
  constructor(code: CacheError["code"]) {
    super({ NOT_CONFIGURED: "검토된 공개 재무 캐시가 아직 설정되지 않았습니다.",
      NOT_AVAILABLE: "선택한 기간·기준의 검토된 공개 자료가 없습니다.",
      UPSTREAM_ERROR: "공개 재무 캐시를 읽거나 확인하지 못했습니다. 잠시 후 다시 시도하세요." }[code]);
    this.code = code;
  }
}
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new CacheError("UPSTREAM_ERROR");
  return encoded;
}
export function contentHash(value: unknown) { return createHash("sha256").update(canonicalJson(value)).digest("hex"); }
export async function readPublishedJson(name: string, limit = MAX_DATASET_BYTES): Promise<unknown> {
  if (!/^(manifest|dart-[a-f0-9]{64})\.json$/.test(name)) throw new CacheError("UPSTREAM_ERROR");
  try {
    const root = resolve("data/published");
    const path = resolve(root, name);
    const actual = await realpath(path);
    if (!actual.startsWith(root + sep)) throw new CacheError("UPSTREAM_ERROR");
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > limit) throw new CacheError("UPSTREAM_ERROR");
    const bytes = await readFile(path);
    if (bytes.byteLength > limit) throw new CacheError("UPSTREAM_ERROR");
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch { throw new CacheError("UPSTREAM_ERROR"); }
}
export async function readSourceManifest() {
  const result = sourceManifestSchema.safeParse(await readPublishedJson("manifest.json", 256 * 1024));
  if (!result.success) throw new CacheError("UPSTREAM_ERROR");
  return result.data;
}
export function validatePublishedDataset(input: unknown, entry: ManifestEntry) {
  const result = publishedDatasetSchema.safeParse(input);
  if (!result.success) throw new CacheError("UPSTREAM_ERROR");
  const data = result.data;
  if (contentHash(data) !== entry.sha256 || data.id !== entry.id || data.company.symbol !== entry.symbol ||
    data.company.corpCode !== entry.corpCode || data.year !== entry.year || data.basis !== entry.basis ||
    data.revision !== entry.revision || Date.parse(data.publishedAt) > Date.now()) throw new CacheError("UPSTREAM_ERROR");
  return data;
}
