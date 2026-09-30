"use client";
import { useId, useTransition } from "react";
import { useRouter } from "next/navigation";
import { detailHref, type DetailView } from "@/domain/market-view";
import { basisLabels, type FinancialView } from "@/domain/financials/model";

export function FinancialFilters({ symbol, detail, selected, years }: {
  symbol: string; detail: DetailView; selected: FinancialView; years: readonly number[];
}) {
  const id = useId();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function update(next: Partial<FinancialView>) {
    startTransition(() => router.push(detailHref(symbol, detail, { ...selected, ...next }), { scroll: false }));
  }
  return (
    <div className="financial-filters" aria-busy={pending}>
      <div>
        <label htmlFor={`${id}-basis`}>회계 기준</label>
        <select id={`${id}-basis`} value={selected.basis} disabled={pending}
          onChange={(event) => update({ basis: event.target.value === "OFS" ? "OFS" : "CFS" })}>
          <option value="CFS">{basisLabels.CFS}</option>
          <option value="OFS">{basisLabels.OFS}</option>
        </select>
      </div>
      {detail.tab === "financials" ? (
        <div>
          <label htmlFor={`${id}-view`}>재무 기간</label>
          <select id={`${id}-view`} value={selected.view} disabled={pending}
            onChange={(event) => update({ view: event.target.value === "quarter" ? "quarter" : "annual" })}>
            <option value="annual">연간</option>
            <option value="quarter">단일 분기</option>
          </select>
        </div>
      ) : null}
      <div>
        <label htmlFor={`${id}-year`}>사업연도</label>
        <select id={`${id}-year`} value={selected.year} disabled={pending}
          onChange={(event) => update({ year: Number(event.target.value) })}>
          {years.map((year) => <option key={year} value={year}>{year}년</option>)}
        </select>
      </div>
      <span className="financial-filter-status" role="status">
        {pending ? "선택한 기간을 불러오는 중…" : "필터는 주소에 저장됩니다"}
      </span>
    </div>
  );
}
