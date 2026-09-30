import Link from "next/link";
import { compatible, comparisonMetrics, type ComparisonView } from "@/domain/comparison";
import { getInstrument } from "@/domain/instruments";
import { compactWon, barPercent, operatingMargin } from "@/domain/financials/amounts";
import { basisLabels, metricLabels, type FinancialMetric, type FinancialPageData, type MetricKey } from "@/domain/financials/model";
import { MetricCell } from "@/features/financials/components/financial-table";
import { fixtureFinancialRepository } from "@/server/repositories/fixture-financial-repository";

type Entry = { symbol: string; data: FinancialPageData | null; issue: string | null; metrics: FinancialMetric[] };
function comparableItem(entries: Entry[], entry: Entry, metric: MetricKey) {
  const item = entry.metrics.find((value) => value.metric === metric);
  const reference = entries.flatMap((value) => value.metrics).find((value) => value.metric === metric && value.value !== null);
  if (!item) return { item: null, reason: entry.issue ?? "해당 기간의 자료가 없습니다." };
  if (reference && !compatible(reference, item)) return { item: null, reason: "기간·통화·연결/별도 기준이 달라 비교할 수 없습니다." };
  return { item, reason: null };
}
export async function ComparisonResults({ view }: { view: ComparisonView }) {
  if (!view.symbols.length) return <section className="financial-state"><h2>함께 살펴볼 기업을 선택하세요</h2><p>최대 3개 기업의 같은 기간·기준 재무정보를 나란히 볼 수 있습니다.</p></section>;
  const results = await Promise.allSettled(view.symbols.map((symbol) => fixtureFinancialRepository.getFinancials(symbol, view)));
  const entries: Entry[] = view.symbols.map((symbol, index) => {
    const result = results[index]!;
    const data = result.status === "fulfilled" ? result.value : null;
    const key = `${view.year}-${view.view === "annual" ? "annual" : view.quarter}`;
    return { symbol, data, issue: result.status === "rejected" ? "재무 자료를 읽지 못했습니다. 페이지를 다시 열어주세요." : null,
      metrics: data?.columns.find((column) => column.key === key)?.metrics ?? [] };
  });
  const chart = entries.map((entry) => ({ entry, ...comparableItem(entries, entry, view.metric) }));
  const maximum = chart.reduce((max, point) => { const value = BigInt(point.item?.value ?? "0"); const abs = value < 0n ? -value : value; return abs > max ? abs : max; }, 0n);
  const period = `${view.year}년 ${view.view === "annual" ? "연간" : `${view.quarter}분기`}`;
  return <><div className="financial-section-heading"><div><p className="eyebrow">SIDE BY SIDE</p><h2>{period} · {basisLabels[view.basis]}</h2></div><p>12월 결산 · KRW · 예시 데이터</p></div>
    {entries.some((entry) => entry.data?.stale) ? <p className="personal-issue" role="status">작성 후 180일이 지난 예시 자료가 포함돼 있습니다. 실제 기업의 최신 공시 상태를 나타내지 않습니다.</p> : null}
    <section className="panel compare-chart"><div className="panel-heading"><h2>{metricLabels[view.metric]} 비교</h2><span className="subtle">같은 축 · 가운데 0</span></div>
      <p className="financial-chart-note">막대는 금액의 규모만 보여줍니다. 투자 우열을 나타내지 않습니다. 정확한 값과 근거는 아래 표에서 확인하세요.</p>
      <ul className="comparison-bars">{chart.map(({ entry, item, reason }) => {
        const value = item?.value ?? null;
        return <li key={entry.symbol}><Link href={`/stocks/${entry.symbol}?tab=financials`}>{getInstrument(entry.symbol)?.name}</Link>
          <div className="financial-bar-track" aria-hidden="true">{value !== null ? <span className="financial-bar financial-series-revenue" data-zero={value === "0" || undefined}
            style={{ width: `${barPercent(value, maximum) / 2}%`, ...(BigInt(value) < 0n ? { right: "50%" } : { left: "50%" }) }} /> : null}</div>
          <span className="numeric">{compactWon(value)}{value === null ? <small>{reason ?? item?.reason ?? "미제공"}</small> : null}</span></li>;
      })}</ul></section>
    <section className="panel"><div className="panel-heading"><h2>항목별 비교</h2><span className="subtle">금액을 열어 원 단위와 산출 근거 확인</span></div>
      <div className="financial-table-scroll" role="region" tabIndex={0} aria-label="기업별 예시 재무 비교 표, 가로 스크롤 가능"><table className="financial-table compare-table">
        <caption>{period} · {basisLabels[view.basis]} · 예시 재무정보, 실제 기업 실적이 아닙니다</caption>
        <thead><tr><th scope="col">항목</th>{entries.map((entry) => <th scope="col" key={entry.symbol}><Link href={`/stocks/${entry.symbol}?tab=financials`}>{getInstrument(entry.symbol)?.name}</Link><small>{entry.symbol}</small></th>)}</tr></thead>
        <tbody>{comparisonMetrics.map((metric) => <tr key={metric}><th scope="row">{metricLabels[metric]}</th>{entries.map((entry) => {
          const { item, reason } = comparableItem(entries, entry, metric);
          return <td key={entry.symbol}>{item ? <MetricCell item={item} /> : <><span>—</span><small className="cell-reason">{reason}</small></>}</td>;
        })}</tr>)}<tr><th scope="row">영업이익률<small>영업이익 ÷ 매출</small></th>{entries.map((entry) => {
          const revenue = comparableItem(entries, entry, "revenue").item;
          const profit = comparableItem(entries, entry, "operatingProfit").item;
          const margin = revenue && profit && compatible(revenue, profit) ? operatingMargin(profit.value, revenue.value) : null;
          return <td key={entry.symbol}>{margin ?? "—"}<small className="cell-reason">{margin ? "같은 기간·기준의 계산값" : "매출 미제공·0 이하, 이익 미제공 또는 기준 불일치"}</small></td>;
        })}</tr></tbody></table></div>
      <div className="panel-foot">자료가 없는 기업은 미제공으로 표시합니다. 다른 재무 기준으로 대체하지 않습니다.</div></section>
    <div className="comparison-links">{entries.map((entry) => <Link key={entry.symbol} className="button-link" href={`/notes?symbol=${entry.symbol}`}>{getInstrument(entry.symbol)?.name} 노트 쓰기 →</Link>)}</div>
    <p className="financial-provenance">출처: 직접 작성한 예시 · {entries.map((entry) => `${getInstrument(entry.symbol)?.name}: ${entry.data?.generatedAt.slice(0, 10) ?? "미제공"}`).join(" / ")} · 실제 공시 수집일이 아닙니다.</p>
  </>;
}
