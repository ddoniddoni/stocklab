import Link from "next/link";
import { Suspense } from "react";
import { parseComparison, comparisonHref } from "@/domain/comparison";
import { financialYears } from "@/server/repositories/fixture-financial-repository";
import { ComparisonControls } from "@/features/compare/comparison-controls";
import { ComparisonResults } from "@/features/compare/comparison-results";
export const metadata = { title: "기업 비교 · 예시 재무" };
export default async function ComparePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { view, warnings } = parseComparison(await searchParams, financialYears);
  return <><div className="personal-page-heading"><p className="eyebrow">COMPANY COMPARISON</p><h1>기업 비교</h1><p className="intro">같은 기간, 같은 기준으로 나란히 살펴보세요.</p></div>
    <div className="research-panel"><aside className="financial-notice"><div><strong>예시 재무정보 — 실제 기업 실적이 아닙니다</strong><p>가격과 결합한 PER·PBR·수익률은 제공하지 않습니다.</p></div><Link href="/about/data">데이터 설명 →</Link></aside></div>
    {warnings.length ? <div className="personal-issue" role="status">{warnings.map((warning) => <p key={warning}>{warning}</p>)}<Link href={comparisonHref(view)}>정리된 비교 주소로 이동 →</Link></div> : null}
    <ComparisonControls view={view} years={financialYears} />
    <Suspense key={comparisonHref(view)} fallback={<div className="financial-state" role="status">기업 비교 자료를 불러오는 중…</div>}><ComparisonResults view={view} /></Suspense>
  </>;
}
