"use client";
import { useMarketReading, useSession } from "../market-context";
import { time } from "@/lib/formatting/market";
import { MarketReadingControls } from "./market-reading-controls";
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
  return <><MarketReadingControls /><PlaybackControls /></>;
}
function PlaybackControls() {
  const { snapshot, mode, pause, resume, reset, setSpeed } = useSession();
  const { snapshot: reading } = useMarketReading();
  if (mode === "kis-private") return <div className="control-bar">
    <div className={`connection ${reading.frozen ? "paused" : snapshot.status}`} role="status"><span className="status-dot" />{reading.frozen ? "고정 시점: " : ""}{snapshot.status === "live" ? "KRX 시세 수신 중" : labels[snapshot.status]}</div>
    <span className="virtual-clock">{reading.frozen ? "고정 당시 마지막 수신" : "마지막 수신"} {snapshot.eventTimeMs ? time(snapshot.eventTimeMs) : "—"} <small>KST</small></span>
    <div className="control-buttons">
      <button type="button" onClick={pause} disabled={snapshot.manualPaused}>수신 중단</button>
      <button type="button" onClick={resume}>재연결</button>
    </div>
    {snapshot.message ? <p className="stream-message" role="status">{reading.frozen ? "고정 당시 안내: " : ""}{snapshot.message}</p> : null}
  </div>;
  const paused = snapshot.manualPaused;
  return (
    <div className="control-bar">
      <div className={`connection ${reading.frozen ? "paused" : snapshot.status}`} role="status">
        <span className="status-dot" />
        {reading.frozen ? "고정 시점: " : ""}
        {labels[snapshot.status]}
      </div>
      <span className="virtual-clock">
        {reading.frozen ? "고정한 가상 시각" : "가상 시각"}{" "}
        <time data-testid="virtual-time">{time(snapshot.eventTimeMs)}</time>{" "}
        <small>KST</small>
      </span>
      <div className="control-buttons">
        <label className="speed-control">
          배속
          <select
            aria-label="합성 시세 배속"
            value={snapshot.speed}
            onChange={(event) =>
              setSpeed(Number(event.target.value) as 1 | 2 | 4)
            }
          >
            <option value="1">1배</option>
            <option value="2">2배</option>
            <option value="4">4배</option>
          </select>
        </label>
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
      {snapshot.hidden ? (
        <p className="stream-message" role="status">
          탭이 숨겨져 가상 시간이 멈췄습니다.
        </p>
      ) : null}
      {snapshot.message ? (
        <p className="stream-message" role="status">
          {reading.frozen ? "고정 당시 안내: " : ""}{snapshot.message}
        </p>
      ) : null}
    </div>
  );
}
