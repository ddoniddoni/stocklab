import { getInstrument } from "./instruments";
import { parseFinancialView, hasInvalidFinancialQuery } from "./financials/view";
import type { FinancialMetric, FinancialView, MetricKey } from "./financials/model";

export const comparisonMetrics = ["revenue", "operatingProfit", "netProfit", "assets", "liabilities", "equity"] as const satisfies readonly MetricKey[];
export type ComparisonView = FinancialView & { symbols: string[]; quarter: 1 | 2 | 3 | 4; metric: (typeof comparisonMetrics)[number] };
export function parseComparison(query: Record<string, string | string[] | undefined>, years: readonly number[]) {
  const financial = parseFinancialView(query, years);
  const raw = typeof query.symbols === "string" ? query.symbols.split(",").filter(Boolean) : [];
  const unique = [...new Set(raw.filter((symbol) => !!getInstrument(symbol)))];
  const warnings: string[] = [];
  if (Array.isArray(query.symbols) || raw.some((symbol) => !getInstrument(symbol))) warnings.push("지원하지 않거나 중복된 형식의 종목 요청을 제외했습니다.");
  if (unique.length > 3) warnings.push("기업은 최대 3개까지 비교할 수 있어 앞의 3개를 표시합니다.");
  if (hasInvalidFinancialQuery(query, financial)) warnings.push("잘못된 재무 필터를 지원하는 기본값으로 바꿨습니다.");
  const quarter = [1, 2, 3, 4].find((value) => String(value) === query.quarter) as 1 | 2 | 3 | 4 | undefined;
  const metric = comparisonMetrics.find((value) => value === query.metric);
  if ((query.quarter !== undefined && !quarter) || (query.metric !== undefined && !metric)) warnings.push("잘못된 분기 또는 차트 항목을 기본값으로 바꿨습니다.");
  return { view: { ...financial, symbols: unique.slice(0, 3), quarter: quarter ?? 4, metric: metric ?? "revenue" } satisfies ComparisonView, warnings };
}
export function comparisonHref(view: ComparisonView) {
  return `/compare?${new URLSearchParams({ symbols: view.symbols.join(","), basis: view.basis,
    view: view.view, year: String(view.year), quarter: String(view.quarter), metric: view.metric })}`;
}
export function compatible(a: FinancialMetric, b: FinancialMetric) {
  return a.source === b.source && a.currency === b.currency && a.basis === b.basis &&
    a.fiscalYear === b.fiscalYear && a.quarter === b.quarter && a.periodKind === b.periodKind &&
    a.periodStart === b.periodStart && a.periodEnd === b.periodEnd && a.profitScope === b.profitScope;
}
