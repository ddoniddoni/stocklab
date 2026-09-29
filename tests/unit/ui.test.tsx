import { StrictMode, type ComponentProps } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StockSearch } from "@/features/search/stock-search";
import { MarketSession } from "@/features/market/market-context";
import { MarketControls } from "@/features/market/components/market-controls";
import { HomeMarket } from "@/features/market/components/home-market";
import { SourceNotice } from "@/features/market/components/source-notice";
import { parsePublicConfig } from "@/lib/config";
import Loading from "@/app/loading";
import NotFound from "@/app/not-found";
import ErrorPage from "@/app/error";
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/link", () => ({
  default: (props: ComponentProps<"a">) => <a {...props} />,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}));
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});
describe("accessible search", () => {
  it("finds names and leading-zero codes, supports arrows, Enter and Escape", () => {
    render(<StockSearch />);
    const input = screen.getByRole("combobox", { name: "종목 검색" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "삼성" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getByRole("option")).toHaveAttribute("aria-selected", "true");
    expect(fireEvent.keyDown(input, { key: "Escape" })).toBe(false);
    expect(input).toHaveAttribute("aria-expanded", "false");
    fireEvent.change(input, { target: { value: "005930" } });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(push).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/stocks/005930");
  });
  it("wraps across five search options and matches Latin names without case sensitivity", () => {
    render(<StockSearch />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    expect(screen.getAllByRole("option")).toHaveLength(5);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(screen.getAllByRole("option").at(-1)).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getAllByRole("option")[0]).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.change(input, { target: { value: "naver" } });
    expect(screen.getByRole("option")).toHaveTextContent("NAVER");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/stocks/035420");
  });
  it("shows an empty result and never navigates on unmatched Enter", () => {
    render(<StockSearch />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "지원안됨" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByRole("status")).toHaveTextContent("지원하지 않는 종목");
    expect(push).not.toHaveBeenCalled();
  });
});
describe("app shell and cleanup", () => {
  it("pauses/resumes/reset and cleans up under real React Strict Mode", () => {
    vi.useFakeTimers();
    const view = render(
      <StrictMode>
        <MarketSession config={parsePublicConfig({})}>
          <SourceNotice />
          <MarketControls />
          <HomeMarket />
        </MarketSession>
      </StrictMode>,
    );
    expect(
      screen.getByText("시세 시뮬레이션 — 현재 주가가 아닙니다"),
    ).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "합성 시세 일시정지" }));
    const before = screen.getByTestId("virtual-time").textContent;
    act(() => vi.advanceTimersByTime(10000));
    expect(screen.getByTestId("virtual-time")).toHaveTextContent(before!);
    fireEvent.click(screen.getByRole("button", { name: "합성 시세 재생" }));
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByTestId("virtual-time").textContent).not.toBe(before);
    fireEvent.click(screen.getByRole("button", { name: /초기화/ }));
    expect(screen.getByTestId("virtual-time")).toHaveTextContent(before!);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("handles visibility events, preserves manual pause, and removes the listener on unmount", () => {
    vi.useFakeTimers();
    const visibility = vi.spyOn(document, "visibilityState", "get");
    visibility.mockReturnValue("visible");
    const remove = vi.spyOn(document, "removeEventListener");
    const view = render(
      <StrictMode>
        <MarketSession config={parsePublicConfig({})}>
          <MarketControls />
          <HomeMarket />
        </MarketSession>
      </StrictMode>,
    );
    fireEvent.change(screen.getByRole("combobox", { name: "합성 시세 배속" }), {
      target: { value: "4" },
    });
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByTestId("virtual-time")).toHaveTextContent("09:40:04");
    visibility.mockReturnValue("hidden");
    fireEvent(document, new Event("visibilitychange"));
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(60000));
    expect(screen.getByTestId("virtual-time")).toHaveTextContent("09:40:04");
    visibility.mockReturnValue("visible");
    fireEvent(document, new Event("visibilitychange"));
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByTestId("virtual-time")).toHaveTextContent("09:40:08");
    fireEvent.click(screen.getByRole("button", { name: "합성 시세 일시정지" }));
    visibility.mockReturnValue("hidden");
    fireEvent(document, new Event("visibilitychange"));
    visibility.mockReturnValue("visible");
    fireEvent(document, new Event("visibilitychange"));
    expect(vi.getTimerCount()).toBe(0);
    view.unmount();
    expect(remove).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function),
    );
    visibility.mockRestore();
    remove.mockRestore();
  });
  it("has actionable loading, unsupported and error states", () => {
    const loading = render(<Loading />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    loading.unmount();
    const missing = render(<NotFound />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/");
    missing.unmount();
    const reset = vi.fn();
    render(<ErrorPage error={new Error("private stack")} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(reset).toHaveBeenCalledOnce();
    expect(screen.queryByText("private stack")).not.toBeInTheDocument();
  });
});
