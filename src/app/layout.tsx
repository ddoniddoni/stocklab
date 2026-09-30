import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { MarketSession } from "@/features/market/market-context";
import { getPublicConfig } from "@/server/config";
import { PersonalSession } from "@/features/personal/personal-context";
import { PendingDraftNotice } from "@/features/personal/personal-controls";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "StockLab · 주식 리서치", template: "%s | StockLab" },
  description:
    "시세와 재무정보의 출처를 구분하는 주식 리서치 공간. 공개 화면은 합성 시세를 사용합니다.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const config = getPublicConfig();
  const local = config.marketMode === "kis-private";
  return (
    <html lang="ko">
      <body>
        <PersonalSession><MarketSession config={config}>
          <SiteHeader local={local} />
          <main id="main" className="main-shell" tabIndex={-1}>
            <PendingDraftNotice />
            {children}
          </main>
          <footer className="site-footer">
            <span>
              StockLab <span className="subtle">/</span> Research playground
            </span>
            <span>{local ? "개인 로컬 수신 · 매매 기능을 제공하지 않습니다" : "시뮬레이션 전용 · 투자 판단용 데이터가 아닙니다"}</span>
          </footer>
        </MarketSession></PersonalSession>
      </body>
    </html>
  );
}
