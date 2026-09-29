import { notFound } from "next/navigation";
import { instrument } from "@/domain/instruments";
import { StockDetail } from "@/features/market/components/stock-detail";
export const metadata = { title: "삼성전자 · 합성 시세" };
export default async function StockPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  if (symbol !== instrument.symbol) notFound();
  return <StockDetail />;
}
