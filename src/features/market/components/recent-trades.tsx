import type { Trade } from "@/domain/market";
import { number, time } from "@/lib/formatting/market";
export function RecentTrades({ trades }: { trades: readonly Trade[] }) {
  return (
    <section className="panel trades-panel">
      <div className="panel-heading">
        <h2>최근 체결</h2>
        <span className="subtle">최근 {Math.min(200, trades.length)}건</span>
      </div>
      <div
        className="trades-scroll"
        tabIndex={0}
        role="region"
        aria-label="최근 체결 목록 스크롤"
      >
        <table data-testid="trades">
          <caption className="sr-only">
            합성 최근 체결. 매수·매도 공격 주체는 알 수 없습니다.
          </caption>
          <thead>
            <tr>
              <th scope="col">
                가상 시각 <small>KST</small>
              </th>
              <th scope="col">
                체결가 <small>원</small>
              </th>
              <th scope="col">
                체결량 <small>주</small>
              </th>
            </tr>
          </thead>
          <tbody>
            {trades.slice(0, 200).map((trade) => (
              <tr key={`${trade.sessionId}:${trade.sequence}`}>
                <td>{time(trade.eventTimeMs)}</td>
                <td className="numeric">{number(trade.price)}</td>
                <td className="numeric">{number(trade.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel-foot">
        체결 방향 미제공 · 가격 등락으로 매수/매도를 판단하지 않습니다.
      </div>
    </section>
  );
}
