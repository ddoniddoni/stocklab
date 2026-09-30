"use client";
import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle } from "@/domain/market";
import { time } from "@/lib/formatting/market";
const asData = (candle: Candle) => ({
  time: ((candle.time.kind === "instant"
    ? candle.time.epochMs
    : Date.parse(candle.time.date)) / 1000) as UTCTimestamp,
  open: candle.open,
  high: candle.high,
  low: candle.low,
  close: candle.close,
});
const asVolume = (candle: Candle) => ({
  time: asData(candle).time,
  value: Number(candle.volume),
  color: candle.close >= candle.open ? "#ff84956b" : "#78a9ff6b",
});
export default function PriceChart({
  candles,
  sessionId,
  local = false,
}: {
  candles: readonly Candle[];
  sessionId: string;
  local?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const api = useRef<{
    chart: IChartApi;
    price: ISeriesApi<"Candlestick">;
    volume: ISeriesApi<"Histogram">;
    session?: string;
    firstTime?: number;
    lastTime?: number;
  } | null>(null);
  useEffect(() => {
    if (!container.current) return;
    const chart = createChart(container.current, {
      autoSize: true,
      height: 360,
      layout: {
        background: { type: ColorType.Solid, color: "#121821" },
        textColor: "#A6B2C3",
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
        attributionLogo: true,
      },
      grid: {
        vertLines: { color: "#1c2532" },
        horzLines: { color: "#1c2532" },
      },
      rightPriceScale: { borderColor: "#2B3543" },
      timeScale: {
        borderColor: "#2B3543",
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (value: import("lightweight-charts").Time) =>
          typeof value === "number"
            ? time(value * 1000).slice(0, 5)
            : String(value),
      },
      localization: {
        locale: "ko-KR",
        timeFormatter: (value: number) => time(value * 1000),
      },
    });
    const price = chart.addSeries(CandlestickSeries, {
      upColor: "#ff8495",
      downColor: "#78a9ff",
      borderVisible: false,
      wickUpColor: "#ff8495",
      wickDownColor: "#78a9ff",
      priceFormat: { type: "price", precision: 0, minMove: local ? 1 : 100 },
    });
    price
      .priceScale()
      .applyOptions({ scaleMargins: { top: 0.08, bottom: 0.25 } });
    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    volume
      .priceScale()
      .applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    api.current = { chart, price, volume };
    return () => {
      api.current = null;
      chart.remove();
    };
  }, [local]);
  useEffect(() => {
    const current = api.current;
    if (!current || !candles.length) return;
    const firstTime = asData(candles[0]!).time;
    if (current.session !== sessionId || current.firstTime !== firstTime) {
      current.price.setData(candles.map(asData));
      current.volume.setData(candles.map(asVolume));
      current.chart.timeScale().fitContent();
      current.session = sessionId;
      current.firstTime = firstTime;
    } else {
      // A batched 4x tick may finish the previous minute and open another.
      // Update the former last candle before appending newer candles.
      for (const candle of candles) {
        if (asData(candle).time >= (current.lastTime ?? 0)) {
          current.price.update(asData(candle));
          current.volume.update(asVolume(candle));
        }
      }
    }
    current.lastTime = asData(candles.at(-1)!).time;
  }, [candles, sessionId]);
  return (
    <div
      ref={container}
      className="price-chart"
      role="img"
      aria-label={`${local ? "KRX 수신 구간의" : "합성"} 1분 캔들 및 거래량 차트. 현재 캔들 수치는 아래 표에 제공됩니다.`}
    />
  );
}
