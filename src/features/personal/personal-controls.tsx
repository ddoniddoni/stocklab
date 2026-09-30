"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { memo } from "react";
import { getInstrument } from "@/domain/instruments";
import { usePersonal, usePersonalStore } from "./personal-context";
import { downloadDraft } from "./download";

export function LocalNotice() {
  return <p className="local-notice">이 브라우저에만 저장됩니다. 브라우저 데이터를 삭제하면 기록도 삭제됩니다.</p>;
}
export function StorageStatus() {
  const snapshot = usePersonal();
  const store = usePersonalStore();
  if (snapshot.status === "loading") return <p className="personal-status" role="status">브라우저 기록을 불러오는 중…</p>;
  if (snapshot.issue) return <div className="personal-issue" role="alert"><p>{snapshot.issue}</p>
    <button type="button" onClick={() => void store.refresh()}>기록 다시 불러오기</button></div>;
  return null;
}
export const WatchButton = memo(function WatchButton({ symbol }: { symbol: string }) {
  const snapshot = usePersonal();
  const store = usePersonalStore();
  const watched = snapshot.data?.watchlist.includes(symbol) ?? false;
  const name = getInstrument(symbol)?.name ?? symbol;
  return <button type="button" className="watch-button" aria-label={`${name} 관심종목 ${watched ? "해제" : "추가"}`}
    aria-pressed={watched} disabled={snapshot.status !== "ready" || snapshot.busy}
    onClick={() => { const list = snapshot.data!.watchlist;
      void store.setWatchlist(watched ? list.filter((value) => value !== symbol) : [...list, symbol]); }}>
    {watched ? "★" : "☆"}</button>;
});
export const StockResearchActions = memo(function StockResearchActions({ symbol }: { symbol: string }) {
  return <div className="research-actions"><WatchButton symbol={symbol} />
    <Link className="button-link" href={`/compare?symbols=${symbol}`}>기업 비교</Link>
    <Link className="button-link" href={`/notes?symbol=${symbol}`}>리서치 노트</Link></div>;
});
export function PendingDraftNotice() {
  const snapshot = usePersonal();
  const pathname = usePathname();
  if (pathname === "/notes" || !snapshot.draft?.dirty) return null;
  const failed = snapshot.saveStatus === "error" || snapshot.saveStatus === "conflict";
  return <aside className="pending-draft" role="status">
    <span>{failed ? "노트가 저장되지 않았습니다. 초안은 이 화면에 남아 있습니다." : "노트 변경사항을 저장 중입니다."}</span>
    <Link href="/notes">초안으로 돌아가기</Link>
    {failed ? <button type="button" onClick={() => downloadDraft(snapshot.draft!.note)}>초안 텍스트 내보내기</button> : null}
  </aside>;
}
export function RecentNotes() {
  const snapshot = usePersonal();
  const notes = [...(snapshot.data?.notes ?? [])].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 3);
  return <section className="panel recent-notes"><div className="panel-heading"><h2>내 리서치 기록</h2><Link href="/notes">노트 열기 →</Link></div>
    <LocalNotice /><StorageStatus />
    {notes.length ? <ul className="personal-list">{notes.map((note) => <li key={note.id}>
      <Link href={`/notes?symbol=${note.symbol}&note=${note.id}`}><strong>{note.title}</strong><small>{getInstrument(note.symbol)?.name} · {note.updatedAt.slice(0, 10)}</small></Link>
    </li>)}</ul> : snapshot.status === "ready" ? <p className="personal-empty">아직 저장한 노트가 없습니다. 종목을 살펴보고 생각을 기록해 보세요.</p> : null}
  </section>;
}
