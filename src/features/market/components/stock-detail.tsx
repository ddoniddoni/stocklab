"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { ReactNode } from "react";
import type { FinancialView } from "@/domain/financials/model";
import type { MarketViewSnapshot } from "@/domain/local-market";
import { type Instrument } from "@/domain/instruments";
import {
  detailHref,
  visibleCandles,
  type DetailView,
} from "@/domain/market-view";
import { direction, number, signed, time } from "@/lib/formatting/market";
import { useMarket } from "../market-context";
import { MarketControls } from "./market-controls";
import { OrderBookView } from "./order-book";
import { RecentTrades } from "./recent-trades";
import { SourceNotice } from "./source-notice";
import { LocalHistory } from "./local-history";
import { StockResearchActions, StorageStatus } from "@/features/personal/personal-controls";
const PriceChart = dynamic(() => import("./price-chart"), {
  ssr: false,
  loading: () => (
    <div className="chart-loading" role="status">
      캔들 차트를 준비하고 있습니다…
    </div>
  ),
});
export function StockDetail({
  stock,
  view,
  financialView,
  research,
}: {
  stock: Instrument;
  view: DetailView;
  financialView?: FinancialView;
  research?: ReactNode;
}) {
  const { snapshot } = useMarket(stock.symbol);
  const { quote, orderBook, trades } = snapshot;
  const local = snapshot.manifest.source === "kis-private";
  const isResearch = view.tab === "financials" || view.tab === "filings";
  return (
    <>
      <Link href="/" className="back-link">
        ← 종목 탐색
      </Link>
      <SourceNotice />
      <div className="stock-heading">
        <div className="stock-identity">
          <span className="instrument-icon" aria-hidden="true">
            {stock.name.slice(0, 1)}
          </span>
          <div>
            <h1>{stock.name}</h1>
            <p>
              {stock.symbol} <span>·</span> 보통주 <span>·</span> {local ? "KRX" : "SIM"}
            </p>
          </div>
        </div>
        <StockResearchActions symbol={stock.symbol} />
      </div>
      <StorageStatus />
      <StockQuote quote={quote} />
      {local ? <p className="stream-message" role="status">{snapshot.status === "live" ? "이 종목의 시세를 수신하고 있습니다." : "이 종목의 최신 수신을 확인하지 못했습니다."} {snapshot.message}</p> : null}
      <MarketControls />
      <nav className="view-nav detail-nav" aria-label="상세 화면 보기">
        {(
          [
            ["overview", "개요"],
            ["orderbook", "호가"],
            ["trades", "체결"],
            ["financials", "재무"],
            ["filings", "공시"],
          ] as const
        ).map(([tab, label]) => (
          <Link
            key={tab}
            href={detailHref(stock.symbol, { ...view, tab }, financialView)}
            scroll={false}
            aria-current={view.tab === tab ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      {!isResearch ? <nav className="period-nav" aria-label="캔들 표시 기간">
        <span>표시 기간</span>
        {(
          [
            ["session", "데모 세션"],
            ["30m", "최근 30분"],
            ["15m", "최근 15분"],
          ] as const
        ).map(([period, label]) => (
          <Link
            key={period}
            href={detailHref(stock.symbol, { ...view, period }, financialView)}
            scroll={false}
            aria-current={view.period === period ? "page" : undefined}
          >
            {period === "session" && local ? "수신 구간" : label}
          </Link>
        ))}
        <small>집계 간격은 1분입니다.</small>
      </nav> : null}
      {isResearch ? research : view.tab === "overview" ? (
        <div className="workspace-grid">
          <div className="chart-column">
            <CandlePanel snapshot={snapshot} period={view.period} />
            {local ? <LocalHistory key={stock.symbol} symbol={stock.symbol} /> : null}
            <RecentTrades trades={trades} local={local} />
          </div>
          <OrderBookView book={orderBook} lastPrice={quote?.lastPrice ?? null} />
        </div>
      ) : view.tab === "orderbook" ? (
        <OrderBookView book={orderBook} lastPrice={quote?.lastPrice ?? null} />
      ) : (
        <RecentTrades trades={trades} local={local} />
      )}
      <p className="data-footer">
        {local ? "시세는 한국투자증권 KRX의 개인 로컬 수신 자료입니다. 수신 이전·중단 구간은 집계에서 빠질 수 있습니다." : "시세는 하나의 합성 세션에서 생성하며 실제 주가가 아닙니다."} 재무·공시의 별도 출처와 기준은 각 화면에서 확인하세요.
      </p>
    </>
  );
}

function StockQuote({ quote }: { quote: MarketViewSnapshot["quote"] }) {
  if (!quote) return <div className="quote-strip" role="status">표시할 시세가 없습니다. 연결 후 수신을 기다립니다.</div>;
  const local = quote.source === "kis-private";
  return (
    <div
      className="quote-strip"
      data-testid="quote"
      data-session={quote.sessionId}
      data-sequence={quote.sequence}
    >
      <div>
        <p className="eyebrow">{local ? "KRX 현재가" : "합성 현재가"}</p>
        <div className="big-price" data-testid="last-price">
          {number(quote.lastPrice)}
          <span>원</span>
        </div>
        <p className={`price-change ${direction(quote.change ?? 0)}`}>
          {quote.change !== null && quote.changePercent !== null ? <>
          {(quote.change ?? 0) >= 0 ? "▲" : "▼"} {signed(quote.change ?? 0)}원{" "}
          <span>
            ({(quote.changePercent ?? 0) >= 0 ? "+" : ""}
            {(quote.changePercent ?? 0).toFixed(2)}%)
          </span>
          </> : "전일 대비 미제공"}
          <small>{local ? "전일 대비" : "합성 기준가 대비"}</small>
        </p>
      </div>
      <dl className="quote-stats">
        <div>
          <dt>{local ? "전일 비교 기준가 (계산)" : "합성 기준가"}</dt>
          <dd>
            {quote.previousClose === null ? "—" : number(quote.previousClose)}
            <small>원</small>
          </dd>
        </div>
        <div>
          <dt>{local ? "원천 누적 거래량" : "세션 누적 거래량"}</dt>
          <dd>
            {quote.cumulativeVolume === null ? "—" : number(quote.cumulativeVolume)}
            <small>주</small>
          </dd>
        </div>
        <div>
          <dt>{local ? quote.timeBasis === "retrieved" ? "조회 시각 (체결 시각 미제공)" : "마지막 수신 체결" : "마지막 합성 체결"}</dt>
          <dd>
            {time(quote.eventTimeMs)}
            <small>KST</small>
          </dd>
        </div>
      </dl>
    </div>
  );
}
function CandlePanel({
  snapshot,
  period,
}: {
  snapshot: MarketViewSnapshot;
  period: DetailView["period"];
}) {
  const { quote } = snapshot;
  const local = snapshot.manifest.source === "kis-private";
  const candles = visibleCandles(snapshot.candles, period, quote?.eventTimeMs ?? 0);
  const last = candles.at(-1);
  const periodLabel = {
    session: local ? "수신 구간" : "데모 세션",
    "30m": "최근 30분",
    "15m": "최근 15분",
  }[period];
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>가격 흐름</h2>
        <div className="chart-legend">
          <span className="interval-badge">1분 캔들</span>
          <span>
            {periodLabel} · {candles.length}개
          </span>
        </div>
      </div>
      {candles.length ? (
        <PriceChart candles={candles} sessionId={quote?.sessionId ?? "pending"} local={local} />
      ) : (
        <p className="chart-loading" role="status">
          {local ? "이 수신 구간에는 집계한 체결이 없습니다." : "이 기간에는 합성 캔들이 없습니다."}
        </p>
      )}
      {last ? (
        <table className="candle-summary" data-testid="candle-summary">
          <caption>진행 중인 1분 캔들 · 가격: 원 / 거래량: 주</caption>
          <thead>
            <tr>
              {["시가", "고가", "저가", "종가", "거래량"].map((title) => (
                <th scope="col" key={title}>
                  {title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{number(last.open)}</td>
              <td className="up">{number(last.high)}</td>
              <td className="down">{number(last.low)}</td>
              <td>{number(last.close)}</td>
              <td>{number(last.volume)}</td>
            </tr>
          </tbody>
        </table>
      ) : null}
      <div className="panel-foot">
        {local ? "연결 이후 수신한 체결만 집계합니다. 중단·이동·숨김 구간은 복원하지 않습니다." : "합성 체결을 모두 집계합니다."} 붉은 캔들: 상승 · 푸른 캔들: 하락
      </div>
    </section>
  );
}
