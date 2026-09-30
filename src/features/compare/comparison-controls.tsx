"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { instruments } from "@/domain/instruments";
import { comparisonHref, comparisonMetrics, type ComparisonView } from "@/domain/comparison";
import { metricLabels } from "@/domain/financials/model";

export function ComparisonControls({ view, years }: { view: ComparisonView; years: readonly number[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function update(patch: Partial<ComparisonView>) {
    startTransition(() => router.push(comparisonHref({ ...view, ...patch }), { scroll: false }));
  }
  return <div aria-busy={pending}><fieldset className="compare-picker" disabled={pending}><legend>비교할 기업 <span className="subtle">{view.symbols.length} / 3</span></legend>
    {instruments.map((stock) => <label key={stock.symbol}><input type="checkbox" checked={view.symbols.includes(stock.symbol)}
      disabled={!view.symbols.includes(stock.symbol) && view.symbols.length >= 3}
      onChange={(event) => update({ symbols: event.target.checked ? [...view.symbols, stock.symbol] : view.symbols.filter((item) => item !== stock.symbol) })} />
      <span>{stock.name}<small>{stock.symbol}</small></span></label>)}</fieldset>
    <div className="financial-filters">
      <div><label htmlFor="compare-basis">재무 기준</label><select id="compare-basis" value={view.basis} disabled={pending} onChange={(event) => update({ basis: event.target.value === "OFS" ? "OFS" : "CFS" })}><option value="CFS">연결</option><option value="OFS">별도</option></select></div>
      <div><label htmlFor="compare-view">표시 기간</label><select id="compare-view" value={view.view} disabled={pending} onChange={(event) => update({ view: event.target.value === "quarter" ? "quarter" : "annual" })}><option value="annual">연간</option><option value="quarter">단일 분기</option></select></div>
      <div><label htmlFor="compare-year">사업연도</label><select id="compare-year" value={view.year} disabled={pending} onChange={(event) => update({ year: Number(event.target.value) })}>{years.map((year) => <option key={year} value={year}>{year}년</option>)}</select></div>
      {view.view === "quarter" ? <div><label htmlFor="compare-quarter">분기</label><select id="compare-quarter" value={view.quarter} disabled={pending} onChange={(event) => update({ quarter: Number(event.target.value) as ComparisonView["quarter"] })}>{[1, 2, 3, 4].map((quarter) => <option key={quarter} value={quarter}>{quarter}분기</option>)}</select></div> : null}
      <div><label htmlFor="compare-metric">차트 항목</label><select id="compare-metric" value={view.metric} disabled={pending} onChange={(event) => update({ metric: event.target.value as ComparisonView["metric"] })}>{comparisonMetrics.map((metric) => <option key={metric} value={metric}>{metricLabels[metric]}</option>)}</select></div>
      <p className="financial-filter-status" role="status">{pending ? "비교 자료를 불러오는 중…" : "같은 기간과 기준으로 비교합니다"}</p>
    </div></div>;
}
