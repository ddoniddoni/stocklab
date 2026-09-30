import { barPercent, compactWon } from "@/domain/financials/amounts";
import { metricLabels, type FinancialColumn, type MetricKey } from "@/domain/financials/model";

const chartMetrics = ["revenue", "operatingProfit", "netProfit"] as const satisfies readonly MetricKey[];
export function FinancialChart({ columns, source = "fixture" }: { columns: FinancialColumn[]; source?: "fixture" | "opendart" }) {
  const values = columns.flatMap((column) => column.metrics.filter((item) => chartMetrics.some((metric) => metric === item.metric)))
    .flatMap((item) => item.value === null ? [] : [BigInt(item.value)]);
  const maximum = values.reduce((max, value) => {
    const absolute = value < 0n ? -value : value;
    return absolute > max ? absolute : max;
  }, 0n);
  return (
    <section className="panel financial-chart-panel" aria-labelledby="financial-chart-title">
      <div className="panel-heading"><h2 id="financial-chart-title">기간별 손익 흐름</h2><span className="subtle">{source === "fixture" ? "예시" : "공시 캐시"} · 공통 금액 축</span></div>
      <p className="financial-chart-note">가운데 선은 0원입니다. 왼쪽은 음수, 오른쪽은 양수이며 정확한 값은 아래 표에서도 확인할 수 있습니다.</p>
      <div className="financial-chart-legend" aria-hidden="true">
        {chartMetrics.map((metric) => <span key={metric}><i className={`financial-series-${metric}`} />{metricLabels[metric]}</span>)}
      </div>
      <div className="financial-chart-groups">
        {columns.map((column) => (
          <div className="financial-chart-group" key={column.key}>
            <h3>{column.label}</h3>
            {chartMetrics.map((metric) => {
              const item = column.metrics.find((value) => value.metric === metric);
              const value = item?.value ?? null;
              const width = value === null ? 0 : barPercent(value, maximum) / 2;
              const negative = value !== null && BigInt(value) < 0n;
              return (
                <div className="financial-chart-row" key={metric}>
                  <span className="sr-only">{metricLabels[metric]}</span>
                  <div className="financial-bar-track" aria-hidden="true">
                    {value !== null ? <span className={`financial-bar financial-series-${metric}`}
                      data-zero={BigInt(value) === 0n || undefined}
                      style={{ width: `${width}%`, left: `${negative ? 50 - width : 50}%` }} /> : null}
                  </div>
                  <span className="financial-chart-value">{compactWon(value)}{value === null ? " · 미제공" : ""}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="panel-foot">막대는 반올림 전 원 단위 비율로 표시합니다. 기업의 투자 우열이나 합성 주가의 반응을 뜻하지 않습니다.</div>
    </section>
  );
}
