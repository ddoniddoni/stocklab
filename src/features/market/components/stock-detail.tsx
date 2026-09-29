"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { instrument } from "@/domain/instruments";
import { direction, number, signed, time } from "@/lib/formatting/market";
import { useMarket } from "../market-context";
import { MarketControls } from "./market-controls";
import { OrderBookView } from "./order-book";
import { RecentTrades } from "./recent-trades";
import { SourceNotice } from "./source-notice";
const PriceChart = dynamic(() => import("./price-chart"), {
  ssr: false,
  loading: () => (
    <div className="chart-loading" role="status">
      캔들 차트를 준비하고 있습니다…
    </div>
  ),
});
export function StockDetail() {
  const { snapshot } = useMarket();
  const { quote, candles, orderBook, trades } = snapshot;
  const last = candles.at(-1)!;
  return (
    <>
      <Link href="/" className="back-link">
        ← 종목 탐색
      </Link>
      <SourceNotice />
      <div className="stock-heading">
        <div className="stock-identity">
          <span className="instrument-icon" aria-hidden="true">
            삼
          </span>
          <div>
            <h1>{instrument.name}</h1>
            <p>
              {instrument.symbol} <span>·</span> 보통주 <span>·</span> SIM
            </p>
          </div>
        </div>
        <span className="subtle">데모 세션 · 2026.01.05</span>
      </div>
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
      <MarketControls />
      <div className="workspace-grid">
        <div className="chart-column">
          <section className="panel">
            <div className="panel-heading">
              <h2>가격 흐름</h2>
              <div className="chart-legend">
                <span className="interval-badge">1분 캔들</span>
                <span>데모 세션</span>
              </div>
            </div>
            <PriceChart candles={candles} sessionId={quote.sessionId} />
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
            <div className="panel-foot">
              합성 체결을 모두 집계합니다. 붉은 캔들: 상승 · 푸른 캔들: 하락
            </div>
          </section>
          <RecentTrades trades={trades} />
        </div>
        <OrderBookView book={orderBook} lastPrice={quote.lastPrice} />
      </div>
      <p className="data-footer">
        하나의 합성 세션에서 현재가, 캔들, 호가, 체결을 생성합니다. 재무정보와
        공시는 이 단계에서 제공하지 않습니다.
      </p>
    </>
  );
}
