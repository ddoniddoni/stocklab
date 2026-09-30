import type { Trade } from "@/domain/market";
import { number, time } from "@/lib/formatting/market";
export function RecentTrades({ trades, local = false, frozen = false }: { trades: readonly Trade[]; local?: boolean; frozen?: boolean }) {
  return (
    <section className="panel trades-panel">
      <div className="panel-heading">
        <h2>{frozen ? "고정한 최근 체결" : "최근 체결"}</h2>
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
            {local ? "KRX 수신 체결" : "합성 최근 체결"}. 매수·매도 공격 주체는 알 수 없습니다.
          </caption>
          <thead>
            <tr>
              <th scope="col">
                {local ? "체결 시각" : "가상 시각"} <small>KST</small>
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
            {!trades.length ? <tr><td colSpan={3}>{frozen ? "고정한 시점에 체결이 없었습니다. 최신 값을 반영해 주세요." : "수신한 체결이 없습니다."}</td></tr> : null}
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
