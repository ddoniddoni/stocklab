"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { parsePublicConfig, type PublicConfig } from "@/lib/config";
import { instrument } from "@/domain/instruments";
import { MarketStore } from "./stores/market-store";
import { LocalMarketStore } from "./stores/local-market-store";
import type { MarketViewSnapshot } from "@/domain/local-market";
import type { Quote, HistoryQuery } from "@/domain/market";
const MarketContext = createContext<MarketStore | LocalMarketStore | null>(null);
export function MarketSession({
  config,
  children,
}: {
  config: PublicConfig;
  children: React.ReactNode;
}) {
  const [store] = useState(
    () => {
      const parsed = parsePublicConfig(config, process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_MARKET_MODE === "kis-private");
      return parsed.marketMode === "kis-private" ? new LocalMarketStore() : new MarketStore(parsed.seed);
    },
  );
  useEffect(() => {
    store.start(document.visibilityState === "hidden");
    const visibility = () =>
      store.setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", visibility);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      store.stop();
    };
  }, [store]);
  return <MarketContext value={store}>{children}</MarketContext>;
}
function useStore() {
  const store = useContext(MarketContext);
  if (!store) throw new Error("MarketSession이 필요합니다.");
  return store;
}
export function useMarket(symbol = instrument.symbol) {
  const store = useStore();
  const view = store.views.get(symbol);
  if (!view) throw new Error("지원하지 않는 종목입니다.");
  const snapshot = useSyncExternalStore<MarketViewSnapshot>(
    view.subscribeDetail,
    view.getSnapshot,
    view.getServerSnapshot,
  );
  return {
    snapshot,
    pause: store.pause,
    resume: store.resume,
    reset: store.reset,
  };
}
export function useQuote(symbol: string) {
  const store = useStore();
  const view = store.views.get(symbol);
  if (!view) throw new Error("지원하지 않는 종목입니다.");
  return useSyncExternalStore<Quote | null>(
    view.subscribe,
    view.getQuote,
    view.getServerQuote,
  );
}
export function useSession() {
  const store = useStore();
  const snapshot = useSyncExternalStore(
    store.subscribeSession,
    store.getSessionSnapshot,
    store.getServerSessionSnapshot,
  );
  return {
    snapshot,
    mode: store.mode,
    pause: store.pause,
    resume: store.resume,
    reset: store.reset,
    setSpeed: store.setSpeed,
  };
}
export function useMarketMode() { return useStore().mode; }
export function useQuoteStatus(symbol: string) {
  const view = useStore().views.get(symbol);
  if (!view) throw new Error("지원하지 않는 종목입니다.");
  return useSyncExternalStore(view.subscribe, () => view.getSnapshot().status, () => view.getServerSnapshot().status);
}
export function useLocalHistory() {
  const store = useStore();
  return (query: HistoryQuery, signal?: AbortSignal) => {
    if (store.mode !== "kis-private") throw new Error("개인 시세 모드에서만 일봉을 조회합니다.");
    return store.getHistory(query, signal);
  };
}
