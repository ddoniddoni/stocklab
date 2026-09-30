"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { HistoryResult } from "@/domain/market";
import { useLocalHistory } from "../market-context";
import { number, time } from "@/lib/formatting/market";

export function LocalHistory({ symbol }: { symbol: string }) {
  const getHistory = useLocalHistory();
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [state, setState] = useState<{ status: "idle" | "loading" | "ready" | "error"; result?: HistoryResult; message?: string; at?: number; range?: string }>({ status: "idle" });
  const [page, setPage] = useState(0);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => { pending.current?.abort(); }, []);
  async function load(start: string, end: string) {
    pending.current?.abort(); const controller = new AbortController(); pending.current = controller;
    setState({ status: "loading" }); setPage(0);
    try {
      const result = await getHistory({ symbol, interval: "1d", from: start, to: end }, controller.signal);
      if (!controller.signal.aborted) setState({ status: "ready", result, at: Date.now(), range: `${start} ~ ${end}` });
    } catch {
      if (!controller.signal.aborted) setState({ status: "error", message: "일봉을 불러오지 못했습니다. 연결 상태와 날짜(최대 366일)를 확인하고 다시 요청하세요." });
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void load(from, to); }
  const candles = state.result?.candles.toReversed() ?? [];
  const pageCount = Math.ceil(candles.length / 20);
  return <section className="panel local-history">
    <div className="panel-heading"><h2>KRX 과거 일봉</h2><span className="subtle">원주가 · 한국투자증권</span></div>
    <form className="history-form" onSubmit={submit}>
      <label>시작일<input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} required /></label>
      <label>종료일<input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} required /></label>
      <button type="submit" disabled={state.status === "loading"}>조회</button>
      <button type="button" disabled={state.status === "loading"} onClick={() => {
        const today = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
        const start = new Date(Date.parse(today) - 29 * 86_400_000).toISOString().slice(0, 10);
        setFrom(start); setTo(today); void load(start, today);
      }}>최근 30일 조회</button>
    </form>
    {state.status === "idle" ? <p className="panel-foot">기간을 선택해 조회하세요. 최대 366일이며, 실시간 수신 캔들과 별도 자료입니다.</p> : null}
    {state.status === "loading" ? <p className="panel-foot" role="status">일봉을 조회하고 있습니다…</p> : null}
    {state.status === "error" ? <p className="panel-foot" role="alert">{state.message}</p> : null}
    {state.result ? <>
      <p className="panel-foot">{state.range} · 조회 {time(state.at!)} KST · {candles.length}개</p>
      {state.result.warnings.map((warning) => <p className="panel-foot" key={warning}>{warning}</p>)}
      {!candles.length ? <p className="panel-foot" role="status">이 기간에 제공된 일봉이 없습니다.</p> : <>
        <div className="history-table" tabIndex={0} role="region" aria-label="일봉 수치 표 스크롤"><table>
          <caption className="sr-only">KRX 원주가 일봉 · 가격 원, 거래량 주 · 휴장·미제공 일자는 보간하지 않습니다</caption>
          <thead><tr>{["거래일", "시가", "고가", "저가", "종가", "거래량"].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
          <tbody>{candles.slice(page * 20, (page + 1) * 20).map((candle) => candle.time.kind === "trading-date" ? <tr key={candle.time.date}>
            <th scope="row">{candle.time.date}</th>{[candle.open, candle.high, candle.low, candle.close, candle.volume].map((value, index) => <td className="numeric" key={index}>{number(value)}</td>)}
          </tr> : null)}</tbody>
        </table></div>
        <nav className="history-form" aria-label="일봉 페이지"><button type="button" disabled={!page} onClick={() => setPage(page - 1)}>이전</button><span>{page + 1} / {pageCount}</span><button type="button" disabled={page + 1 >= pageCount} onClick={() => setPage(page + 1)}>다음</button></nav>
      </>}
    </> : null}
  </section>;
}
