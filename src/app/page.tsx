import { Suspense } from "react";
import { StockSearch } from "@/features/search/stock-search";
import { HomeMarket } from "@/features/market/components/home-market";
import { MarketControls } from "@/features/market/components/market-controls";
import { SourceNotice } from "@/features/market/components/source-notice";
import { RecentNotes } from "@/features/personal/personal-controls";
import { getPublicConfig } from "@/server/config";
export default function Home() {
  const local = getPublicConfig().marketMode === "kis-private";
  return (
    <>
      <SourceNotice />
      <div className="home-heading">
        <div>
          <p className="eyebrow">RESEARCH WORKSPACE</p>
          <h1>종목 탐색</h1>
          <p className="intro">종목을 찾아, 가격의 흐름을 살펴보세요.</p>
        </div>
        <span className="scope-label">
          {local ? "개인 로컬 시세" : "공유 시세 실험"}<span>{local ? "다섯 종목, KRX 수신" : "다섯 종목, 하나의 시계"}</span>
        </span>
      </div>
      <StockSearch />
      <div className="home-market-area">
        <MarketControls />
        <Suspense
          fallback={
            <section className="panel chart-loading" role="status">
              종목 목록을 준비하고 있습니다…
            </section>
          }
        >
          <HomeMarket />
        </Suspense>
      </div>
      <RecentNotes />
      <section className="session-guide">
        <div>
          <span className="guide-line" />
          <h2>같은 흐름을 네 가지 시선으로</h2>
          <p>
            현재가에서 캔들, 호가, 체결까지.
            <br />
            {local ? "실제 수신한 구간을 상세 화면에서 함께 확인하세요." : "하나의 합성 세션을 상세 화면에서 함께 확인하세요."}
          </p>
        </div>
        <ol>
          <li>
            <span>찾기</span>회사명 또는 종목코드로 검색
          </li>
          <li>
            <span>살펴보기</span>가격과 거래량의 변화 확인
          </li>
          <li>
            <span>{local ? "기록하기" : "멈춰보기"}</span>{local ? "출처를 확인하고 리서치 노트 작성" : "일시정지로 같은 순간 비교"}
          </li>
        </ol>
      </section>
    </>
  );
}
