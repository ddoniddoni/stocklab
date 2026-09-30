import "server-only";
import { metricKeys, reportCodes, type FinancialColumn, type FinancialMetric, type FinancialRepository } from "@/domain/financials/model";
import type { PublishedDataset } from "@/domain/financials/published";
import { getPublishedDataset, publishedEntries } from "./published-dataset-repository";

export const STALE_CACHE_MS = 30 * 86_400_000;
type Report = PublishedDataset["reports"][number];
function column(data: PublishedDataset | null, year: number, basis: "CFS" | "OFS", quarter: 1 | 2 | 3 | 4 | null): FinancialColumn {
  const code = quarter === null ? "11011" : reportCodes[quarter - 1];
  const report = data?.reports.find((item) => item.reportCode === code);
  const end = `${year}-${quarter === null ? "12-31" : ["03-31", "06-30", "09-30", "12-31"][quarter - 1]}`;
  return { key: `${year}-${quarter ?? "annual"}`, label: quarter === null ? `${year}년 연간` : `${year}년 ${quarter}분기`,
    metrics: metricKeys.map((key): FinancialMetric => {
      const metric = report?.metrics.find((item) => item.metric === key);
      const balance = ["assets", "liabilities", "equity"].includes(key);
      const cash = key.endsWith("CashFlow");
      const unsupported = quarter !== null && !balance && (quarter === 4 || cash);
      const start = balance ? null : quarter === null ? `${year}-01-01` : `${year}-${["01-01", "04-01", "07-01", "10-01"][quarter - 1]}`;
      const reason = !metric ? "선택한 기간·기준의 검토된 보고서가 없습니다." : unsupported
        ? "실제 재무의 분기 파생은 아직 검증되지 않아 제공하지 않습니다. 보고된 누적 금액과 연간 화면을 확인하세요." : metric.reason;
      return { metric: key, value: unsupported ? null : metric?.value ?? null,
        ytdValue: unsupported ? metric?.value ?? null : metric?.ytdValue ?? null,
        basis, currency: "KRW", source: "opendart", fiscalYear: year, quarter,
        periodKind: balance ? "instant" : quarter === null ? "annual" : "quarter", periodStart: start, periodEnd: end,
        profitScope: key === "netProfit" ? "entity-total" : null, quality: unsupported ? "missing" : metric?.quality ?? "missing",
        reason, calculation: null, mapperVersion: data?.mapperVersion ?? "dart-reviewed-rows-1.0.0", fetchedAt: report?.fetchedAt ?? null,
        evidence: metric?.evidence && report && data ? [{ reportId: `${data.id}:${report.reportCode}`, title: report.title,
          revision: data.revision, publishedAt: report.filedDate, receiptNumber: report.receiptNumber, originalUrl: report.originalUrl,
          rowKey: metric.evidence.rowKey, accountId: metric.evidence.accountId, accountName: metric.evidence.accountName,
          accountDetail: metric.evidence.accountDetail, statement: metric.evidence.statement, amountKind: metric.periodKind,
          periodStart: metric.periodStart, periodEnd: metric.periodEnd,
          rawAmount: metric.evidence.rawAmount, rawYtdAmount: metric.evidence.rawYtdAmount }] : [] };
    }) };
}
async function latest(symbol: string, year: number, basis: "CFS" | "OFS") {
  const entry = (await publishedEntries(symbol, year, basis))[0];
  return entry ? getPublishedDataset(entry.id) : null;
}
export const publishedFinancialRepository: FinancialRepository = {
  async getFinancials(symbol, view) {
    const years = view.view === "annual" ? [view.year - 2, view.year - 1, view.year].filter((year) => year >= 2015) : [view.year];
    const datasets = await Promise.all(years.map((year) => latest(symbol, year, view.basis)));
    const present = datasets.filter((data): data is PublishedDataset => data !== null);
    const newest = present.at(-1);
    if (!newest) return null;
    const oldestFetch = present.map((data) => data.fetchedAt).sort()[0]!;
    return { company: { ...newest.company, id: `dart-company:${newest.company.corpCode}`, source: "opendart" },
      source: "opendart", generatedAt: oldestFetch, publishedAt: newest.publishedAt, reviewedAt: newest.reviewedAt,
      datasetRevision: present.map((data) => data.id).join(","), stale: Date.now() - Date.parse(oldestFetch) > STALE_CACHE_MS,
      columns: view.view === "annual" ? years.map((year, index) => column(datasets[index] ?? null, year, view.basis, null))
        : ([1, 2, 3, 4] as const).map((quarter) => column(newest, view.year, view.basis, quarter)) };
  },
  async getFilings(symbol, year, basis) {
    const entries = await publishedEntries(symbol, year, basis);
    // At most five retained dataset revisions per page; public API pages separately.
    const datasets = await Promise.all(entries.slice(0, 5).map((entry) => getPublishedDataset(entry.id)));
    const selected = new Set(datasets[0]?.reports.map((report) => report.receiptNumber) ?? []);
    const seen = new Set<string>();
    return datasets.flatMap((data) => data.reports.flatMap((report: Report) => {
      if (seen.has(report.receiptNumber)) return [];
      seen.add(report.receiptNumber);
      return [{ id: report.receiptNumber, title: report.title, source: "opendart" as const,
        publishedAt: report.filedDate, fiscalYear: year, reportCode: report.reportCode, basis, revision: data.revision,
        correction: report.title.includes("정정"), selected: selected.has(report.receiptNumber),
        receiptNumber: report.receiptNumber, originalUrl: report.originalUrl, fetchedAt: report.fetchedAt }];
    })).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  },
};
