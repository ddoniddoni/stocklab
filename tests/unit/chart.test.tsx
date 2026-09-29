import { render } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import PriceChart from "@/features/market/components/price-chart";
import {
  SyntheticEngine,
  START_MS,
} from "@/features/market/providers/synthetic-engine";
const { price, volume, remove } = vi.hoisted(() => {
  const series = () => ({
    setData: vi.fn(),
    update: vi.fn(),
    priceScale: () => ({ applyOptions: vi.fn() }),
  });
  return { price: series(), volume: series(), remove: vi.fn() };
});
vi.mock("lightweight-charts", () => ({
  CandlestickSeries: "price",
  HistogramSeries: "volume",
  ColorType: { Solid: "solid" },
  createChart: () => ({
    addSeries: (type: string) => (type === "price" ? price : volume),
    timeScale: () => ({ fitContent: vi.fn() }),
    remove,
  }),
}));
it("updates the closing minute before appending a new candle in a 4x batch, then clears on reset/unmount", () => {
  const engine = new SyntheticEngine("chart", "old");
  for (let i = 0; i < 56; i++) engine.advance(1000, START_MS);
  const before = engine.snapshot.candles.at(-1)!;
  const view = render(
    <PriceChart candles={engine.snapshot.candles} sessionId="old" />,
  );
  price.update.mockClear();
  volume.update.mockClear();
  for (let i = 0; i < 4; i++) engine.advance(1000, START_MS);
  const closed = engine.snapshot.candles.at(-2)!;
  const latest = engine.snapshot.candles.at(-1)!;
  expect(closed.volume).not.toBe(before.volume);
  view.rerender(
    <PriceChart candles={engine.snapshot.candles} sessionId="old" />,
  );
  expect(price.update).toHaveBeenCalledTimes(2);
  expect(price.update.mock.calls[0]![0]).toMatchObject({
    close: closed.close,
    high: closed.high,
    low: closed.low,
  });
  expect(price.update.mock.calls[1]![0]).toMatchObject({ close: latest.close });
  expect(volume.update.mock.calls[0]![0]).toMatchObject({
    value: Number(closed.volume),
  });
  expect(volume.update.mock.calls[1]![0]).toMatchObject({
    value: Number(latest.volume),
  });
  const reset = new SyntheticEngine("chart", "new");
  view.rerender(
    <PriceChart candles={reset.snapshot.candles} sessionId="new" />,
  );
  expect(price.setData).toHaveBeenCalledTimes(2);
  expect(volume.setData).toHaveBeenCalledTimes(2);
  view.unmount();
  expect(remove).toHaveBeenCalledOnce();
});
