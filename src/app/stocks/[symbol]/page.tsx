import { notFound, redirect } from "next/navigation";
import { getInstrument } from "@/domain/instruments";
import { parseDetailView, detailHref } from "@/domain/market-view";
import { StockDetail } from "@/features/market/components/stock-detail";
type Props = {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
export async function generateMetadata({ params }: Props) {
  const { symbol } = await params;
  return {
    title: `${getInstrument(symbol)?.name ?? "미지원 종목"} · 합성 시세`,
  };
}
export default async function StockPage({ params, searchParams }: Props) {
  const [{ symbol }, query] = await Promise.all([params, searchParams]);
  const stock = getInstrument(symbol);
  if (!stock) notFound();
  const view = parseDetailView(query);
  if (
    (query.period !== undefined && query.period !== view.period) ||
    (query.tab !== undefined && query.tab !== view.tab)
  )
    redirect(detailHref(symbol, view));
  return <StockDetail stock={stock} view={view} />;
}
