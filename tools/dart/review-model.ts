import { z } from "zod";
import { parseAmount } from "../../src/domain/financials/amounts.ts";
import { fail } from "./errors.ts";
import { codes, hashSchema, metrics, receiptSchema, runIdSchema } from "./schema.ts";
import type { Candidate, CollectedReport } from "./collect.ts";

const integer = z.string().regex(/^-?(?:0|[1-9]\d*)$/).max(100).nullable();
const reviewMetricSchema = z.object({
  rowKey: z.string().regex(/^row-[1-9]\d*$/).nullable(),
  amountKind: z.enum(["annual", "quarter", "ytd", "instant", "unknown"]),
  expectedAmount: integer, expectedYtdAmount: integer,
  profitScope: z.enum(["entity-total", "owners-of-parent"]).nullable(),
  tableReference: z.string().max(500), missingReason: z.string().max(500),
}).strict();
const reportReviewSchema = z.object({
  payloadHash: hashSchema, receiptNumber: receiptSchema,
  fiscalYear: z.number().int(), reportCode: z.enum(codes), basis: z.enum(["CFS", "OFS"]),
  originalChecked: z.literal(true), basisConfirmed: z.literal(true), periodConfirmed: z.literal(true),
  accountingStandard: z.string().trim().min(1).max(100),
  restatementKey: z.string().trim().min(1).max(100),
  periodStart: z.iso.date(), periodEnd: z.iso.date(),
  metrics: z.record(z.enum(metrics), reviewMetricSchema),
}).strict();
const reviewSchema = z.object({
  schemaVersion: z.literal(1), runId: runIdSchema, candidateHash: hashSchema,
  reviewer: z.string().trim().min(1).max(100), reviewedAt: z.iso.datetime(),
  companyConfirmed: z.literal(true), reports: z.array(reportReviewSchema).min(1).max(4),
}).strict();
type ReportReview = z.infer<typeof reportReviewSchema>;

export function reviewTemplate(candidate: Candidate, runId: string, candidateHash: string) {
  return {
    schemaVersion: 1, runId, candidateHash, reviewer: "", reviewedAt: "", companyConfirmed: false,
    reports: candidate.reports.map((report) => ({
      payloadHash: report.payloadHash, receiptNumber: report.receiptNumber,
      fiscalYear: report.fiscalYear, reportCode: report.reportCode, basis: report.basis,
      originalChecked: false, basisConfirmed: false, periodConfirmed: false,
      accountingStandard: "", restatementKey: "", periodStart: "", periodEnd: "",
      metrics: Object.fromEntries(metrics.map((metric) => [metric, {
        rowKey: null, amountKind: "unknown", expectedAmount: null, expectedYtdAmount: null,
        profitScope: null, tableReference: "", missingReason: "",
      }])),
    })),
  };
}

function normalizedMetrics(report: CollectedReport, review: ReportReview) {
  const usedRows = new Set<string>();
  return metrics.map((metric) => {
    const selection = review.metrics[metric];
    const balance = ["assets", "liabilities", "equity"].includes(metric);
    const cash = metric.endsWith("CashFlow");
    const annual = report.reportCode === "11011";
    const periodKind = balance ? "instant" : annual ? "annual" : cash ? "ytd" : "quarter";
    const quarterIndex = codes.indexOf(report.reportCode);
    const periodStart = balance ? null : !annual && !cash
      ? `${report.fiscalYear}-${["01-01", "04-01", "07-01"][quarterIndex]}`
      : review.periodStart;
    const common = {
      metric, basis: report.basis, currency: "KRW" as const, source: "opendart" as const,
      fiscalYear: report.fiscalYear, quarter: annual ? null : quarterIndex + 1,
      periodKind, periodStart, periodEnd: review.periodEnd,
      profitScope: metric === "netProfit" ? "entity-total" as const : null,
      mapperVersion: "dart-reviewed-rows-1.0.0", fetchedAt: report.fetchedAt,
    };
    if (selection.rowKey === null) {
      if (!selection.missingReason.trim() || selection.expectedAmount !== null ||
        selection.expectedYtdAmount !== null || selection.amountKind !== "unknown" ||
        selection.profitScope !== null) fail("REVIEW_REQUIRED");
      return { ...common, value: null, ytdValue: null, quality: "missing" as const,
        reason: selection.missingReason, evidence: null };
    }
    if (usedRows.has(selection.rowKey)) fail("REVIEW_REQUIRED");
    usedRows.add(selection.rowKey);
    const row = report.rows.find((item) => item.rowKey === selection.rowKey);
    if (!row || row.currency !== "KRW" || !selection.tableReference.trim() ||
      selection.amountKind !== periodKind ||
      (metric === "netProfit" ? selection.profitScope !== "entity-total" : selection.profitScope !== null) ||
      (balance ? row.sj_div !== "BS" : cash ? row.sj_div !== "CF" : !["IS", "CIS"].includes(row.sj_div)))
      fail("REVIEW_REQUIRED");
    const amount = parseAmount(row.thstrm_amount);
    const ytd = !annual && !balance && !cash ? parseAmount(row.thstrm_add_amount).value : null;
    if (amount.value !== selection.expectedAmount || ytd !== selection.expectedYtdAmount)
      fail("REVIEW_REQUIRED");
    return {
      ...common, value: amount.value, ytdValue: ytd,
      quality: amount.value === null ? "missing" as const : "reported" as const,
      reason: amount.reason,
      evidence: {
        payloadHash: report.payloadHash, receiptNumber: report.receiptNumber, originalUrl: report.originalUrl,
        rowKey: row.rowKey, statement: row.sj_div, accountId: row.account_id,
        accountName: row.account_nm, accountDetail: row.account_detail,
        rawAmount: row.thstrm_amount ?? null, rawYtdAmount: row.thstrm_add_amount ?? null,
        sourcePeriodName: row.thstrm_nm, tableReference: selection.tableReference,
      },
    };
  });
}

