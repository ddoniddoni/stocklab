"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { ReactNode } from "react";
import type { FinancialView } from "@/domain/financials/model";
import type { MarketSnapshot } from "@/domain/market";
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
              {stock.symbol} <span>·</span> 보통주 <span>·</span> SIM
            </p>
          </div>
        </div>
        <StockResearchActions symbol={stock.symbol} />
      </div>
      <StorageStatus />
      <StockQuote quote={quote} />
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
            {label}
          </Link>
        ))}
        <small>집계 간격은 1분입니다.</small>
      </nav> : null}
      {isResearch ? research : view.tab === "overview" ? (
        <div className="workspace-grid">
          <div className="chart-column">
            <CandlePanel snapshot={snapshot} period={view.period} />
            <RecentTrades trades={trades} />
          </div>
          <OrderBookView book={orderBook} lastPrice={quote.lastPrice} />
        </div>
      ) : view.tab === "orderbook" ? (
        <OrderBookView book={orderBook} lastPrice={quote.lastPrice} />
      ) : (
        <RecentTrades trades={trades} />
      )}
      <p className="data-footer">
        시세는 하나의 합성 세션에서 생성합니다. 재무·공시는 화면에 표시된 별도 출처의 자료이며,
        합성 시세는 실제 주가가 아닙니다. 재무자료의 출처와 기준은 각 화면에서 확인하세요.
      </p>
    </>
  );
}

function StockQuote({ quote }: { quote: MarketSnapshot["quote"] }) {
  return (
    <div
      className="quote-strip"
      data-testid="quote"
      data-session={quote.sessionId}
      data-sequence={quote.sequence}
    >
      <div>
        <p className="eyebrow">합성 현재가</p>
        <div className="big-price" data-testid="last-price">
          {number(quote.lastPrice)}
          <span>원</span>
        </div>
        <p className={`price-change ${direction(quote.change ?? 0)}`}>
          {(quote.change ?? 0) >= 0 ? "▲" : "▼"} {signed(quote.change ?? 0)}원{" "}
          <span>
            ({(quote.changePercent ?? 0) >= 0 ? "+" : ""}
            {(quote.changePercent ?? 0).toFixed(2)}%)
          </span>
          <small>합성 기준가 대비</small>
        </p>
      </div>
      <dl className="quote-stats">
        <div>
          <dt>합성 기준가</dt>
          <dd>
            {number(quote.previousClose ?? 0)}
            <small>원</small>
          </dd>
        </div>
        <div>
          <dt>세션 누적 거래량</dt>
          <dd>
            {number(quote.cumulativeVolume ?? "0")}
            <small>주</small>
          </dd>
        </div>
        <div>
          <dt>마지막 합성 체결</dt>
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
  snapshot: MarketSnapshot;
  period: DetailView["period"];
}) {
  const { quote } = snapshot;
  const candles = visibleCandles(snapshot.candles, period, quote.eventTimeMs);
  const last = candles.at(-1);
  const periodLabel = {
    session: "데모 세션",
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
        <PriceChart candles={candles} sessionId={quote.sessionId} />
      ) : (
        <p className="chart-loading" role="status">
          이 기간에는 합성 캔들이 없습니다.
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
        합성 체결을 모두 집계합니다. 붉은 캔들: 상승 · 푸른 캔들: 하락
      </div>
    </section>
  );
}
