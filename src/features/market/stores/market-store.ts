import { instrument } from "@/domain/instruments";
import type { MarketSnapshot } from "@/domain/market";
import { SyntheticMarketProvider } from "../providers/synthetic-market-provider";
export class MarketStore {
  private readonly listeners = new Set<() => void>();
  private provider: SyntheticMarketProvider | undefined;
  private snapshot: MarketSnapshot;
  private readonly initialSnapshot: MarketSnapshot;
  constructor(private readonly seed: string) {
    this.initialSnapshot = new SyntheticMarketProvider(seed).getSnapshot();
    this.snapshot = this.initialSnapshot;
  }
  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => this.initialSnapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  start = () => {
    if (this.provider) return;
    const provider = new SyntheticMarketProvider(this.seed);
    this.provider = provider;
    provider.subscribe(
      { symbol: instrument.symbol, channels: ["quote", "trade", "orderbook"] },
      (event) => {
        if (
          event.type === "orderbook" ||
          event.type === "status" ||
          event.type === "reset"
        ) {
          this.snapshot = provider.getSnapshot();
          this.listeners.forEach((listener) => listener());
        }
      },
    );
    void provider.connect();
  };
  stop = () => {
    this.provider?.dispose();
    this.provider = undefined;
  };
  pause = () => this.provider?.pause();
  resume = () => this.provider?.resume();
  reset = () => this.provider?.reset();
}
