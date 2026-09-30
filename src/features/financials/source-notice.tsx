import Link from "next/link";
export function FinancialSourceNotice({ source }: { source: "fixture" | "opendart" }) {
  return <aside className="financial-notice" aria-label="재무정보 출처">
    <span className="financial-notice-badge">{source === "fixture" ? "EXAMPLE" : "DART CACHE"}</span>
    <div><strong>{source === "fixture" ? "예시 재무정보 — 실제 기업 실적이 아닙니다" : "OpenDART · 검토된 공시 캐시"}</strong>
      <p>{source === "fixture" ? "금액·보고서·제출일은 직접 작성한 예시입니다." : "실시간 공시 조회가 아닙니다. 수집일과 원문을 확인하세요. 캐시에 없는 자료는 미제공으로 표시합니다."}
        {" "}합성 시세와 별개이며 가격과 결합한 PER·PBR·수익률을 제공하지 않습니다.</p></div>
    <Link href="/about/data">출처와 한계 ↗</Link>
  </aside>;
}
