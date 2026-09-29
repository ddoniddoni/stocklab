import type { OrderBook } from "@/domain/market";
import { number } from "@/lib/formatting/market";
export function OrderBookView({
  book,
  lastPrice,
}: {
  book: OrderBook;
  lastPrice: number;
}) {
  const max = Math.max(
    1,
    ...book.asks.map((level) => level.quantity),
    ...book.bids.map((level) => level.quantity),
  );
  return (
    <section className="panel book-panel">
      <div className="panel-heading">
        <h2>호가</h2>
        <span className="subtle">매도·매수 각 10단계</span>
      </div>
      <table data-testid="orderbook">
        <caption className="sr-only">
          합성 호가. 수량 막대는 최대 잔량에 대한 비율입니다.
        </caption>
        <thead>
          <tr>
            <th scope="col">매도 잔량</th>
            <th scope="col">
              가격 <small>원</small>
            </th>
            <th scope="col">매수 잔량</th>
          </tr>
        </thead>
        <tbody>
          {[...book.asks].reverse().map((level) => (
            <tr key={`ask-${level.price}`}>
              <td className="depth-cell">
                <span
                  className="depth ask"
                  style={{ width: `${(level.quantity / max) * 100}%` }}
                />
                <span>{number(level.quantity)}</span>
              </td>
              <th scope="row" className="down">
                {number(level.price)}
              </th>
              <td>
                <span className="sr-only">매도 호가</span>
              </td>
            </tr>
          ))}
          <tr className="spread-row">
            <td colSpan={3}>
              현재가 <strong>{number(lastPrice)}</strong>
              <span>
                스프레드 {number(book.asks[0]!.price - book.bids[0]!.price)}원
              </span>
            </td>
          </tr>
          {book.bids.map((level) => (
            <tr key={`bid-${level.price}`}>
              <td>
                <span className="sr-only">매수 호가</span>
              </td>
              <th scope="row" className="up">
                {number(level.price)}
              </th>
              <td className="depth-cell">
                <span
                  className="depth bid"
                  style={{ width: `${(level.quantity / max) * 100}%` }}
                />
                <span>{number(level.quantity)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="panel-foot">
        잔량 단위: 주 · 막대: 상대 잔량 · 0은 실제 생성값
      </div>
    </section>
  );
}
