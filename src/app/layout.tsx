import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { MarketSession } from "@/features/market/market-context";
import { getPublicConfig } from "@/server/config";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "StockLab · 합성 시세 리서치", template: "%s | StockLab" },
  description:
    "합성 시세와 직접 작성한 예시 재무정보를 탐색하는 리서치 데모. 실제 주가와 기업 실적이 아닙니다.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <MarketSession config={getPublicConfig()}>
          <SiteHeader />
          <main id="main" className="main-shell" tabIndex={-1}>
            {children}
          </main>
          <footer className="site-footer">
            <span>
              StockLab <span className="subtle">/</span> Research playground
            </span>
            <span>시뮬레이션 전용 · 투자 판단용 데이터가 아닙니다</span>
          </footer>
        </MarketSession>
      </body>
    </html>
  );
}
