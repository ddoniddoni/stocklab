import Link from "next/link";
import { Suspense } from "react";
import { parseComparison, comparisonHref } from "@/domain/comparison";
import { getFinancialYears } from "@/server/repositories/financial-repository";
import { getPublicConfig } from "@/server/config";
import { FinancialSourceNotice } from "@/features/financials/source-notice";
import { ComparisonControls } from "@/features/compare/comparison-controls";
import { ComparisonResults } from "@/features/compare/comparison-results";
export const metadata = { title: "기업 비교 · 재무" };
export default async function ComparePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [query, financialYears] = await Promise.all([searchParams, getFinancialYears()]);
  const { view, warnings } = parseComparison(query, financialYears);
  const source = getPublicConfig().financialMode === "fixture" ? "fixture" : "opendart";
  return <><div className="personal-page-heading"><p className="eyebrow">COMPANY COMPARISON</p><h1>기업 비교</h1><p className="intro">같은 기간, 같은 기준으로 나란히 살펴보세요.</p></div>
    <div className="research-panel"><FinancialSourceNotice source={source} /></div>
    {warnings.length ? <div className="personal-issue" role="status">{warnings.map((warning) => <p key={warning}>{warning}</p>)}<Link href={comparisonHref(view)}>정리된 비교 주소로 이동 →</Link></div> : null}
    <ComparisonControls view={view} years={financialYears} />
    <Suspense key={comparisonHref(view)} fallback={<div className="financial-state" role="status">기업 비교 자료를 불러오는 중…</div>}><ComparisonResults view={view} /></Suspense>
  </>;
}
