"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { parsePublicConfig, type PublicConfig } from "@/lib/config";
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
    store.start();
    return store.stop;
  }, [store]);
  return <MarketContext value={store}>{children}</MarketContext>;
}
export function useMarket() {
  const store = useContext(MarketContext);
  if (!store) throw new Error("MarketSession이 필요합니다.");
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  return {
    snapshot,
    pause: store.pause,
    resume: store.resume,
    reset: store.reset,
  };
}
