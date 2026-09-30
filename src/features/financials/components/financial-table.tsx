import { compactWon, exactWon, operatingMargin } from "@/domain/financials/amounts";
import { basisLabels, metricLabels, metricKeys, type FinancialMetric, type FinancialColumn } from "@/domain/financials/model";

const qualityLabels = { reported: "예시 원천값", derived: "계산값", missing: "미제공", ambiguous: "확인 필요" };
const sourcePeriodLabels = { annual: "연간", quarter: "3개월", ytd: "누적", instant: "기말 잔액", unknown: "기간 미확인" };
export function MetricCell({ item }: { item: FinancialMetric }) {
  return (
    <details className="financial-cell">
      <summary aria-label={`${metricLabels[item.metric]} ${compactWon(item.value)} · 산출 근거 열기`}>
        <span className={item.value !== null && BigInt(item.value) < 0n ? "financial-negative" : undefined}>
          {compactWon(item.value)}
        </span>
        <span className={`financial-quality quality-${item.quality}`}>{qualityLabels[item.quality]}</span>
      </summary>
      <div className="financial-cell-details">
        <strong>{exactWon(item.value)}</strong>
        <p>{item.periodKind === "instant" ? `${item.periodEnd} 기말 잔액`
          : `${item.periodStart} ~ ${item.periodEnd} · ${item.periodKind === "annual" ? "연간" : "3개월"}`}</p>
        <p>{basisLabels[item.basis]} · KRW · 원 단위</p>
        {item.profitScope ? <p>기업 전체 당기순이익 기준</p> : null}
        {item.calculation ? <p className="financial-calculation">{item.calculation}</p> : null}
        {item.reason ? <p>{item.reason}</p> : null}
        {item.ytdValue !== null ? <p>보고서의 별도 누적 ({item.fiscalYear}-01-01 ~ {item.periodEnd}): {exactWon(item.ytdValue)}</p> : null}
        {item.evidence.map((source) => (
          <div className="financial-evidence" key={`${source.reportId}:${source.rowKey}`}>
            <strong>{source.title} · 버전 {source.revision}</strong>
            <p>{source.accountName} ({source.statement})</p>
            {source.accountDetail ? <p>계정 상세: {source.accountDetail}</p> : null}
            <p>{sourcePeriodLabels[source.amountKind]} 원천: {source.rawAmount?.trim() || "미제공"}</p>
            <p>{source.amountKind === "unknown" ? "원천 기간 확인 필요"
              : source.periodStart ? `${source.periodStart} ~ ${source.periodEnd}` : `${source.periodEnd} 시점`}</p>
            {source.rawYtdAmount ? <p>별도 원천 누적 ({source.periodEnd.slice(0, 4)}-01-01 ~ {source.periodEnd}): {source.rawYtdAmount}</p> : null}
            <p>예시 제출일: {source.publishedAt}</p>
          </div>
        ))}
        <p>출처: 직접 작성한 예시 · 실제 수집일·접수번호·공시 원문 없음</p>
      </div>
    </details>
  );
}

export function FinancialTable({ columns, basis }: { columns: FinancialColumn[]; basis: "CFS" | "OFS" }) {
  return (
    <section className="panel financial-table-panel">
      <div className="panel-heading"><h2>재무 상세</h2><span className="subtle">값을 열어 기간과 근거 확인</span></div>
      <div className="financial-table-scroll" role="region" aria-label="예시 재무 상세 표, 가로 스크롤 가능" tabIndex={0}>
        <table className="financial-table">
          <caption>예시 재무정보 · {basisLabels[basis]} · 실제 기업 실적이 아닙니다. 원 단위 원천값은 각 금액을 열면 표시됩니다.</caption>
          <thead><tr><th scope="col">항목</th>{columns.map((column) => <th scope="col" key={column.key}>{column.label}</th>)}</tr></thead>
          <tbody>
            {metricKeys.map((metric) => (
              <tr key={metric} className={["assets", "operatingCashFlow"].includes(metric) ? "financial-group-start" : undefined}>
                <th scope="row">{metricLabels[metric]}<small>{["assets", "liabilities", "equity"].includes(metric) ? "기말 잔액" : "해당 기간 금액"}</small></th>
                {columns.map((column) => {
                  const item = column.metrics.find((value) => value.metric === metric);
                  return <td key={column.key}>{item ? <MetricCell item={item} /> : "—"}</td>;
                })}
              </tr>
            ))}
            <tr className="financial-group-start">
              <th scope="row">영업이익률<small>영업이익 ÷ 매출</small></th>
              {columns.map((column) => {
                const margin = operatingMargin(
                  column.metrics.find((item) => item.metric === "operatingProfit")?.value ?? null,
                  column.metrics.find((item) => item.metric === "revenue")?.value ?? null,
                );
                return <td className="financial-ratio" key={column.key}>{margin ?? "—"}
                  {!margin ? <small>매출 미제공·0 이하 또는 이익 미제공</small> : <small>같은 기간·기준의 계산값</small>}
                </td>;
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="panel-foot">손익: 단일 기간 · 현금흐름: 누적에서 분기 도출 · 자산/부채/자본: 기말 잔액</div>
    </section>
  );
}