export function reviewedDataset(candidate: Candidate, input: unknown, runId: string, candidateHash: string) {
  const result = reviewSchema.safeParse(input);
  if (!result.success) fail("REVIEW_REQUIRED");
  const review = result.data;
  if (review.runId !== runId || review.candidateHash !== candidateHash || candidate.company.fiscalMonth !== 12 ||
      review.reports.length !== candidate.reports.length ||
      new Set(review.reports.map((item) => item.payloadHash)).size !== review.reports.length ||
      Date.parse(review.reviewedAt) > Date.now() ||
      [candidate.company.indexArtifact, candidate.company.companyArtifact, ...candidate.filingArtifacts,
        ...candidate.reports.map((report) => ({ fetchedAt: report.fetchedAt }))]
        .some((artifact) => Date.parse(review.reviewedAt) < Date.parse(artifact.fetchedAt))) fail("REVIEW_REQUIRED");

  const reports = candidate.reports.map((report) => {
    const item = review.reports.find((entry) => entry.payloadHash === report.payloadHash);
    const expectedEnd = `${report.fiscalYear}-${["03-31", "06-30", "09-30", "12-31"][codes.indexOf(report.reportCode)]}`;
    if (!item || !report.filing || /[철정]/.test(report.filing.rm) ||
      item.receiptNumber !== report.receiptNumber || item.basis !== report.basis ||
      item.fiscalYear !== report.fiscalYear || item.reportCode !== report.reportCode ||
      item.periodStart !== `${report.fiscalYear}-01-01` || item.periodEnd !== expectedEnd)
      fail("REVIEW_REQUIRED");
    // The overall period is checked against the original report, not guessed from
    // API amount names. Interim IS/CIS amounts still refer to THREE MONTHS.
    return {
      id: `dart:${candidate.company.corpCode}:${report.fiscalYear}:${report.reportCode}:${report.basis}:${report.receiptNumber}:${report.payloadHash}`,
      title: report.filing.report_nm, source: "opendart" as const,
      fiscalYear: report.fiscalYear, reportCode: report.reportCode, basis: report.basis,
      receiptNumber: report.receiptNumber, originalUrl: report.originalUrl,
      payloadHash: report.payloadHash, fetchedAt: report.fetchedAt,
      accountingStandard: item.accountingStandard, fiscalMonth: candidate.company.fiscalMonth,
      restatementKey: item.restatementKey, periodStart: item.periodStart, periodEnd: item.periodEnd,
      metrics: normalizedMetrics(report, item),
    };
  });
  return {
    schemaVersion: 1, source: "opendart", publicationStatus: "reviewed-local", publishedAt: null,
    candidateHash, collectorVersion: candidate.collectorVersion, mapperVersion: "dart-reviewed-rows-1.0.0",
    review: { reviewer: review.reviewer, reviewedAt: review.reviewedAt },
    company: {
      corpCode: candidate.company.corpCode, symbol: candidate.company.symbol,
      name: candidate.company.name, fiscalMonth: candidate.company.fiscalMonth,
      corpClass: candidate.company.corpClass,
    },
    sourceArtifacts: {
      index: candidate.company.indexArtifact, company: candidate.company.companyArtifact,
      filings: candidate.filingArtifacts,
    },
    reports,
    filings: candidate.filings.map((filing) => ({
      receiptNumber: filing.rcept_no, title: filing.report_nm, filedDate: filing.rcept_dt,
      originalUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${filing.rcept_no}`,
      remarks: filing.rm, source: "opendart",
    })),
    unavailable: candidate.unavailable,
  };
}
