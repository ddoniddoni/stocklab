"use client";
import { useId } from "react";
import { useMarketReading } from "../market-context";
import { dateTime } from "@/lib/formatting/market";

export function MarketReadingControls() {
  const { snapshot, freeze, refresh, release } = useMarketReading();
  const id = useId();
  return <section className="reading-controls" aria-labelledby={`${id}-title`}>
    <div className="reading-controls-heading">
      <h2 id={`${id}-title`}>시세 읽기</h2>
      <span className="reading-badge" data-frozen={snapshot.frozen}>{snapshot.frozen ? "화면 고정" : "자동 갱신"}</span>
    </div>
    <div className="reading-actions">
      <button type="button" data-frozen={snapshot.frozen} aria-describedby={`${id}-help`} onClick={snapshot.frozen ? release : freeze}>
        {snapshot.frozen ? "자동 갱신으로 돌아가기" : "화면 고정"}
      </button>
      <button type="button" disabled={!snapshot.frozen} onClick={refresh}>최신 값 한 번 반영</button>
    </div>
    <p id={`${id}-help`} className="reading-help">현재가·캔들·호가·체결의 표시를 함께 고정하며 재생·수신 상태는 그대로 유지합니다. 재생·연결 제어 시 고정이 해제됩니다.</p>
    <p className="reading-status" role="status" aria-atomic="true">
      {snapshot.frozen && snapshot.capturedAtMs !== null ? <>
        <strong>최신 시세가 아닌 고정 화면입니다.</strong>{" "}
        고정한 시각 <time dateTime={new Date(snapshot.capturedAtMs).toISOString()}>{dateTime(snapshot.capturedAtMs)} KST</time>.
        화면을 이동해도 유지하며, 페이지를 새로고침하면 해제됩니다.
      </> : "새 시세가 들어오면 표시값을 자동으로 갱신합니다. 화면을 고정하면 숫자와 표를 천천히 읽을 수 있습니다."}
    </p>
  </section>;
}
