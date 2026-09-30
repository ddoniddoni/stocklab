"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { instruments, getInstrument } from "@/domain/instruments";
import { usePersonal, usePersonalStore } from "@/features/personal/personal-context";
import { LocalNotice, StorageStatus } from "@/features/personal/personal-controls";
import { BackupControls } from "@/features/personal/backup-controls";
import { downloadDraft } from "@/features/personal/download";

const statusLabels = { idle: "노트 선택", editing: "저장 대기", saving: "저장 중…", saved: "저장됨", error: "저장 실패", conflict: "다른 탭과 충돌" };
const textFields = [["thesis", "핵심 생각", "이 기업을 살펴보는 이유를 적어두세요."],
  ["evidence", "근거", "확인한 사실과 출처를 기록하세요."], ["risks", "위험 요인", "생각이 달라질 수 있는 조건은 무엇인가요?"],
  ["review", "회고", "다시 살펴본 뒤 달라진 판단을 기록하세요."]] as const;

export function NotesWorkspace({ initialSymbol, initialNoteId }: { initialSymbol: string | null; initialNoteId: string | null }) {
  const snapshot = usePersonal();
  const store = usePersonalStore();
  const [query, setQuery] = useState("");
  const [symbol, setSymbol] = useState(initialSymbol ?? "");
  useEffect(() => () => { void store.flush(); }, [store]);
  useEffect(() => { if (initialNoteId && snapshot.status === "ready") void store.open(initialNoteId); }, [initialNoteId, snapshot.status, store]);
  const notes = [...(snapshot.data?.notes ?? [])].filter((note) => (!symbol || note.symbol === symbol) &&
    `${note.title} ${note.thesis}`.toLocaleLowerCase("ko-KR").includes(query.toLocaleLowerCase("ko-KR")))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const draft = snapshot.draft;
  const note = draft?.note;
  return <><div className="personal-page-heading"><p className="eyebrow">RESEARCH JOURNAL</p><h1>리서치 노트</h1><p className="intro">판단과 근거, 아직 확인하지 못한 것을 함께 기록하세요.</p></div>
    <LocalNotice /><StorageStatus />
    <div className="notes-workspace"><aside className="panel notes-sidebar" aria-label="노트 목록">
      <div className="personal-content"><label htmlFor="note-search">노트 검색</label><input id="note-search" type="search" value={query} maxLength={120} onChange={(event) => setQuery(event.target.value)} placeholder="제목 또는 핵심 생각" />
        <label htmlFor="note-filter">관련 종목</label><select id="note-filter" value={symbol} onChange={(event) => setSymbol(event.target.value)}><option value="">전체 종목</option>{instruments.map((stock) => <option key={stock.symbol} value={stock.symbol}>{stock.name}</option>)}</select>
        <button className="new-note-button" type="button" disabled={snapshot.status === "loading" || snapshot.busy || snapshot.saveStatus === "saving"}
          onClick={() => void store.create(symbol || instruments[0]!.symbol)}>＋ 새 노트</button></div>
      <ul className="note-list">{notes.map((item) => <li key={item.id}><button type="button" aria-pressed={note?.id === item.id} disabled={snapshot.busy}
        onClick={() => void store.open(item.id)}><strong>{item.title}</strong><span>{getInstrument(item.symbol)?.name}</span><small>{item.updatedAt.slice(0, 10)} 수정 · v{item.version}</small></button></li>)}</ul>
      {snapshot.status !== "loading" && !notes.length ? <p className="personal-empty">{query ? "검색 결과가 없습니다." : "저장된 노트가 없습니다. 새 노트로 첫 기록을 남겨보세요."}</p> : null}
    </aside>
    <section className="panel note-editor" aria-label="노트 편집">
      {note && draft ? <form onSubmit={(event) => { event.preventDefault(); void store.flush(); }} onBlur={() => void store.flush()}>
        <div className="panel-heading"><h2>{getInstrument(note.symbol)?.name} 리서치</h2><span className={`save-status save-${snapshot.saveStatus}`} role="status">{statusLabels[snapshot.saveStatus]}</span></div>
        {snapshot.saveIssue ? <div className="personal-issue" role="alert"><p>{snapshot.saveIssue}</p>
          <div className="research-actions">
            {snapshot.saveStatus === "conflict" ? <><button type="button" onClick={() => {
              if (window.confirm("내 미저장 초안을 버리고 최신 저장 내용을 불러올까요? 초안은 먼저 텍스트로 내보낼 수 있습니다.")) void store.loadLatest();
            }}>최신 내용 불러오기</button><button type="button" onClick={() => void store.saveCopy()}>내 초안을 사본으로 저장</button></>
              : <button type="button" onClick={() => void store.flush()}>저장 다시 시도</button>}
            <button type="button" onClick={() => downloadDraft(note)}>초안 텍스트 내보내기</button></div></div> : null}
        <fieldset className="personal-content note-fields-frame" disabled={snapshot.busy}><div className="note-title-row"><div><label htmlFor="note-title">제목 <small>최대 120자</small></label><input id="note-title" value={note.title} maxLength={120} required aria-invalid={!note.title.trim()}
          onChange={(event) => store.update({ title: event.target.value })} /></div><div><label htmlFor="note-symbol">관련 종목</label><select id="note-symbol" value={note.symbol} onChange={(event) => store.update({ symbol: event.target.value })}>
            {instruments.map((stock) => <option key={stock.symbol} value={stock.symbol}>{stock.name}</option>)}</select></div></div>
          <div className="note-fields">{textFields.map(([key, label, placeholder]) => <div key={key}><label htmlFor={`note-${key}`}>{label}<small>{note[key].length.toLocaleString()} / 10,000</small></label>
            <textarea id={`note-${key}`} rows={6} value={note[key]} maxLength={10000} placeholder={placeholder} onChange={(event) => store.update({ [key]: event.target.value })} /></div>)}</div>
          <fieldset className="note-checklist"><legend>확인할 일 <small>{note.checklist.length} / 30</small></legend>
            {note.checklist.map((item, index) => <div className="checklist-row" key={item.id}><input type="checkbox" aria-label={`확인할 일 ${index + 1} 완료`} checked={item.done}
              onChange={(event) => store.update({ checklist: note.checklist.map((entry) => entry.id === item.id ? { ...entry, done: event.target.checked } : entry) })} />
              <input aria-label={`확인할 일 ${index + 1} 내용`} value={item.text} maxLength={300} onChange={(event) => store.update({ checklist: note.checklist.map((entry) => entry.id === item.id ? { ...entry, text: event.target.value } : entry) })} />
              <button type="button" aria-label={`확인할 일 ${index + 1} 삭제`} onClick={() => store.update({ checklist: note.checklist.filter((entry) => entry.id !== item.id) })}>삭제</button></div>)}
            <button type="button" disabled={note.checklist.length >= 30} onClick={() => store.update({ checklist: [...note.checklist, { id: crypto.randomUUID(), text: "", done: false }] })}>＋ 확인할 일 추가</button>
          </fieldset>
          <p className="note-dates">작성 {note.createdAt.slice(0, 10)} · 마지막 저장 {draft.expectedVersion ? note.updatedAt.replace("T", " ").slice(0, 19) + " UTC" : "아직 없음"}</p>
          <div className="research-actions"><button type="submit" disabled={snapshot.saveStatus === "saving" || snapshot.saveStatus === "conflict"}>지금 저장</button>
            <button type="button" onClick={() => downloadDraft(note)}>현재 노트 텍스트 내보내기</button><Link href={`/stocks/${note.symbol}?tab=financials`}>기업 재무 보기 →</Link>
            <button type="button" disabled={snapshot.saveStatus === "saving"} onClick={() => {
              if (!draft.dirty || window.confirm("미저장 초안을 닫을까요? 필요한 내용은 먼저 텍스트로 내보내세요. 저장된 노트는 삭제되지 않습니다.")) void store.closeDraft();
            }}>편집 닫기</button>
            {draft.expectedVersion > 0 ? <button type="button" className="danger-button" disabled={snapshot.busy || snapshot.saveStatus === "saving" || snapshot.saveStatus === "conflict"}
              onClick={() => { if (window.confirm("이 노트를 삭제할까요? 되돌릴 수 없습니다.")) void store.remove(note.id); }}>노트 삭제</button> : null}</div>
          <p className="personal-status">입력 후 자동 저장합니다. ‘저장됨’을 확인한 뒤 탭을 닫으세요.</p>
        </fieldset></form> : <div className="personal-empty"><h2>생각을 기록할 공간</h2><p>목록에서 노트를 선택하거나 새 노트를 만드세요.</p></div>}
    </section></div><BackupControls />
  </>;
}
