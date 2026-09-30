import { compactWon, operatingMargin } from "@/domain/financials/amounts";
import { basisLabels, metricLabels, type FinancialPageData, type FinancialView } from "@/domain/financials/model";
import { FinancialChart } from "./financial-chart";
import { FinancialTable } from "./financial-table";

export function FinancialOverview({ data, view }: { data: FinancialPageData; view: FinancialView }) {
  const latest = data.columns.at(-1);
  const find = (metric: string) => latest?.metrics.find((item) => item.metric === metric);
  const available = data.columns.some((column) => column.metrics.some((item) => item.value !== null));
  const margin = operatingMargin(find("operatingProfit")?.value ?? null, find("revenue")?.value ?? null);
  return (
    <>
      <div className="financial-section-heading">
        <div><p className="eyebrow">FINANCIAL STATEMENTS · EXAMPLE</p><h2>{view.year}년 {basisLabels[view.basis]} 재무</h2></div>
        <p>{view.view === "annual" ? "선택 연도까지 최대 3개 사업연도" : "1~4분기 · 각 3개월"} · KRW</p>
      </div>
      {data.stale ? <p className="financial-state" role="status">예시 작성 후 180일이 지났습니다. 이 자료는 실제 공시의 최신성을 나타내지 않습니다.</p> : null}
      {!available ? (
        <div className="financial-state" role="status">
          <h3>선택한 조건의 예시 재무정보가 없습니다</h3>
          <p>{basisLabels[view.basis]} 기준과 {view.year}년 선택을 유지했습니다. 다른 기준이나 기간을 선택해 보세요.</p>
        </div>
      ) : (
        <>
          <div className="financial-summary-label">{latest?.label} 요약 · 예시 금액</div>
          <dl className="financial-summary">
            {(["revenue", "operatingProfit", "netProfit"] as const).map((metric) => {
              const item = find(metric);
              return <div key={metric}><dt>{metricLabels[metric]}</dt><dd>{compactWon(item?.value ?? null)}</dd>
                <small>{item?.calculation ?? item?.reason ?? "예시 원천값"}</small></div>;
            })}
            <div><dt>영업이익률</dt><dd>{margin ?? "—"}</dd><small>{margin ? "같은 기간 영업이익 ÷ 매출" : "매출·이익 또는 계산 조건 확인 필요"}</small></div>
          </dl>
          <FinancialChart columns={data.columns} />
        </>
      )}
      <FinancialTable columns={data.columns} basis={view.basis} />
      <p className="financial-provenance">출처: 직접 작성한 예시 · 예시 작성일 {data.generatedAt.slice(0, 10)} · 실제 DART 수집 없음</p>
    </>
  );
}
