"use client";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { instruments, type Instrument } from "@/domain/instruments";
import { parseWatchSymbols, watchHref } from "@/domain/market-view";
import { direction, number } from "@/lib/formatting/market";
import { useQuote } from "../market-context";
function QuoteRow({
  stock,
  selected,
  toggle,
}: {
  stock: Instrument;
  selected: boolean;
  toggle: () => void;
}) {
  const quote = useQuote(stock.symbol);
  return (
    <tr
      data-testid={`home-quote-${stock.symbol}`}
      data-time={quote.eventTimeMs}
      data-session={quote.sessionId}
    >
      <th scope="row">
        <Link href={`/stocks/${stock.symbol}`} className="stock-name">
          {stock.name}
          <small>
            {stock.symbol} · {stock.kind}
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
        <button
          type="button"
          className="watch-button"
          aria-label={`${stock.name} 선택 종목 ${selected ? "해제" : "추가"}`}
          aria-pressed={selected}
          onClick={toggle}
        >
          {selected ? "★" : "☆"}
        </button>
      </td>
    </tr>
  );
}
export function HomeMarket() {
  const query = useSearchParams();
  const router = useRouter();
  const selected = parseWatchSymbols(query.get("symbols"));
  const selectedSet = new Set(selected);
  const watchOnly = query.get("view") === "watchlist";
  const stocks = instruments.filter(
    (stock) => !watchOnly || selectedSet.has(stock.symbol),
  );
  return (
    <section className="panel home-table">
      <div className="panel-heading">
        <h2>{watchOnly ? "선택 종목" : "지원 종목"}</h2>
        <span className="subtle">{stocks.length}종목 · 합성 시세</span>
      </div>
      <nav className="view-nav" aria-label="종목 목록 보기">
        <Link
          href={watchHref(selected, false)}
          aria-current={!watchOnly ? "page" : undefined}
        >
          전체 종목
        </Link>
        <Link
          href={watchHref(selected, true)}
          aria-current={watchOnly ? "page" : undefined}
        >
          선택 종목 ({selected.length})
        </Link>
      </nav>
      {stocks.length ? (
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
                <span className="sr-only">선택 종목</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((stock) => (
              <QuoteRow
                key={stock.symbol}
                stock={stock}
                selected={selectedSet.has(stock.symbol)}
                toggle={() =>
                  router.push(
                    watchHref(
                      selectedSet.has(stock.symbol)
                        ? selected.filter((symbol) => symbol !== stock.symbol)
                        : [...selected, stock.symbol],
                      watchOnly,
                    ),
                    { scroll: false },
                  )
                }
              />
            ))}
          </tbody>
        </table>
      ) : (
        <div className="empty-watch" role="status">
          <h3>선택한 종목이 없습니다</h3>
          <p>전체 종목에서 별표를 눌러 시세 목록을 구성하세요.</p>
          <Link href={watchHref(selected, false)}>전체 종목 보기 →</Link>
        </div>
      )}
      <div className="panel-foot">
        SIM 시장 · 선택 목록은 이 페이지 URL에 담깁니다. 시세는 직접 생성합니다.
      </div>
    </section>
  );
}
