"use client";
import Link from "next/link";
import { instruments, getInstrument } from "@/domain/instruments";
import { usePersonal, usePersonalStore } from "@/features/personal/personal-context";
import { LocalNotice, StorageStatus, WatchButton } from "@/features/personal/personal-controls";
import { BackupControls } from "@/features/personal/backup-controls";

export function WatchlistWorkspace() {
  const snapshot = usePersonal();
  const store = usePersonalStore();
  const symbols = snapshot.data?.watchlist ?? [];
  function move(index: number, step: number) {
    const next = [...symbols];
    const destination = index + step;
    if (!next[index] || !next[destination]) return;
    [next[index], next[destination]] = [next[destination]!, next[index]!];
    void store.setWatchlist(next);
  }
  return <><div className="personal-page-heading"><p className="eyebrow">MY WATCHLIST</p><h1>관심종목</h1><p className="intro">살펴볼 기업을 모으고, 원하는 순서로 정리하세요.</p></div>
    <LocalNotice /><StorageStatus />
    <section className="panel"><div className="panel-heading"><h2>내 관심종목 · {symbols.length}</h2><Link href="/?view=watchlist">합성 시세 보기 →</Link></div>
      {symbols.length ? <ol className="watchlist-rows">{symbols.map((symbol, index) => <li key={symbol}>
        <span className="watch-position">{String(index + 1).padStart(2, "0")}</span>
        <Link className="stock-name" href={`/stocks/${symbol}`}>{getInstrument(symbol)?.name}<small>{symbol}</small></Link>
        <div className="research-actions"><Link href={`/notes?symbol=${symbol}`}>노트</Link>
          <button type="button" aria-label={`${getInstrument(symbol)?.name} 위로 이동`} disabled={index === 0 || snapshot.busy || snapshot.status !== "ready"} onClick={() => move(index, -1)}>↑</button>
          <button type="button" aria-label={`${getInstrument(symbol)?.name} 아래로 이동`} disabled={index === symbols.length - 1 || snapshot.busy || snapshot.status !== "ready"} onClick={() => move(index, 1)}>↓</button>
          <WatchButton symbol={symbol} /></div></li>)}</ol>
        : snapshot.status === "ready" ? <p className="personal-empty">아직 관심종목이 없습니다. 아래 기업의 별표를 눌러 추가하세요.</p> : null}
      <div className="panel-foot">추가·삭제·순서 변경은 이 브라우저에 저장됩니다.</div>
    </section>
    <section className="panel personal-section"><div className="panel-heading"><h2>지원 종목에서 추가</h2><span className="subtle">최대 {instruments.length}종목</span></div>
      <ul className="instrument-picker">{instruments.map((stock) => <li key={stock.symbol}><span>{stock.name}<small>{stock.symbol}</small></span><WatchButton symbol={stock.symbol} /></li>)}</ul></section>
    <BackupControls />
  </>;
}
