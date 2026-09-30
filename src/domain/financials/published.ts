import { z } from "zod";
import { getInstrument } from "../instruments.ts";
import { parseAmount } from "./amounts.ts";
import { metricKeys, reportCodes } from "./model.ts";

export const MAX_DATASET_BYTES = 1024 * 1024;
export const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
export const datasetIdSchema = z.string().regex(/^dart-[a-f0-9]{64}$/);
export const supportedSymbolSchema = z.string().regex(/^\d{6}$/).refine((value) => !!getInstrument(value));
export const publishedYearSchema = z.number().int().min(2015).max(2100);
const amount = z.string().regex(/^-?(?:0|[1-9]\d*)$/).max(100).nullable();
const text = z.string().trim().min(1).max(500);
const evidenceSchema = z.object({
  rowKey: z.string().regex(/^row-[1-9]\d*$/), statement: z.enum(["IS", "CIS", "BS", "CF"]),
  accountId: text, accountName: text, accountDetail: z.string().max(1000),
  rawAmount: z.string().max(200).nullable(), rawYtdAmount: z.string().max(200).nullable(),
}).strict();
const metricSchema = z.object({
  metric: z.enum(metricKeys), value: amount, ytdValue: amount,
  periodKind: z.enum(["annual", "quarter", "ytd", "instant"]),
  periodStart: z.iso.date().nullable(), periodEnd: z.iso.date(),
  profitScope: z.literal("entity-total").nullable(),
  quality: z.enum(["reported", "missing"]), reason: text.nullable(),
  evidence: evidenceSchema.nullable(),
}).strict();
const reportSchema = z.object({
  title: text, reportCode: z.enum(reportCodes), receiptNumber: z.string().regex(/^\d{14}$/),
  originalUrl: z.string().regex(/^https:\/\/dart\.fss\.or\.kr\/dsaf001\/main\.do\?rcpNo=\d{14}$/),
  filedDate: z.iso.date(), payloadHash: sha256Schema, fetchedAt: z.iso.datetime(),
  accountingStandard: text, restatementKey: text,
  periodStart: z.iso.date(), periodEnd: z.iso.date(),
  metrics: z.array(metricSchema).length(metricKeys.length),
}).strict();
export const publishedDatasetSchema = z.object({
  schemaVersion: z.literal(1), id: datasetIdSchema, source: z.literal("opendart"),
  publicationStatus: z.literal("published"), revision: z.number().int().positive().max(1000000),
  year: publishedYearSchema, basis: z.enum(["CFS", "OFS"]), currency: z.literal("KRW"),
  company: z.object({ symbol: supportedSymbolSchema, corpCode: z.string().regex(/^\d{8}$/), name: text,
    fiscalMonth: z.literal(12) }).strict(),
  fetchedAt: z.iso.datetime(), reviewedAt: z.iso.datetime(), publishedAt: z.iso.datetime(),
  mapperVersion: z.literal("dart-reviewed-rows-1.0.0"),
  provenance: z.object({ candidateHash: sha256Schema, reviewHash: sha256Schema,
    sourceHashes: z.array(sha256Schema).min(3).max(1000) }).strict(),
  reports: z.array(reportSchema).min(1).max(4),
}).strict().superRefine((data, context) => {
  const fail = () => context.addIssue({ code: "custom", message: "공개 자료의 원천·기간·검토 기록이 일치하지 않습니다." });
  if (data.year > new Date().getUTCFullYear() || Date.parse(data.fetchedAt) > Date.parse(data.reviewedAt) || Date.parse(data.reviewedAt) > Date.parse(data.publishedAt) ||
    new Set(data.reports.map((report) => report.reportCode)).size !== data.reports.length ||
    new Set(data.provenance.sourceHashes).size !== data.provenance.sourceHashes.length) fail();
  for (const report of data.reports) {
    const index = reportCodes.indexOf(report.reportCode);
    const end = `${data.year}-${["03-31", "06-30", "09-30", "12-31"][index]}`;
    if (report.originalUrl !== `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${report.receiptNumber}` ||
      report.periodStart !== `${data.year}-01-01` || report.periodEnd !== end ||
      !data.provenance.sourceHashes.includes(report.payloadHash) ||
      Date.parse(report.fetchedAt) < Date.parse(data.fetchedAt) ||
      Date.parse(report.fetchedAt) > Date.parse(data.reviewedAt) ||
      report.periodEnd > report.filedDate || report.filedDate > report.fetchedAt.slice(0, 10) ||
      new Set(report.metrics.map((metric) => metric.metric)).size !== metricKeys.length) fail();
    const rows = report.metrics.flatMap((metric) => metric.evidence ? [metric.evidence.rowKey] : []);
    if (new Set(rows).size !== rows.length) fail();
    for (const metric of report.metrics) {
      const balance = ["assets", "liabilities", "equity"].includes(metric.metric);
      const cash = metric.metric.endsWith("CashFlow");
      const annual = report.reportCode === "11011";
      const kind = balance ? "instant" : annual ? "annual" : cash ? "ytd" : "quarter";
      const start = balance ? null : !annual && !cash ? `${data.year}-${["01-01", "04-01", "07-01"][index]}` : `${data.year}-01-01`;
      if (metric.periodKind !== kind || metric.periodStart !== start || metric.periodEnd !== end ||
        metric.profitScope !== (metric.metric === "netProfit" ? "entity-total" : null) ||
        (metric.value === null ? metric.quality !== "missing" || !metric.reason : metric.quality !== "reported" || !metric.evidence)) fail();
      const evidence = metric.evidence;
      if (evidence && ((balance ? evidence.statement !== "BS" : cash ? evidence.statement !== "CF" : !["IS", "CIS"].includes(evidence.statement)) ||
        parseAmount(evidence.rawAmount).value !== metric.value ||
        (!annual && !balance && !cash ? parseAmount(evidence.rawYtdAmount).value !== metric.ytdValue : metric.ytdValue !== null))) fail();
      if (!evidence && (metric.value !== null || metric.ytdValue !== null)) fail();
    }
  }
});
export type PublishedDataset = z.infer<typeof publishedDatasetSchema>;
export const manifestEntrySchema = z.object({
  id: datasetIdSchema, sha256: sha256Schema, symbol: supportedSymbolSchema,
  corpCode: z.string().regex(/^\d{8}$/), year: publishedYearSchema,
  basis: z.enum(["CFS", "OFS"]), revision: z.number().int().positive().max(1000000),
}).strict();
export type ManifestEntry = z.infer<typeof manifestEntrySchema>;
export const sourceManifestSchema = z.object({
  schemaVersion: z.literal(1),
  market: z.object({ source: z.literal("synthetic"), generatorVersion: z.literal("1.1.0"),
    scenarioId: z.literal("balanced-session"), containsRecordedKisData: z.literal(false) }).strict(),
  financials: z.object({ source: z.enum(["fixture", "opendart"]), datasets: z.array(manifestEntrySchema).max(500) }).strict(),
}).strict().superRefine((manifest, context) => {
  const entries = manifest.financials.datasets;
  const unique = (keys: string[]) => new Set(keys).size === keys.length;
  if ((manifest.financials.source === "fixture" && entries.length > 0) || !unique(entries.map((entry) => entry.id)) ||
    !unique(entries.map((entry) => `${entry.symbol}:${entry.year}:${entry.basis}:${entry.revision}`)) ||
    entries.some((entry) => entries.some((other) =>
      (entry.symbol === other.symbol) !== (entry.corpCode === other.corpCode))))
    context.addIssue({ code: "custom", message: "출처 목록에 중복 또는 회사 식별자 충돌이 있습니다." });
});
export type SourceManifest = z.infer<typeof sourceManifestSchema>;
