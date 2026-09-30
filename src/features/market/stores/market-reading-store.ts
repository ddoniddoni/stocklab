import type { MarketSource, HistoryQuery, HistoryResult } from "@/domain/market";
import type { MarketViewSnapshot } from "@/domain/local-market";
import type { PlaybackSpeed, SessionSnapshot } from "../providers/synthetic-market-provider";
import type { MarketStore } from "./market-store";
import type { LocalMarketStore } from "./local-market-store";

type ReadingState = { frozen: boolean; capturedAtMs: number | null; revision: number };
type View = {
  getSnapshot: () => MarketViewSnapshot;
  getServerSnapshot: () => MarketViewSnapshot;
  getQuote: () => MarketViewSnapshot["quote"];
  getServerQuote: () => MarketViewSnapshot["quote"];
  subscribe: (listener: () => void) => () => void;
  subscribeDetail: (listener: () => void) => () => void;
};

// Presentation only. The underlying store keeps receiving/aggregating normally.
// A single bounded in-memory copy holds all symbols at the same UI capture point.
export class MarketReadingStore {
  readonly mode: MarketSource;
  readonly views: Map<string, View>;
  private source: MarketStore | LocalMarketStore;
  private initialReading: ReadingState = { frozen: false, capturedAtMs: null, revision: 0 };
  private reading = this.initialReading;
  private held = new Map<string, MarketViewSnapshot>();
  private heldSession: SessionSnapshot | undefined;
  private listeners = new Set<() => void>();
  private readingListeners = new Set<() => void>();

  constructor(source: MarketStore | LocalMarketStore) {
    this.source = source;
    this.mode = source.mode;
    this.views = new Map<string, View>();
    for (const [symbol, view] of source.views) {
      const getSnapshot = () => this.held.get(symbol) ?? view.getSnapshot();
      this.views.set(symbol, {
        getSnapshot,
        getServerSnapshot: view.getServerSnapshot,
        getQuote: () => getSnapshot().quote,
        getServerQuote: view.getServerQuote,
        subscribe: (listener: () => void) => this.listen(view.subscribe, listener),
        subscribeDetail: (listener: () => void) => this.listen(view.subscribeDetail, listener),
      });
    }
  }
  private listen(subscribe: View["subscribe"], listener: () => void) {
    // Keep detail subscriptions attached while frozen; only notifications stop.
    const notify = () => listener();
    this.listeners.add(notify);
    const stop = subscribe(() => { if (!this.reading.frozen) notify(); });
    return () => { this.listeners.delete(notify); stop(); };
  }
  private changed() {
    this.readingListeners.forEach((listener) => listener());
    this.listeners.forEach((listener) => listener());
  }
  private capture() {
    const held = new Map<string, MarketViewSnapshot>();
    for (const [symbol, view] of this.source.views) held.set(symbol, structuredClone(view.getSnapshot()));
    this.held = held;
    this.heldSession = { ...this.source.getSessionSnapshot() };
    this.reading = { frozen: true, capturedAtMs: Date.now(), revision: this.reading.revision + 1 };
    this.changed();
  }
  freeze = () => { if (!this.reading.frozen) this.capture(); };
  refresh = () => { if (this.reading.frozen) this.capture(); };
  release = () => {
    if (!this.reading.frozen) return;
    this.held.clear(); this.heldSession = undefined;
    this.reading = { frozen: false, capturedAtMs: null, revision: this.reading.revision + 1 };
    this.changed();
  };
  getReadingSnapshot = () => this.reading;
  getServerReadingSnapshot = () => this.initialReading;
  subscribeReading = (listener: () => void) => {
    this.readingListeners.add(listener);
    return () => { this.readingListeners.delete(listener); };
  };
  getSessionSnapshot = () => this.heldSession ?? this.source.getSessionSnapshot();
  getServerSessionSnapshot = () => this.source.getServerSessionSnapshot();
  subscribeSession = (listener: () => void) => this.listen(this.source.subscribeSession, listener);
  start = (hidden = false) => this.source.start(hidden);
  stop = () => {
    this.source.stop();
    this.held.clear(); this.heldSession = undefined; this.reading = this.initialReading;
  };
  // Explicit playback/connection changes leave reading mode so their result is visible.
  pause = () => { this.source.pause(); this.release(); };
  resume = () => { this.source.resume(); this.release(); };
  reset = () => { this.source.reset(); this.release(); };
  setSpeed = (speed: PlaybackSpeed) => { this.source.setSpeed(speed); this.release(); };
  // Visibility changes follow the existing provider policy, preserving the frozen view.
  setHidden = (hidden: boolean) => this.source.setHidden(hidden);
  getHistory = (query: HistoryQuery, signal?: AbortSignal): Promise<HistoryResult> => {
    if (this.source.mode !== "kis-private") throw new Error("개인 시세 모드에서만 일봉을 조회합니다.");
    return this.source.getHistory(query, signal);
  };
}
