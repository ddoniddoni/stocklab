import { parseAmount } from "./amounts";
import {
  metricKeys, reportCodes,
  type Basis, type FinancialColumn, type FinancialEvidence, type FinancialMetric,
  type FinancialView, type MetricKey, type Quarter, type ReportCode,
  type SourceReport, type SourceRow,
} from "./model";

export const MAPPER_VERSION = "fixture-1.0.0";
const balanceMetrics = new Set<MetricKey>(["assets", "liabilities", "equity"]);
const cashMetrics = new Set<MetricKey>(["operatingCashFlow", "investingCashFlow", "financingCashFlow"]);
const fixtureNames: Record<MetricKey, string> = {
  revenue: "매출액", operatingProfit: "영업이익", netProfit: "당기순이익",
  assets: "자산총계", liabilities: "부채총계", equity: "자본총계",
  operatingCashFlow: "영업활동현금흐름", investingCashFlow: "투자활동현금흐름",
  financingCashFlow: "재무활동현금흐름",
};
type Selection = { report: SourceReport | null; reason: string | null; ambiguous: boolean };
export function selectReport(
  reports: readonly SourceReport[], companyId: string, year: number,
  basis: Basis, code: ReportCode,
): Selection {
  const candidates = reports.filter((report) =>
    report.companyId === companyId && report.fiscalYear === year &&
    report.basis === basis && report.reportCode === code && report.reviewed);
  const latest = Math.max(0, ...candidates.map((report) => report.revision));
  const selected = candidates.filter((report) => report.revision === latest);
  if (selected.length > 1)
    return { report: null, reason: "동일 버전 보고서 후보가 여러 개입니다.", ambiguous: true };
  return {
    report: selected[0] ?? null,
    reason: selected.length ? null : "선택한 기간과 연결/별도 기준의 예시 보고서가 없습니다.",
    ambiguous: false,
  };
}

function selectRow(report: SourceReport, metric: MetricKey) {
  const candidates = report.rows.filter((row) => {
    const statementMatches = balanceMetrics.has(metric) ? row.sj_div === "BS"
      : cashMetrics.has(metric) ? row.sj_div === "CF"
        : row.sj_div === "IS" || row.sj_div === "CIS";
    return statementMatches && (metric !== "netProfit" || row.profitScope === "entity-total");
  });
  // These identifiers and names are authored fixture mappings only. Never use
  // them as a verified real-company XBRL mapping in a future DART adapter.
  const exact = candidates.filter((row) => row.account_id === `fixture:${metric}`);
  const named = candidates.filter((row) =>
    row.account_id === "-표준계정코드 미사용-" && row.account_nm === fixtureNames[metric]);
  const rows = exact.length ? exact : named;
  return {
    row: rows.length === 1 ? rows[0]! : null,
    ambiguous: rows.length > 1,
    rows,
    reason: rows.length > 1
      ? "계정 후보가 여러 개여서 금액을 확정하지 않았습니다."
      : rows.length === 0 ? "해당 항목의 계정을 찾지 못했습니다." : null,
  };
}
function evidence(report: SourceReport, row: SourceRow): FinancialEvidence {
  const quarter = report.reportCode === "11011" ? null
    : (reportCodes.indexOf(report.reportCode) + 1) as Quarter;
  const dates = period(report.fiscalYear, quarter);
  return {
    reportId: report.id, title: report.title, revision: report.revision,
    publishedAt: report.publishedAt, receiptNumber: null, originalUrl: null,
    rowKey: row.rowKey, accountId: row.account_id, accountName: row.account_nm,
    accountDetail: row.account_detail, amountKind: row.amountKind,
    periodStart: row.amountKind === "instant" ? null
      : row.amountKind === "ytd" ? `${report.fiscalYear}-01-01` : dates.start,
    periodEnd: dates.end,
    statement: row.sj_div, rawAmount: row.thstrm_amount, rawYtdAmount: row.thstrm_add_amount,
  };
}
function comparable(a: SourceReport, b: SourceReport) {
  return a.companyId === b.companyId && a.fiscalYear === b.fiscalYear &&
    a.basis === b.basis && a.currency === b.currency && a.source === b.source &&
    a.fiscalMonth === b.fiscalMonth && a.accountingStandard === b.accountingStandard &&
    a.restatementKey === b.restatementKey;
}
function period(year: number, quarter: Quarter | null) {
  const end = quarter ? ["03-31", "06-30", "09-30", "12-31"][quarter - 1]! : "12-31";
  const start = quarter ? ["01-01", "04-01", "07-01", "10-01"][quarter - 1]! : "01-01";
  return { start: `${year}-${start}`, end: `${year}-${end}` };
}

