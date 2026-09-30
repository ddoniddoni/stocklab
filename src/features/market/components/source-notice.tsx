"use client";
import Link from "next/link";
import { useMarketMode } from "../market-context";
export function SourceNotice() {
  const local = useMarketMode() === "kis-private";
  return (
    <aside className="source-notice">
      <span className="sim-badge">{local ? "KRX · LOCAL" : "SIM"}</span>
      <p>{local ? "한국투자증권 시세 · 개인 로컬 전용 · 수신 중단 구간은 복원하지 않습니다" : "시세 시뮬레이션 — 현재 주가가 아닙니다"}</p>
      <Link href="/about/data">
        출처와 생성 규칙 <span aria-hidden="true">↗</span>
      </Link>
    </aside>
  );
}
