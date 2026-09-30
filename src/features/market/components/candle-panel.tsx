"use client";
import dynamic from "next/dynamic";
import { useId, useState } from "react";
import type { Candle } from "@/domain/market";
import type { MarketViewSnapshot } from "@/domain/local-market";
import { visibleCandles, type DetailView } from "@/domain/market-view";
import { dateTime, number } from "@/lib/formatting/market";
import { useMarketReading } from "../market-context";

const PriceChart = dynamic(() => import("./price-chart"), {
  ssr: false,
  loading: () => <div className="chart-loading" role="status">캔들 차트를 준비하고 있습니다…</div>,
});
const candleLabel = (candle: Candle) => candle.time.kind === "instant" ? `${dateTime(candle.time.epochMs)} KST` : candle.time.date;
const candleKey = (candle: Candle) => candle.time.kind === "instant" ? `instant:${candle.time.epochMs}` : `date:${candle.time.date}`;

export function CandlePanel({ snapshot, period, symbol }: { snapshot: MarketViewSnapshot; period: DetailView["period"]; symbol: string }) {
  const { snapshot: reading, freeze, refresh } = useMarketReading();
  const [preferredView, setPreferredView] = useState<"chart" | "table">("chart");
  const id = useId();
  const { quote } = snapshot;
  const local = snapshot.manifest.source === "kis-private";
  const candles = visibleCandles(snapshot.candles, period, quote?.eventTimeMs ?? 0);
  const last = candles.at(-1);
  // Resuming updates always returns to the chart; a numeric table never moves while read.
  const table = preferredView === "table" && reading.frozen;
  const periodLabel = { session: local ? "수신 구간" : "데모 세션", "30m": "최근 30분", "15m": "최근 15분" }[period];
  return <section className="panel candle-panel" aria-labelledby={`${id}-title`}>
    <div className="panel-heading">
      <h2 id={`${id}-title`}>가격 흐름</h2>
      <div className="chart-legend"><span className="interval-badge">1분 캔들</span><span>{periodLabel} · {candles.length}개{reading.frozen ? " · 고정" : ""}</span></div>
    </div>
    <div className="candle-toolbar">
      <fieldset className="candle-view-picker" aria-describedby={`${id}-help`}>
        <legend>캔들 보기 방식</legend>
        <label><input type="radio" name={`${id}-view`} value="chart" checked={!table} onChange={() => setPreferredView("chart")} />차트</label>
        <label><input type="radio" name={`${id}-view`} value="table" checked={table} onChange={() => { freeze(); setPreferredView("table"); }} />수치표 · 화면 고정</label>
      </fieldset>
      {table ? <button type="button" onClick={refresh}>표에 최신 값 반영</button> : null}
    </div>
    <p className="candle-view-help" id={`${id}-help`}>수치표는 현재 기간의 모든 캔들을 최신순으로 보여줍니다. 선택하면 시세 화면 전체를 고정합니다. 자동 갱신으로 돌아가면 차트로 전환합니다.</p>
    {table ? <CandleTable key={`${symbol}:${period}:${reading.revision}`} candles={candles} local={local} periodLabel={periodLabel} /> : <>
      {candles.length ? <PriceChart candles={candles} sessionId={quote?.sessionId ?? "pending"} local={local} frozen={reading.frozen} descriptionId={`${id}-help`} />
        : <p className="chart-loading" role="status">{local ? "이 수신 구간에는 집계한 체결이 없습니다." : "이 기간에는 합성 캔들이 없습니다."}</p>}
      {last ? <table className="candle-summary" data-testid="candle-summary">
        <caption>{reading.frozen ? "고정 시점의 마지막" : "마지막 집계"} 1분 캔들 · 가격: 원 / 거래량: 주 <span className="candle-summary-time">시작 {candleLabel(last)}{local ? " · 부분 수신 가능" : ""}</span></caption>
        <thead><tr>{["시가", "고가", "저가", "종가", "거래량"].map((title) => <th scope="col" key={title}>{title}</th>)}</tr></thead>
        <tbody><tr><td>{number(last.open)}</td><td className="up">{number(last.high)}</td><td className="down">{number(last.low)}</td><td>{number(last.close)}</td><td>{number(last.volume)}</td></tr></tbody>
      </table> : null}
    </>}
    <div className="panel-foot">{local ? "연결 이후 수신한 체결만 집계합니다. 중단·이동·숨김 구간은 복원하지 않습니다." : "합성 체결을 모두 집계합니다. 실제 주가가 아닙니다."} 붉은 캔들: 상승 · 푸른 캔들: 하락</div>
  </section>;
}

function CandleTable({ candles, local, periodLabel }: { candles: readonly Candle[]; local: boolean; periodLabel: string }) {
  const [page, setPage] = useState(0);
  const id = useId();
  const pageSize = 20;
  const pages = Math.ceil(candles.length / pageSize);
  const rows = candles.toReversed().slice(page * pageSize, (page + 1) * pageSize);
  if (!candles.length) return <p className="candle-empty" role="status">고정한 시점에는 이 기간의 캔들이 없습니다. 수신 후 ‘표에 최신 값 반영’을 누르세요.</p>;
  return <>
    <p className="candle-table-note" id={`${id}-note`}>가격은 원, 거래량은 주입니다. 마지막 캔들은 아직 완성되지 않았을 수 있습니다.{local ? " KRX 수신 구간의 부분 집계이며 원천의 전체 분봉이 아닙니다." : " 직접 생성한 합성 데이터입니다."}</p>
    <div className="candle-table-scroll" tabIndex={0} role="region" aria-label="고정한 캔들 수치표 스크롤" aria-describedby={`${id}-note`}>
      <table className="candle-table" data-testid="candle-table">
        <caption>{local ? "KRX 수신" : "합성"} 1분 캔들 · {periodLabel} · 최신순 · {page * pageSize + 1}–{Math.min((page + 1) * pageSize, candles.length)} / {candles.length}개</caption>
        <thead><tr>{["캔들 시작 시각", "시가", "고가", "저가", "종가", "거래량"].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{rows.map((candle) => <tr key={candleKey(candle)}>
          <th scope="row">{candleLabel(candle)}</th>
          <td>{number(candle.open)}</td><td>{number(candle.high)}</td><td>{number(candle.low)}</td><td>{number(candle.close)}</td><td>{number(candle.volume)}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <nav className="candle-pagination" aria-label="캔들 수치표 페이지">
      <button type="button" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>이전 페이지</button>
      <span role="status" aria-atomic="true">{page + 1} / {pages} 페이지</span>
      <button type="button" disabled={page + 1 >= pages} onClick={() => setPage((value) => value + 1)}>다음 페이지</button>
    </nav>
  </>;
}
