import "server-only";
import { createFinancialFixture, FIXTURE_YEARS } from "@/data/fixtures/financials";
import { fixtureDatasetSchema, type FinancialRepository, type FixtureFiling } from "@/domain/financials/model";
import { buildFinancialColumns, selectReport } from "@/domain/financials/normalize";

export const financialYears = FIXTURE_YEARS;
function dataset(symbol: string) {
  const raw = createFinancialFixture(symbol);
  return raw ? fixtureDatasetSchema.parse(raw) : null;
}
export const fixtureFinancialRepository: FinancialRepository = {
  async getFinancials(symbol, view) {
    const data = dataset(symbol);
    if (!data) return null;
    return {
      company: data.company, source: "fixture", generatedAt: data.generatedAt,
      datasetRevision: data.revision,
      stale: Date.now() - Date.parse(data.generatedAt) > 180 * 86_400_000,
      columns: buildFinancialColumns(data.reports, data.company.id, view, FIXTURE_YEARS),
    };
  },
  async getFilings(symbol, year, basis) {
    const data = dataset(symbol);
    if (!data) return [];
    return data.reports.filter((report) => report.fiscalYear === year && report.basis === basis)
      .map((report): FixtureFiling => ({
        id: report.id, title: report.title, source: "fixture", publishedAt: report.publishedAt,
        fiscalYear: report.fiscalYear, reportCode: report.reportCode, basis: report.basis,
        revision: report.revision, correction: report.revision > 1,
        selected: selectReport(data.reports, data.company.id, year, basis, report.reportCode).report?.id === report.id,
        receiptNumber: null, originalUrl: null,
      })).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  },
};
