import Link from "next/link";
export function SiteHeader() {
  return (
    <>
      <a className="skip-link" href="#main">
        본문으로 이동
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link href="/" className="brand" aria-label="StockLab 홈">
            <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
              <path
                d="M4 5h5v18H4zM12 10h5v13h-5zM20 3h4v20h-4z"
                fill="currentColor"
              />
            </svg>
            StockLab<span className="brand-tag">LAB</span>
          </Link>
          <nav aria-label="주요 메뉴">
            <Link href="/">종목 탐색</Link>
            <Link href="/watchlist">관심종목</Link>
            <Link href="/compare">기업 비교</Link>
            <Link href="/notes">리서치 노트</Link>
            <Link href="/about/data">
              데이터 설명 <span aria-hidden="true">↗</span>
            </Link>
          </nav>
          <span className="header-mode">
            <span className="status-dot" />
            합성 데이터
          </span>
        </div>
      </header>
    </>
  );
}
