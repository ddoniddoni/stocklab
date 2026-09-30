import { basisLabels, reportLabels, type FixtureFiling } from "@/domain/financials/model";

export function FilingsList({ filings }: { filings: FixtureFiling[] }) {
  return (
    <section className="panel filings-panel">
      <div className="panel-heading"><h2>예시 공시 목록</h2><span className="subtle">{filings.length}건 · 정정 이력 포함</span></div>
      {filings.length ? <ol className="filings-list">
        {filings.map((filing) => (
          <li key={filing.id}>
            <div className="filing-date"><span>예시 제출일</span><time dateTime={filing.publishedAt}>{filing.publishedAt}</time></div>
            <div className="filing-content">
              <div className="filing-labels"><span>{reportLabels[filing.reportCode]}</span><span>{basisLabels[filing.basis]}</span>
                {filing.correction ? <span className="filing-correction">정정 예시</span> : null}
                <span>{filing.selected ? "재무 표에 반영" : "이전 버전 보존"}</span>
              </div>
              <h3>{filing.title}</h3>
              <p>{filing.fiscalYear} 사업연도 · 예시 버전 {filing.revision}</p>
            </div>
            <p className="filing-source">실제 공시 원문 없음<span>예시에는 접수번호를 부여하지 않습니다</span></p>
          </li>
        ))}
      </ol> : <div className="financial-state" role="status"><h3>선택한 조건의 예시 공시가 없습니다</h3><p>회계 기준이나 사업연도를 바꾸어 확인하세요.</p></div>}
      <div className="panel-foot">이 목록은 화면과 정정 이력을 설명하기 위한 예시입니다. 실제 기업의 제출 내역이 아닙니다.</div>
      <p className="filings-official-link"><a href="https://dart.fss.or.kr/" target="_blank" rel="noreferrer">DART 공식 사이트에서 실제 공시 검색 (새 창) ↗</a></p>
    </section>
  );
}
