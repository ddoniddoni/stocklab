import { instrument, instruments } from "@/domain/instruments";
import type { MarketSnapshot } from "@/domain/market";
import {
  SyntheticMarketProvider,
  type PlaybackSpeed,
} from "../providers/synthetic-market-provider";
export class MarketStore {
  readonly mode = "synthetic" as const;
  private provider: SyntheticMarketProvider | undefined;
  private readonly initial: SyntheticMarketProvider;
  private readonly snapshots = new Map<string, MarketSnapshot>();
  private readonly listeners = new Map<string, Set<() => void>>();
  private readonly detailSubscriptions = new Map<string, () => void>();
  private readonly sessionListeners = new Set<() => void>();
  private session;
  constructor(private readonly seed: string) {
    this.initial = new SyntheticMarketProvider(seed);
    this.session = this.initial.getSessionSnapshot();
    for (const stock of instruments)
      this.snapshots.set(stock.symbol, this.initial.getSnapshot(stock.symbol));
  }
  // Stable per-symbol bindings prevent an unrelated quote from invalidating a row.
  readonly views = new Map(
    instruments.map(({ symbol }) => [
      symbol,
      {
        getSnapshot: () => this.snapshots.get(symbol)!,
        getServerSnapshot: () => this.initial.getSnapshot(symbol),
        getQuote: () => this.snapshots.get(symbol)!.quote,
        getServerQuote: () => this.initial.getSnapshot(symbol).quote,
        subscribe: (listener: () => void) =>
          this.listen(symbol, listener, false),
        subscribeDetail: (listener: () => void) =>
          this.listen(symbol, listener, true),
      },
    ]),
  );
  private detailCounts = new Map<string, number>();
  private listen(symbol: string, listener: () => void, detail: boolean) {
    const listeners = this.listeners.get(symbol) ?? new Set<() => void>();
    this.listeners.set(symbol, listeners);
    listeners.add(listener);
    if (detail) {
      this.detailCounts.set(symbol, (this.detailCounts.get(symbol) ?? 0) + 1);
      this.attachDetail(symbol);
    }
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      listeners.delete(listener);
      if (detail) {
        const count = (this.detailCounts.get(symbol) ?? 1) - 1;
        this.detailCounts.set(symbol, count);
        if (!count) {
          this.detailSubscriptions.get(symbol)?.();
          this.detailSubscriptions.delete(symbol);
        }
      }
    };
  }
  private attachDetail(symbol: string) {
    if (
      !this.provider ||
      this.detailSubscriptions.has(symbol) ||
      !this.detailCounts.get(symbol)
    )
      return;
    this.detailSubscriptions.set(
      symbol,
      this.provider.subscribe(
        { symbol, channels: ["trade", "orderbook"] },
        () => {},
      ),
    );
  }
  getSnapshot = () => this.snapshots.get(instrument.symbol)!;
  getServerSnapshot = () => this.initial.getSnapshot();
  subscribe = (listener: () => void) =>
    this.listen(instrument.symbol, listener, true);
  getSessionSnapshot = () => this.session;
  getServerSessionSnapshot = () => this.initial.getSessionSnapshot();
  subscribeSession = (listener: () => void) => {
    this.sessionListeners.add(listener);
    return () => {
      this.sessionListeners.delete(listener);
    };
  };
  start = (hidden = false) => {
    if (this.provider) return;
    const provider = new SyntheticMarketProvider(this.seed);
    this.provider = provider;
    provider.subscribeSession(() => {
      this.session = provider.getSessionSnapshot();
      this.sessionListeners.forEach((listener) => listener());
    });
    for (const { symbol } of instruments) {
      provider.subscribe({ symbol, channels: ["quote"] }, () => {
        for (const stock of instruments)
          this.snapshots.set(stock.symbol, provider.getSnapshot(stock.symbol));
        this.listeners.get(symbol)?.forEach((listener) => listener());
      });
      this.attachDetail(symbol);
    }
    provider.setHidden(hidden);
    void provider.connect();
  };
  stop = () => {
    this.provider?.dispose();
    this.provider = undefined;
    this.detailSubscriptions.clear();
  };
  pause = () => this.provider?.pause();
  resume = () => this.provider?.resume();
  reset = () => this.provider?.reset();
  setSpeed = (speed: PlaybackSpeed) => this.provider?.setSpeed(speed);
  setHidden = (hidden: boolean) => this.provider?.setHidden(hidden);
}
