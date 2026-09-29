import Link from "next/link";
import { getPublicConfig } from "@/server/config";
export const metadata = { title: "데이터 설명" };
export default function DataPage() {
  const { seed } = getPublicConfig();
  return (
    <article className="data-page">
      <Link href="/" className="back-link">
        ← 종목 탐색
      </Link>
      <p className="eyebrow">DATA & SOURCES</p>
      <h1>숫자의 출처를 확인하세요</h1>
      <p className="intro">시세 시뮬레이션 — 현재 주가가 아닙니다</p>
      <section>
        <h2>직접 생성한 합성 시세</h2>
        <p>
          현재가, 캔들, 호가, 체결, 거래량은 하나의 seed와 가상 시계로
          생성합니다. 실제 시세를 녹화하거나 복사한 데이터가 아닙니다. 지원하는
          다섯 회사의 이름과 종목코드는 탐색을 위한 식별자로만 사용합니다.
        </p>
        <dl className="manifest">
          <div>
            <dt>출처 / 시장</dt>
            <dd>synthetic / SIM</dd>
          </div>
          <div>
            <dt>생성기 / 시나리오</dt>
            <dd>1.1.0 / balanced-session</dd>
          </div>
          <div>
            <dt>Seed</dt>
            <dd>{seed}</dd>
          </div>
          <div>
            <dt>가상 생성 기준일</dt>
            <dd>2026-01-05 09:00 KST</dd>
          </div>
        </dl>
        <p>
          가격은 종목별 70,000 / 110,000 / 160,000 / 190,000 / 90,000원이라는
          임의 기준값에서 시작합니다. 100원 단위와 10단계 호가는 데모의 생성
          규칙이며 실제 거래소의 모든 규정을 재현하지 않습니다. 1분 캔들은 모든
          합성 체결을 집계합니다. 이력은 최근 240개 캔들, 내부 체결 버퍼는
          500개, 화면 체결 목록은 200개로 제한합니다.
        </p>
        <p>
          일시정지하면 가상 시간과 모든 수치가 멈춥니다. 초기화하면 같은 seed로
          모든 종목을 처음부터 생성하고 일시정지 여부와 배속은 유지합니다.
          1·2·4배속에서도 동일한 체결 순서를 유지합니다. 숨긴 탭에서는 가상
          시계가 멈추고, 복귀해도 사용자의 일시정지는 유지됩니다. 브라우저
          스케줄링이 지연돼도 누적 이벤트를 몰아서 재생하지 않습니다.
        </p>
      </section>
      <section>
        <h2>재무정보와 실제 연동</h2>
        <p>
          현재 단계에는 재무 수치와 공시를 제공하지 않습니다. OpenDART 수집,
          한국투자증권 연결, 계좌 조회, 매매 기능과 클라우드 저장은 구현하지
          않았습니다. 외부 API 키나 계정이 필요하지 않습니다.
        </p>
      </section>
      <section>
        <h2>차트 라이브러리</h2>
        <p>
          TradingView Lightweight Charts™를 사용합니다. 라이브러리는 차트를
          그리며 시세를 공급하지 않습니다.
        </p>
        <p>
          <a
            href="https://www.tradingview.com/"
            target="_blank"
            rel="noreferrer"
          >
            TradingView (새 창) ↗
          </a>{" "}
          ·{" "}
          <a
            href="https://github.com/tradingview/lightweight-charts/blob/master/LICENSE"
            target="_blank"
            rel="noreferrer"
          >
            Apache 2.0 라이선스 (새 창) ↗
          </a>
        </p>
        <p className="license-notice">
          TradingView Lightweight Charts™
          <br />
          Copyright (c) 2025 TradingView, Inc. https://www.tradingview.com/
        </p>
      </section>
    </article>
  );
}
