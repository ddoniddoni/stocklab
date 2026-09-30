import type { FinancialView } from "./model";

export function parseFinancialView(
  query: Record<string, string | string[] | undefined>, years: readonly number[],
): FinancialView {
  return {
    basis: query.basis === "OFS" ? "OFS" : "CFS",
    view: query.view === "quarter" ? "quarter" : "annual",
    year: years.find((year) => String(year) === query.year) ?? years[0] ?? 2025,
  };
}
export function hasInvalidFinancialQuery(
  query: Record<string, string | string[] | undefined>, view: FinancialView,
) {
  return (query.basis !== undefined && query.basis !== view.basis) ||
    (query.view !== undefined && query.view !== view.view) ||
    (query.year !== undefined && query.year !== String(view.year));
}
