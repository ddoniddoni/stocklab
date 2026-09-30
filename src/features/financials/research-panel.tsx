import { detailHref, type DetailView } from "@/domain/market-view";
import type { FinancialPageData, FinancialView, FixtureFiling } from "@/domain/financials/model";
import { getFinancialRepository, getFinancialYears } from "@/server/repositories/financial-repository";
import { CacheError } from "@/lib/published-files";
import { FinancialSourceNotice } from "./source-notice";
import { getPublicConfig } from "@/server/config";
import { FinancialFilters } from "./components/financial-filters";
import { FinancialOverview } from "./components/financial-overview";
import { FilingsList } from "@/features/filings/filings-list";

export function ResearchLoading() {
  return <section className="panel financial-state" role="status"><h2>재무 자료를 불러오는 중…</h2><p>기간과 회계 기준에 맞는 자료를 준비합니다.</p></section>;
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
    const repository = getFinancialRepository();
    if (detail.tab === "filings") {
      const filings = await repository.getFilings(symbol, selected.year, selected.basis);
      return { state: "filings", filings };
    }
    return { state: "financials", data: await repository.getFinancials(symbol, selected) };
  } catch (error) {
    if (error instanceof CacheError && error.code === "NOT_CONFIGURED") return { state: "not-configured" };
    return { state: "error" };
  }
}
export async function ResearchPanel(props: ResearchProps) {
  const { symbol, detail, selected } = props;
  const source = getPublicConfig().financialMode === "fixture" ? "fixture" : "opendart";
  const [result, financialYears] = await Promise.all([loadResearch(props), getFinancialYears()]);
  const content = result.state === "financials"
    ? result.data ? <FinancialOverview data={result.data} view={selected} />
      : <div className="financial-state" role="status">이 종목의 선택한 기간·기준 재무자료가 없습니다. 다른 조건을 선택해 보세요.</div>
    : result.state === "filings" ? <FilingsList filings={result.filings} source={source} />
    : result.state === "not-configured"
      ? <section className="panel financial-state" role="status">검토된 공개 재무 캐시가 아직 설정되지 않았습니다.</section>
      : <section className="panel financial-state" role="alert">
      <h2>재무 자료를 불러오지 못했습니다</h2><p>저장소나 자료의 형식을 확인할 수 없습니다. 다시 시도하거나 다른 종목을 열어 보세요.</p>
      <a href={detailHref(symbol, detail, selected)}>다시 불러오기</a>
    </section>;
  return (
    <section className="research-panel" aria-label="재무 및 공시">
      <FinancialSourceNotice source={source} />
      <FinancialFilters symbol={symbol} detail={detail} selected={selected} years={financialYears} />
      {content}
    </section>
  );
}
