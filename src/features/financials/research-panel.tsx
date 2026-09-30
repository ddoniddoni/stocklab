import Link from "next/link";
import { detailHref, type DetailView } from "@/domain/market-view";
import type { FinancialPageData, FinancialView, FixtureFiling } from "@/domain/financials/model";
import { fixtureFinancialRepository, financialYears } from "@/server/repositories/fixture-financial-repository";
import { getPublicConfig } from "@/server/config";
import { FinancialFilters } from "./components/financial-filters";
import { FinancialOverview } from "./components/financial-overview";
import { FilingsList } from "@/features/filings/filings-list";

export function ResearchLoading() {
  return <section className="panel financial-state" role="status"><h2>예시 자료를 불러오는 중…</h2><p>기간과 회계 기준에 맞는 자료를 준비합니다.</p></section>;
}
type ResearchProps = {
  symbol: string; detail: DetailView; selected: FinancialView;
};
type ResearchResult =
  | { state: "financials"; data: FinancialPageData | null }
  | { state: "filings"; filings: FixtureFiling[] }
  | { state: "not-configured" | "error" };
async function loadResearch({ symbol, detail, selected }: ResearchProps): Promise<ResearchResult> {
  try {
    if (getPublicConfig().financialMode !== "fixture")
      return { state: "not-configured" };
    if (detail.tab === "filings") {
      const filings = await fixtureFinancialRepository.getFilings(symbol, selected.year, selected.basis);
      return { state: "filings", filings };
    }
    return { state: "financials", data: await fixtureFinancialRepository.getFinancials(symbol, selected) };
  } catch {
    return { state: "error" };
  }
}
export async function ResearchPanel(props: ResearchProps) {
  const { symbol, detail, selected } = props;
  const result = await loadResearch(props);
  const content = result.state === "financials"
    ? result.data ? <FinancialOverview data={result.data} view={selected} />
      : <div className="financial-state" role="status">이 종목의 예시 재무자료가 없습니다.</div>
    : result.state === "filings" ? <FilingsList filings={result.filings} />
    : result.state === "not-configured"
      ? <section className="panel financial-state" role="status">재무 데이터가 설정되지 않았습니다.</section>
      : <section className="panel financial-state" role="alert">
      <h2>예시 자료를 불러오지 못했습니다</h2><p>자료의 형식을 확인할 수 없습니다. 다시 시도하거나 다른 종목을 열어 보세요.</p>
      <a href={detailHref(symbol, detail, selected)}>다시 불러오기</a>
    </section>;
  return (
    <section className="research-panel" aria-label="예시 재무 및 공시">
      <aside className="financial-notice" aria-label="재무정보 출처">
        <span className="financial-notice-badge">EXAMPLE</span>
        <div><strong>예시 재무정보 — 실제 기업 실적이 아닙니다</strong>
          <p>금액·보고서·제출일은 직접 작성한 예시입니다. 실제 공시를 수집하지 않았으며, 위 합성 시세와 별개의 자료입니다.</p></div>
        <Link href="/about/data">출처와 한계 ↗</Link>
      </aside>
      <FinancialFilters symbol={symbol} detail={detail} selected={selected} years={financialYears} />
      {content}
    </section>
  );
}
