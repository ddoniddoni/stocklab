import Link from "next/link";
export function SourceNotice() {
  return (
    <aside className="source-notice">
      <span className="sim-badge">SIM</span>
      <p>시세 시뮬레이션 — 현재 주가가 아닙니다</p>
      <Link href="/about/data">
        출처와 생성 규칙 <span aria-hidden="true">↗</span>
      </Link>
    </aside>
  );
}
