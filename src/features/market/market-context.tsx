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
const MarketContext = createContext<MarketStore | null>(null);
export function MarketSession({
  config,
  children,
}: {
  config: PublicConfig;
  children: React.ReactNode;
}) {
  const [store] = useState(
    () => new MarketStore(parsePublicConfig(config).seed),
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
  const snapshot = useSyncExternalStore(
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
  return useSyncExternalStore(
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
    pause: store.pause,
    resume: store.resume,
    reset: store.reset,
    setSpeed: store.setSpeed,
  };
}
