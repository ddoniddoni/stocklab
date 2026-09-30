import { basisLabels, reportLabels, type FixtureFiling } from "@/domain/financials/model";

export function FilingsList({ filings, source = "fixture" }: { filings: FixtureFiling[]; source?: "fixture" | "opendart" }) {
  const fixture = source === "fixture";
  return (
    <section className="panel filings-panel">
      <div className="panel-heading"><h2>{fixture ? "예시 공시 목록" : "검토된 캐시의 공시"}</h2><span className="subtle">{filings.length}건 · {fixture ? "정정 이력 포함" : "최근 5개 데이터셋 버전"}</span></div>
      {!fixture && filings.some((filing) => filing.fetchedAt && Date.now() - Date.parse(filing.fetchedAt) > 30 * 86400000)
        ? <p className="financial-state" role="status">수집 후 30일이 지난 자료가 포함돼 있습니다. 전체 공시와 최신 정정은 DART에서 확인하세요.</p> : null}
      {filings.length ? <ol className="filings-list">
        {filings.map((filing) => (
          <li key={filing.id}>
            <div className="filing-date"><span>{fixture ? "예시 제출일" : "공시 제출일"}</span><time dateTime={filing.publishedAt}>{filing.publishedAt}</time></div>
            <div className="filing-content">
              <div className="filing-labels"><span>{reportLabels[filing.reportCode]}</span><span>{basisLabels[filing.basis]}</span>
                {filing.correction ? <span className="filing-correction">{fixture ? "정정 예시" : "정정"}</span> : null}
                <span>{filing.selected ? "재무 표에 반영" : "이전 버전 보존"}</span>
              </div>
              <h3>{filing.title}</h3>
              <p>{filing.fiscalYear} 사업연도 · {fixture ? "예시 버전" : "캐시 버전"} {filing.revision}</p>
            </div>
            <p className="filing-source">{filing.originalUrl ? <><a href={filing.originalUrl} target="_blank" rel="noreferrer">DART 원문 (새 창) ↗</a><span>수집 {filing.fetchedAt?.slice(0, 10)} · {filing.receiptNumber}</span></>
              : <>실제 공시 원문 없음<span>예시에는 접수번호를 부여하지 않습니다</span></>}</p>
          </li>
        ))}
      </ol> : <div className="financial-state" role="status"><h3>선택한 조건의 {fixture ? "예시" : "검토된"} 공시가 없습니다</h3><p>회계 기준이나 사업연도를 바꾸어 확인하세요.</p></div>}
      <div className="panel-foot">{fixture ? "이 목록은 화면과 정정 이력을 설명하기 위한 예시입니다. 실제 기업의 제출 내역이 아닙니다."
        : "이 목록은 검토된 캐시의 보고서만 포함합니다. 미표시는 공시 미제출을 뜻하지 않으며 최신 제출·철회 내역을 보증하지 않습니다."}</div>
      <p className="filings-official-link"><a href="https://dart.fss.or.kr/" target="_blank" rel="noreferrer">DART 공식 사이트에서 실제 공시 검색 (새 창) ↗</a></p>
    </section>
  );
}
