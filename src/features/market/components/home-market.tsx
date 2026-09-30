"use client";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { instruments, type Instrument } from "@/domain/instruments";
import { parseWatchSymbols, watchHref } from "@/domain/market-view";
import { direction, number } from "@/lib/formatting/market";
import { usePersonal, usePersonalStore } from "@/features/personal/personal-context";
import { StorageStatus, WatchButton } from "@/features/personal/personal-controls";
import { useQuote } from "../market-context";
function QuoteRow({
  stock,
}: {
  stock: Instrument;
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
        <WatchButton symbol={stock.symbol} />
      </td>
    </tr>
  );
}
export function HomeMarket() {
  const query = useSearchParams();
  const router = useRouter();
  const snapshot = usePersonal();
  const store = usePersonalStore();
  const legacy = query.has("symbols");
  const selected = legacy ? parseWatchSymbols(query.get("symbols")) : snapshot.data?.watchlist ?? [];
  const watchOnly = query.get("view") === "watchlist";
  const stocks = watchOnly ? selected.flatMap((symbol) => {
    const stock = instruments.find((item) => item.symbol === symbol); return stock ? [stock] : [];
  }) : instruments;
  return (
    <section className="panel home-table">
      <div className="panel-heading">
        <h2>{watchOnly ? legacy ? "URL의 선택 종목" : "관심종목" : "지원 종목"}</h2>
        <span className="subtle">{stocks.length}종목 · 합성 시세</span>
      </div>
      <nav className="view-nav" aria-label="종목 목록 보기">
        <Link
          href={legacy ? watchHref(selected, false) : "/?view=all"}
          aria-current={!watchOnly ? "page" : undefined}
        >
          전체 종목
        </Link>
        <Link
          href={legacy ? watchHref(selected, true) : "/?view=watchlist"}
          aria-current={watchOnly ? "page" : undefined}
        >
          {legacy ? "URL 선택 종목" : "관심종목"} ({selected.length})
        </Link>
      </nav>
      <StorageStatus />
      {legacy ? <div className="legacy-watch"><p>이 URL의 임시 목록입니다. 저장된 관심종목은 바뀌지 않습니다.</p>
        <button type="button" disabled={snapshot.status !== "ready" || snapshot.busy} onClick={async () => {
          if (await store.setWatchlist([...new Set([...(snapshot.data?.watchlist ?? []), ...selected])])) router.replace(`/?view=${watchOnly ? "watchlist" : "all"}`, { scroll: false });
        }}>이 목록을 관심종목에 추가</button><Link href="/?view=watchlist">저장된 관심종목 보기</Link></div> : null}
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
                <span className="sr-only">관심종목</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((stock) => (
              <QuoteRow
                key={stock.symbol}
                stock={stock}
              />
            ))}
          </tbody>
        </table>
      ) : snapshot.status === "ready" || legacy ? (
        <div className="empty-watch" role="status">
          <h3>{legacy ? "선택한 종목이 없습니다" : "관심종목이 없습니다"}</h3>
          <p>전체 종목에서 별표를 눌러 시세 목록을 구성하세요.</p>
          <Link href={legacy ? watchHref(selected, false) : "/?view=all"}>전체 종목 보기 →</Link>
        </div>
      ) : null}
      <div className="panel-foot">
        SIM 시장 · 별표는 이 브라우저의 관심종목에 저장됩니다. 시세는 직접 생성합니다.
      </div>
    </section>
  );
}
