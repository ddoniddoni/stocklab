"use client";
import Link from "next/link";
import { instrument } from "@/domain/instruments";
import { direction, number } from "@/lib/formatting/market";
import { useMarket } from "../market-context";
export function HomeMarket() {
  const { snapshot } = useMarket();
  const { quote } = snapshot;
  return (
    <section className="panel home-table">
      <div className="panel-heading">
        <h2>지원 종목</h2>
        <span className="subtle">1종목 · 합성 시세</span>
      </div>
      <table>
        <caption className="sr-only">
          지원 종목의 합성 현재가와 합성 등락
        </caption>
        <thead>
          <tr>
            <th scope="col">종목</th>
            <th scope="col">합성 현재가</th>
            <th scope="col">합성 등락률</th>
            <th scope="col" className="volume-col">
              합성 거래량
            </th>
            <th scope="col">
              <span className="sr-only">상세</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">
              <Link
                href={`/stocks/${instrument.symbol}`}
                className="stock-name"
              >
                {instrument.name}
                <small>
                  {instrument.symbol} · {instrument.kind}
                </small>
              </Link>
            </th>
            <td className="numeric">
              {number(quote.lastPrice)}
              <small className="unit">원</small>
            </td>
            <td className={`numeric ${direction(quote.change ?? 0)}`}>
              {(quote.changePercent ?? 0) >= 0 ? "+" : ""}
              {(quote.changePercent ?? 0).toFixed(2)}
              <span className="sr-only"> 퍼센트</span>
              <span aria-hidden="true">%</span>
            </td>
            <td className="numeric volume-col">
              {number(quote.cumulativeVolume ?? "0")}
              <small className="unit">주</small>
            </td>
            <td>
              <Link
                className="row-link"
                href={`/stocks/${instrument.symbol}`}
                aria-label="삼성전자 상세 보기"
              >
                ↗
              </Link>
            </td>
          </tr>
        </tbody>
      </table>
      <div className="panel-foot">
        SIM 시장 · 직접 생성한 가격과 거래량입니다.
      </div>
    </section>
  );
}
