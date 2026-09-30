import { instruments } from "@/domain/instruments";
import {
  reportLabels, type Basis, type FixtureDataset, type MetricKey,
  type ReportCode, type SourceReport, type SourceRow,
} from "@/domain/financials/model";

export const FIXTURE_YEARS = [2025, 2024, 2023] as const;
const names: Record<MetricKey, string> = {
  revenue: "매출액", operatingProfit: "영업이익", netProfit: "당기순이익",
  assets: "자산총계", liabilities: "부채총계", equity: "자본총계",
  operatingCashFlow: "영업활동현금흐름", investingCashFlow: "투자활동현금흐름",
  financingCashFlow: "재무활동현금흐름",
};
const metrics = Object.keys(names) as MetricKey[];
// Authored teaching numbers, unrelated to the named companies' actual results.
const annual: Record<number, number[]> = {
  2023: [380, 25, 15, 700, 210, 490, 35, -18, 0],
  2024: [420, 32, 24, 810, 250, 560, 45, -22, -4],
  2025: [500, 40, 30, 920, 280, 640, 60, -30, -6],
};
const quarters = [
  [100, 8, 5, 840, 260, 580, 12, -6, 0],
  [120, 10, 7, 860, 265, 595, 26, -15, -2],
  [140, 11, 8, 890, 270, 620, 44, -23, -4],
];
const incomeYtd = [[100, 8, 5], [220, 18, 12], [360, 29, 20]];
const quarterCodes = ["11013", "11012", "11014"] as const;
const submissionDates: Record<ReportCode, string> = {
  "11013": "2025-05-15", "11012": "2025-08-14", "11014": "2025-11-14", "11011": "2026-03-20",
};
function amount(value: number, multiplier: bigint) {
  const won = BigInt(value) * multiplier * 1_000_000_000n;
  return won < 0n ? `(${(-won).toLocaleString("en-US")})` : won.toLocaleString("en-US");
}
function makeReport(
  symbol: string, basis: Basis, year: number, code: ReportCode,
  values: number[], multiplier: bigint, ytd?: number[], revision = 1,
): SourceReport {
  const companyId = `fixture-company:${symbol}`;
  const rows: SourceRow[] = metrics.map((metric, index) => {
    const income = index < 3;
    const balance = index >= 3 && index < 6;
    return {
      rowKey: `${index + 1}`, sj_div: income ? (symbol === "035420" ? "CIS" : "IS") : balance ? "BS" : "CF",
      account_id: `fixture:${metric}`, account_nm: names[metric], account_detail: "",
      thstrm_amount: amount(values[index]!, multiplier),
      thstrm_add_amount: income && ytd ? amount(ytd[index]!, multiplier) : null,
      currency: "KRW", profitScope: metric === "netProfit" ? "entity-total" : null,
      amountKind: balance ? "instant" : code === "11011" ? "annual" : income ? "quarter" : "ytd",
    };
  });
  return {
    id: `fixture-report:${symbol}:${basis}:${year}:${code}:r${revision}`,
    companyId, source: "fixture", title: `${revision > 1 ? "[기재정정 예시] " : "[예시] "}${reportLabels[code]} (${year})`,
    fiscalYear: year, reportCode: code, basis, currency: "KRW",
    accountingStandard: "fixture-accounting", fiscalMonth: 12,
    restatementKey: `fixture:${symbol}:${basis}:${year}:comparable-v1`,
    revision, reviewed: true,
    publishedAt: code === "11011" ? `${year + 1}-03-${revision > 1 ? "27" : "20"}` : submissionDates[code],
    receiptNumber: null, originalUrl: null, fetchedAt: null, rows,
  };
}

export function createFinancialFixture(symbol: string): FixtureDataset | null {
  const index = instruments.findIndex((stock) => stock.symbol === symbol);
  const stock = instruments[index];
  if (!stock) return null;
  const reports: SourceReport[] = [];
  const bases: Basis[] = symbol === "035420" ? ["CFS"] : ["CFS", "OFS"];
  for (const basis of bases) {
    const multiplier = BigInt((index + 1) * (basis === "CFS" ? 2 : 1));
    for (const year of FIXTURE_YEARS) {
      // An absent fixture stays absent; this says nothing about actual filings.
      if (symbol === "066570" && year === 2023) continue;
      const values = [...annual[year]!];
      if (symbol === "000660" && year === 2023) { values[1] = -12; values[2] = -18; }
      if (symbol === "005930" && year === 2025) {
        const old = [...values];
        old[0] = 490;
        reports.push(makeReport(symbol, basis, year, "11011", old, multiplier));
      }
      const report = makeReport(symbol, basis, year, "11011", values, multiplier,
        undefined, symbol === "005930" && year === 2025 ? 2 : 1);
      if (symbol === "005380" && year === 2025)
        report.restatementKey = `fixture:${symbol}:${basis}:${year}:incomparable-v2`;
      if (symbol === "066570" && year === 2024) {
        // A precision example above Number.MAX_SAFE_INTEGER; preserve one won.
        const assets = 9_007_199_254_740_993n;
        const liabilities = BigInt(report.rows[4]!.thstrm_amount!.replaceAll(",", ""));
        report.rows[3]!.thstrm_amount = assets.toLocaleString("en-US");
        report.rows[5]!.thstrm_amount = (assets - liabilities).toLocaleString("en-US");
      }
      if (symbol === "005930" && year === 2025) {
        report.rows.push({
          ...report.rows[2]!, rowKey: "owners-profit", account_id: "fixture:ownersNetProfit",
          account_nm: "지배기업 소유주 귀속 당기순이익", profitScope: "owners-of-parent",
          thstrm_amount: amount(27, multiplier),
        });
      }
      reports.push(report);
    }
    quarterCodes.forEach((code, quarter) => {
      const report = makeReport(symbol, basis, 2025, code, quarters[quarter]!, multiplier, incomeYtd[quarter]);
      if (symbol === "066570" && code === "11012") {
        const revenue = report.rows[0]!;
        revenue.account_id = "-표준계정코드 미사용-";
        report.rows.push({ ...revenue, rowKey: "revenue-alternative", account_detail: "예시 중복 후보" });
      }
      if (symbol === "005380" && code === "11012") report.rows[8]!.thstrm_amount = "—";
      if (symbol === "066570" && code === "11014")
        report.rows.push({ ...report.rows[1]!, rowKey: "cis-profit-alternative", sj_div: "CIS" });
      if (symbol === "000660" && code === "11014") report.rows[6]!.amountKind = "unknown";
      reports.push(report);
    });
  }
  return {
    source: "fixture", generatedAt: "2026-09-30T00:00:00Z", revision: "authored-financials-v1",
    company: { id: `fixture-company:${symbol}`, name: stock.name, symbol, corpCode: null, fiscalMonth: 12, source: "fixture" },
    reports,
  };
}
