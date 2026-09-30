import { corporation } from "./corporations.ts";
import { fail } from "./errors.ts";
import { filingWindows, validatePlan } from "./options.ts";
import {
  companySchema, filingPageSchema, financialSchema, json, originalUrl, parse,
  type Artifact, type Filing, type Plan, type Row,
} from "./schema.ts";
import type { Endpoint } from "./client.ts";

export type ReadTask = <T>(name: string, endpoint: Endpoint, parameters: Record<string, string>,
  decode: (bytes: Uint8Array, empty: boolean) => T) => Promise<{ artifact: Artifact; data: T }>;
export type CollectedReport = {
  source: "opendart"; fiscalYear: number; reportCode: Plan["reports"][number]; basis: Plan["basis"];
  receiptNumber: string; originalUrl: string; filing: Filing | null;
  payloadHash: string; fetchedAt: string; rows: (Row & { rowKey: string })[];
};
export type Candidate = Awaited<ReturnType<typeof collect>>;

// Used for both collection and offline replay. Export reconstructs this candidate
// from the saved requests instead of trusting a manually edited source tag.
export async function collect(plan: Plan, task: ReadTask) {
  validatePlan(plan);
  const index = await task("corp-index", "corpCode.xml", {}, (bytes) => corporation(bytes, plan.symbol));
  const corpCode = index.data.corp_code;
  const company = await task("company", "company.json", { corp_code: corpCode }, (bytes, empty) => {
    if (empty) fail("SCHEMA");
    const result = parse(companySchema, json(bytes));
    if (result.stock_code !== plan.symbol || result.corp_cls === "E") fail("SCHEMA");
    return result;
  });
  const filings = new Map<string, Filing>();
  const filingArtifacts: Artifact[] = [];
  for (const window of filingWindows(plan)) {
    let page = 1;
    let totalPages = 1;
    do {
      const result = await task(`filings-${window.from}-${page}`, "list.json", {
        corp_code: corpCode, bgn_de: window.from, end_de: window.to,
        last_reprt_at: "N", pblntf_ty: "A", sort: "date", sort_mth: "asc",
        page_no: String(page), page_count: "100",
      }, (bytes, empty) => {
        if (empty) return { list: [], total_page: 0 };
        const parsed = parse(filingPageSchema, json(bytes));
        if (parsed.page_no !== page || parsed.page_count !== 100 ||
          parsed.total_page < page || parsed.list.length === 0 || parsed.list.some((filing) =>
            filing.corp_code !== corpCode ||
            (filing.stock_code !== "" && filing.stock_code !== plan.symbol) ||
            filing.rcept_dt < window.from || filing.rcept_dt > window.to)) fail("SCHEMA");
        return parsed;
      });
      // A changing total is not a consistent snapshot. Start a fresh run later.
      if (page > 1 && result.data.total_page !== totalPages) fail("SCHEMA");
      totalPages = result.data.total_page;
      for (const filing of result.data.list) {
        if (filings.has(filing.rcept_no)) fail("SCHEMA");
        filings.set(filing.rcept_no, filing);
      }
      filingArtifacts.push(result.artifact);
      page++;
    } while (page <= totalPages);
  }
  const reports: CollectedReport[] = [];
  const unavailable: { reportCode: Plan["reports"][number]; basis: Plan["basis"]; artifact: Artifact; reason: string }[] = [];
  for (const code of plan.reports) {
    const result = await task(`financial-${code}`, "fnlttSinglAcntAll.json", {
      corp_code: corpCode, bsns_year: String(plan.year), reprt_code: code, fs_div: plan.basis,
    }, (bytes, empty) => {
      if (empty) return [];
      const rows = parse(financialSchema, json(bytes)).list;
      if (rows.some((row) => row.corp_code !== corpCode || row.bsns_year !== String(plan.year) ||
        row.reprt_code !== code || (row.fs_div !== undefined && row.fs_div !== plan.basis)) ||
        new Set(rows.map((row) => row.rcept_no)).size !== 1) fail("SCHEMA");
      return rows;
    });
    if (result.artifact.empty) {
      unavailable.push({ reportCode: code, basis: plan.basis, artifact: result.artifact, reason: "DART 조회 결과 없음(013)" });
      continue;
    }
    const receipt = result.data[0]!.rcept_no;
    reports.push({
      source: "opendart", fiscalYear: plan.year, reportCode: code, basis: plan.basis,
      receiptNumber: receipt, originalUrl: originalUrl(receipt), filing: filings.get(receipt) ?? null,
      payloadHash: result.artifact.hash, fetchedAt: result.artifact.fetchedAt,
      rows: result.data.map((row, i) => ({ ...row, rowKey: `row-${i + 1}` })),
    });
  }
  return {
    schemaVersion: 1 as const, source: "opendart" as const, collectorVersion: "dart-collector-1.0.0",
    publicationStatus: "unreviewed" as const, plan,
    company: {
      corpCode, symbol: plan.symbol, name: company.data.corp_name,
      corpClass: company.data.corp_cls, fiscalMonth: Number(company.data.acc_mt),
      indexName: index.data.corp_name, indexModifiedAt: index.data.modify_date,
      indexArtifact: index.artifact, companyArtifact: company.artifact,
    },
    filingArtifacts,
    filings: [...filings.values()].sort((a, b) => a.rcept_no.localeCompare(b.rcept_no)),
    reports, unavailable,
  };
}
