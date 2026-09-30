import { z } from "zod";

export const metricKeys = [
  "revenue", "operatingProfit", "netProfit", "assets", "liabilities", "equity",
  "operatingCashFlow", "investingCashFlow", "financingCashFlow",
] as const;
export type MetricKey = (typeof metricKeys)[number];
export const metricLabels: Record<MetricKey, string> = {
  revenue: "매출", operatingProfit: "영업이익", netProfit: "당기순이익 · 기업 전체",
  assets: "자산", liabilities: "부채", equity: "자본",
  operatingCashFlow: "영업 현금흐름", investingCashFlow: "투자 현금흐름",
  financingCashFlow: "재무 현금흐름",
};
export const reportCodes = ["11013", "11012", "11014", "11011"] as const;
export type ReportCode = (typeof reportCodes)[number];
export type Basis = "CFS" | "OFS";
export type Quarter = 1 | 2 | 3 | 4;
export const basisLabels: Record<Basis, string> = { CFS: "연결", OFS: "별도" };
export const reportLabels: Record<ReportCode, string> = {
  "11013": "1분기보고서", "11012": "반기보고서", "11014": "3분기보고서", "11011": "사업보고서",
};

// This is an authored fixture contract, not an authenticated DART response.
// Real ingestion and company/corpCode mapping are a separate P2-B boundary.
export const companySchema = z.object({
  id: z.string().regex(/^fixture-company:\d{6}$/),
  name: z.string().min(1),
  symbol: z.string().regex(/^\d{6}$/),
  corpCode: z.null(),
  fiscalMonth: z.literal(12),
  source: z.literal("fixture"),
});
const sourceRowSchema = z.object({
  rowKey: z.string().min(1),
  sj_div: z.enum(["IS", "CIS", "BS", "CF", "SCE"]),
  account_id: z.string().min(1),
  account_nm: z.string().min(1),
  account_detail: z.string(),
  thstrm_amount: z.string().max(200).nullable(),
  thstrm_add_amount: z.string().max(200).nullable(),
  currency: z.literal("KRW"),
  // Explicit interpretation of this row's period, never inferred for CF.
  amountKind: z.enum(["annual", "quarter", "ytd", "instant", "unknown"]),
  profitScope: z.enum(["entity-total", "owners-of-parent"]).nullable(),
});
export const sourceReportSchema = z.object({
  id: z.string().startsWith("fixture-report:"),
  companyId: companySchema.shape.id,
  source: z.literal("fixture"),
  title: z.string().min(1),
  fiscalYear: z.number().int().min(2000).max(2100),
  reportCode: z.enum(reportCodes),
  basis: z.enum(["CFS", "OFS"]),
  currency: z.literal("KRW"),
  accountingStandard: z.literal("fixture-accounting"),
  fiscalMonth: z.literal(12),
  restatementKey: z.string().min(1),
  revision: z.number().int().positive(),
  reviewed: z.boolean(),
  publishedAt: z.iso.date(),
  receiptNumber: z.null(),
  originalUrl: z.null(),
  fetchedAt: z.null(),
  rows: z.array(sourceRowSchema).max(200),
}).refine((report) => new Set(report.rows.map((row) => row.rowKey)).size === report.rows.length,
  "원천 행 식별자가 중복되었습니다.");
export const fixtureDatasetSchema = z.object({
  source: z.literal("fixture"),
  generatedAt: z.iso.datetime(),
  revision: z.string().min(1),
  company: companySchema,
  reports: z.array(sourceReportSchema).max(100),
}).refine((data) =>
  new Set(data.reports.map((report) => report.id)).size === data.reports.length &&
  data.company.id === `fixture-company:${data.company.symbol}` &&
  data.reports.every((report) => report.companyId === data.company.id),
  "보고서 식별자 또는 회사가 일치하지 않습니다.");
export type Company = z.infer<typeof companySchema>;
export type SourceRow = z.infer<typeof sourceRowSchema>;
export type SourceReport = z.infer<typeof sourceReportSchema>;
export type FixtureDataset = z.infer<typeof fixtureDatasetSchema>;

export type FinancialEvidence = {
  reportId: string;
  title: string;
  revision: number;
  publishedAt: string;
  receiptNumber: null;
  originalUrl: null;
  rowKey: string;
  accountId: string;
  accountName: string;
  accountDetail: string;
  statement: SourceRow["sj_div"];
  amountKind: SourceRow["amountKind"];
  periodStart: string | null;
  periodEnd: string;
  rawAmount: string | null;
  rawYtdAmount: string | null;
};
export type FinancialMetric = {
  metric: MetricKey;
  value: string | null;
  ytdValue: string | null;
  currency: "KRW";
  basis: Basis;
  periodKind: "annual" | "quarter" | "instant";
  fiscalYear: number;
  quarter: Quarter | null;
  periodStart: string | null;
  periodEnd: string;
  source: "fixture";
  quality: "reported" | "derived" | "missing" | "ambiguous";
  profitScope: "entity-total" | null;
  reason: string | null;
  calculation: string | null;
  mapperVersion: string;
  fetchedAt: null;
  evidence: FinancialEvidence[];
};
export type FinancialColumn = {
  key: string;
  label: string;
  metrics: FinancialMetric[];
};
export type FinancialView = { basis: Basis; view: "annual" | "quarter"; year: number };
export type FinancialPageData = {
  company: Company;
  source: "fixture";
  generatedAt: string;
  datasetRevision: string;
  stale: boolean;
  columns: FinancialColumn[];
};
export type FixtureFiling = {
  id: string;
  title: string;
  source: "fixture";
  publishedAt: string;
  fiscalYear: number;
  reportCode: ReportCode;
  basis: Basis;
  revision: number;
  correction: boolean;
  selected: boolean;
  receiptNumber: null;
  originalUrl: null;
};

export interface FinancialRepository {
  getFinancials(symbol: string, view: FinancialView): Promise<FinancialPageData | null>;
  getFilings(symbol: string, year: number, basis: Basis): Promise<FixtureFiling[]>;
}