export function normalizeMetric(
  reports: readonly SourceReport[], companyId: string, year: number,
  basis: Basis, quarter: Quarter | null, metric: MetricKey,
): FinancialMetric {
  const dates = period(year, quarter);
  const result: FinancialMetric = {
    metric, value: null, ytdValue: null, currency: "KRW", basis,
    periodKind: balanceMetrics.has(metric) ? "instant" : quarter ? "quarter" : "annual",
    fiscalYear: year, quarter, periodStart: balanceMetrics.has(metric) ? null : dates.start,
    periodEnd: dates.end, source: "fixture", quality: "missing",
    profitScope: metric === "netProfit" ? "entity-total" : null,
    reason: null, calculation: null, mapperVersion: MAPPER_VERSION, fetchedAt: null, evidence: [],
  };
  const fail = (reason: string, ambiguous = false): FinancialMetric => ({
    ...result, reason, quality: ambiguous ? "ambiguous" : "missing",
  });
  const code = quarter ? reportCodes[quarter - 1]! : "11011";
  const selection = selectReport(reports, companyId, year, basis, code);
  if (!selection.report) return fail(selection.reason!, selection.ambiguous);
  const report = selection.report;
  const chosen = selectRow(report, metric);
  result.evidence = chosen.rows.map((row) => evidence(report, row));
  if (!chosen.row) return fail(chosen.reason!, chosen.ambiguous);
  const row = chosen.row;
  const current = parseAmount(row.thstrm_amount);
  if (current.value === null) return fail(current.reason!);

  // BS is a point-in-time balance in every view, including Q4.
  if (balanceMetrics.has(metric)) {
    if (row.amountKind !== "instant") return fail("기말 잔액인지 확인되지 않아 표시하지 않았습니다.");
    return { ...result, value: current.value, quality: "reported" };
  }
  if (quarter === null) {
    if (row.amountKind !== "annual") return fail("연간 금액인지 확인되지 않았습니다.");
    return { ...result, value: current.value, quality: "reported" };
  }
  if (!cashMetrics.has(metric) && quarter < 4) {
    if (row.amountKind !== "quarter") return fail("당기 3개월 금액인지 확인되지 않았습니다.");
    return {
      ...result, value: current.value, quality: "reported",
      ytdValue: parseAmount(row.thstrm_add_amount).value,
    };
  }
  const expectedKind = quarter === 4 ? "annual" : "ytd";
  if (row.amountKind !== expectedKind)
    return fail("금액의 누적/연간 기간 의미가 확인되지 않아 분기를 계산하지 않았습니다.");
  if (quarter === 1) {
    return { ...result, value: current.value, ytdValue: current.value, quality: "reported" };
  }
  const priorCode = reportCodes[quarter - 2]!;
  const priorSelection = selectReport(reports, companyId, year, basis, priorCode);
  if (!priorSelection.report)
    return fail(`분기 계산에 필요한 직전 누적 보고서가 없습니다. ${priorSelection.reason}`, priorSelection.ambiguous);
  const previous = priorSelection.report;
  const previousRow = selectRow(previous, metric);
  result.evidence.push(...previousRow.rows.map((item) => evidence(previous, item)));
  if (!comparable(report, previous))
    return fail("통화·회계·연결/별도 또는 재작성 기준이 달라 분기를 계산하지 않았습니다.");
  if (!previousRow.row)
    return fail(`직전 누적 계정: ${previousRow.reason}`, previousRow.ambiguous);
  const isCash = cashMetrics.has(metric);
  if (previousRow.row.amountKind !== (isCash ? "ytd" : "quarter"))
    return fail("직전 보고서 금액의 기간 의미가 확인되지 않았습니다.");
  const prior = parseAmount(isCash
    ? previousRow.row.thstrm_amount : previousRow.row.thstrm_add_amount);
  if (prior.value === null) return fail("직전 누적 금액이 없어 분기를 계산하지 않았습니다.");
  return {
    ...result,
    value: (BigInt(current.value) - BigInt(prior.value)).toString(),
    ytdValue: quarter === 4 ? null : current.value,
    quality: "derived",
    calculation: quarter === 4
      ? "연간 − 3분기 누적 계산값"
      : `${quarter}분기 누적 − ${quarter - 1}분기 누적 계산값`,
  };
}

export function buildFinancialColumns(
  reports: readonly SourceReport[], companyId: string, view: FinancialView,
  availableYears: readonly number[],
): FinancialColumn[] {
  const columns: { year: number; quarter: Quarter | null; label: string }[] = view.view === "quarter"
    ? ([1, 2, 3, 4] as const).map((quarter) => ({ year: view.year, quarter, label: `${quarter}분기` }))
    : availableYears.filter((year) => year <= view.year).sort((a, b) => a - b)
      .slice(-3).map((year) => ({ year, quarter: null, label: `${year}년` }));
  return columns.map(({ year, quarter, label }) => ({
    key: `${year}-${quarter ?? "annual"}`, label,
    metrics: metricKeys.map((metric) => normalizeMetric(reports, companyId, year, view.basis, quarter, metric)),
  }));
}
