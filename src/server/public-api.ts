import "server-only";
import { z } from "zod";
import { reportCodes } from "@/domain/financials/model";
import { CacheError } from "@/lib/published-files";
import { getPublicConfig } from "@/server/config";
import { getPublishedDataset, getSourceManifest, publishedEntries } from "./repositories/published-dataset-repository";
import { STALE_CACHE_MS } from "./repositories/published-financial-repository";

const codes = { INVALID_INPUT: [400, "요청 형식이나 조회 범위를 확인하세요."], NOT_SUPPORTED: [404, "지원하지 않는 회사입니다."],
  NOT_CONFIGURED: [503, "검토된 공개 재무 캐시가 아직 설정되지 않았습니다."],
  NOT_AVAILABLE: [404, "선택한 조건의 검토된 공개 자료가 없습니다."],
  UPSTREAM_ERROR: [503, "공개 재무 캐시를 읽거나 확인하지 못했습니다."] } as const;
class InputError extends Error {
  readonly code: keyof typeof codes;
  constructor(code: keyof typeof codes) { super(codes[code][1]); this.code = code; }
}
export const safeHeaders = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow" };
export function publicSuccess(data: unknown, meta: { source: "opendart" | "fixture" | "synthetic"; fetchedAt: string | null; stale: boolean; warnings: string[] }) {
  // No cookies or personal state. Avoid caching a publication after withdrawal.
  return Response.json({ ok: true, data, meta }, { headers: safeHeaders });
}
export async function publicRoute(action: () => Promise<Response>) {
  try { return await action(); }
  catch (error) {
    const code = error instanceof InputError || error instanceof CacheError ? error.code : "UPSTREAM_ERROR";
    return Response.json({ ok: false, error: { code, message: codes[code][1], retryable: code === "UPSTREAM_ERROR",
      requestId: crypto.randomUUID() } }, { status: codes[code][0], headers: safeHeaders });
  }
}
export function queryParameters(request: Request, allowed: string[]) {
  const url = new URL(request.url);
  if (url.search.length > 300 || [...url.searchParams.keys()].some((key) => !allowed.includes(key) || url.searchParams.getAll(key).length !== 1))
    throw new InputError("INVALID_INPUT");
  return Object.fromEntries(url.searchParams);
}
const financialQuery = z.object({
  year: z.string().regex(/^\d{4}$/).transform(Number).refine((value) => value >= 2015 && value <= new Date().getUTCFullYear()),
  basis: z.enum(["CFS", "OFS"]), report: z.enum(reportCodes),
}).strict();
export function reportQuery(request: Request) {
  const parsed = financialQuery.safeParse(queryParameters(request, ["year", "basis", "report"]));
  if (!parsed.success) throw new InputError("INVALID_INPUT");
  return parsed.data;
}
export async function supportedCompany(corpCode: string) {
  if (!/^\d{8}$/.test(corpCode)) throw new InputError("INVALID_INPUT");
  if (getPublicConfig().financialMode !== "dart-cache") throw new InputError("NOT_CONFIGURED");
  const manifest = await getSourceManifest();
  if (manifest.financials.source !== "opendart" || !manifest.financials.datasets.length) throw new InputError("NOT_CONFIGURED");
  const entries = manifest.financials.datasets.filter((entry) => entry.corpCode === corpCode);
  if (!entries.length) throw new InputError("NOT_SUPPORTED");
  return entries;
}
export async function companyResponse(corpCode: string, request: Request) {
  queryParameters(request, []);
  const entries = await supportedCompany(corpCode);
  const entry = entries.sort((a, b) => b.year - a.year || b.revision - a.revision)[0]!;
  const data = await getPublishedDataset(entry.id);
  return publicSuccess(data.company, metadata(data.fetchedAt));
}
export async function financialResponse(corpCode: string, request: Request) {
  const query = reportQuery(request);
  const company = await supportedCompany(corpCode);
  const entry = (await publishedEntries(company[0]!.symbol, query.year, query.basis))[0];
  if (!entry) throw new InputError("NOT_AVAILABLE");
  const data = await getPublishedDataset(entry.id);
  const report = data.reports.find((item) => item.reportCode === query.report);
  if (!report) throw new InputError("NOT_AVAILABLE");
  return publicSuccess({ datasetId: data.id, revision: data.revision, company: data.company, year: data.year,
    basis: data.basis, currency: "KRW", mapperVersion: data.mapperVersion, reviewedAt: data.reviewedAt,
    publishedAt: data.publishedAt, report }, metadata(report.fetchedAt));
}
export async function filingsResponse(corpCode: string, request: Request) {
  const query = queryParameters(request, ["page"]);
  if (query.page !== undefined && !/^[1-9]\d?$/.test(query.page)) throw new InputError("INVALID_INPUT");
  const page = Number(query.page ?? 1);
  const entries = (await supportedCompany(corpCode)).sort((a, b) => b.year - a.year || b.revision - a.revision || a.id.localeCompare(b.id));
  // Five report bundles, each <=4 reports, bounded to <=20 entries per page.
  const batch = entries.slice((page - 1) * 5, page * 5);
  const datasets = await Promise.all(batch.map((entry) => getPublishedDataset(entry.id)));
  const items = datasets.flatMap((data) => data.reports.map((report) => ({ datasetId: data.id,
    title: report.title, receiptNumber: report.receiptNumber, originalUrl: report.originalUrl, filedDate: report.filedDate,
    year: data.year, basis: data.basis, reportCode: report.reportCode, revision: data.revision, fetchedAt: report.fetchedAt })));
  const fetchedAt = datasets.map((data) => data.fetchedAt).sort()[0] ?? null;
  const meta = metadata(fetchedAt);
  return publicSuccess({ items, page, pageSize: 20, hasMore: entries.length > page * 5 }, {
    ...meta, warnings: [...meta.warnings, "검토된 캐시에 포함된 보고서만 표시합니다. 전체 DART 공시 목록이 아니며 기준·버전별 같은 접수번호가 포함될 수 있습니다."] });
}
function metadata(fetchedAt: string | null) {
  const stale = fetchedAt !== null && Date.now() - Date.parse(fetchedAt) > STALE_CACHE_MS;
  return { source: "opendart" as const, fetchedAt, stale,
    warnings: stale ? ["수집 후 30일이 지난 캐시입니다. 최신 공시는 원문에서 확인하세요."] : [] };
}
