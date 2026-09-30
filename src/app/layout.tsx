import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { MarketSession } from "@/features/market/market-context";
import { getPublicConfig } from "@/server/config";
import { PersonalSession } from "@/features/personal/personal-context";
import { PendingDraftNotice } from "@/features/personal/personal-controls";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "StockLab · 합성 시세 리서치", template: "%s | StockLab" },
  description:
    "합성 시세와 출처를 구분한 재무정보를 탐색하는 리서치 데모. 시세는 실제 주가가 아닙니다.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <PersonalSession><MarketSession config={getPublicConfig()}>
          <SiteHeader />
          <main id="main" className="main-shell" tabIndex={-1}>
            <PendingDraftNotice />
            {children}
          </main>
          <footer className="site-footer">
            <span>
              StockLab <span className="subtle">/</span> Research playground
            </span>
            <span>시뮬레이션 전용 · 투자 판단용 데이터가 아닙니다</span>
          </footer>
        </MarketSession></PersonalSession>
      </body>
    </html>
  );
}
