"use client";
import { useMarket } from "../market-context";
import { time } from "@/lib/formatting/market";
const labels = {
  idle: "준비 중",
  connecting: "연결 중",
  live: "합성 재생 중",
  paused: "일시정지",
  stale: "오래된 데이터",
  error: "갱신 오류",
  reconnecting: "재연결 중",
  "market-closed": "장 마감",
};
export function MarketControls() {
  const { snapshot, pause, resume, reset } = useMarket();
  const paused = snapshot.status === "paused";
  return (
    <div className="control-bar">
      <div className={`connection ${snapshot.status}`} role="status">
        <span className="status-dot" />
        {labels[snapshot.status]}
      </div>
      <span className="virtual-clock">
        가상 시각{" "}
        <time data-testid="virtual-time">
          {time(snapshot.quote.eventTimeMs)}
        </time>{" "}
        <small>KST</small>
      </span>
      <div className="control-buttons">
        <button
          type="button"
          onClick={paused ? resume : pause}
          disabled={snapshot.status === "error" || snapshot.status === "idle"}
          aria-label={paused ? "합성 시세 재생" : "합성 시세 일시정지"}
        >
          <span aria-hidden="true">{paused ? "▶" : "Ⅱ"}</span>{" "}
          {paused ? "재생" : "일시정지"}
        </button>
        <button type="button" className="quiet-button" onClick={reset}>
          <span aria-hidden="true">↺</span> 초기화
        </button>
      </div>
      {snapshot.message ? (
        <p className="stream-message" role="status">
          {snapshot.message}
        </p>
      ) : null}
    </div>
  );
}
