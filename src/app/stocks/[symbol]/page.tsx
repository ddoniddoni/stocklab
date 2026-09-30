import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getInstrument } from "@/domain/instruments";
import { parseDetailView, detailHref } from "@/domain/market-view";
import { StockDetail } from "@/features/market/components/stock-detail";
import { parseFinancialView, hasInvalidFinancialQuery } from "@/domain/financials/view";
import { financialYears } from "@/server/repositories/fixture-financial-repository";
import { ResearchLoading, ResearchPanel } from "@/features/financials/research-panel";
type Props = {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
export async function generateMetadata({ params }: Props) {
  const { symbol } = await params;
  return {
    title: `${getInstrument(symbol)?.name ?? "미지원 종목"} · 합성 시세와 예시 재무`,
  };
}
export default async function StockPage({ params, searchParams }: Props) {
  const [{ symbol }, query] = await Promise.all([params, searchParams]);
  const stock = getInstrument(symbol);
  if (!stock) notFound();
  const view = parseDetailView(query);
  const research = view.tab === "financials" || view.tab === "filings";
  const financial = research || query.basis !== undefined || query.view !== undefined || query.year !== undefined
    ? parseFinancialView(query, financialYears) : undefined;
  if (
    (query.period !== undefined && query.period !== view.period) ||
    (query.tab !== undefined && query.tab !== view.tab) ||
    (financial && hasInvalidFinancialQuery(query, financial))
  )
    redirect(detailHref(symbol, view, financial));
  return <StockDetail stock={stock} view={view} financialView={financial}
    research={research && financial ? (
      <Suspense key={`${symbol}:${view.tab}:${financial.basis}:${financial.view}:${financial.year}`} fallback={<ResearchLoading />}>
        <ResearchPanel symbol={symbol} detail={view} selected={financial} />
      </Suspense>
    ) : undefined} />;
}
