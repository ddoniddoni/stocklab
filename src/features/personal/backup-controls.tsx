"use client";
import { useRef, useState, type ChangeEvent } from "react";
import { exportPersonalData, MAX_BACKUP_BYTES, parseBackup, PersonalError, personalError,
  type PersonalBackup, type PersonalData } from "@/domain/personal";
import { usePersonal, usePersonalStore } from "./personal-context";
import { downloadFile } from "./download";

export function BackupControls() {
  const snapshot = usePersonal();
  const store = usePersonalStore();
  const [preview, setPreview] = useState<{ backup: PersonalBackup; expected: PersonalData } | null>(null);
  const [message, setMessage] = useState("");
  const [reading, setReading] = useState(false);
  const readId = useRef(0);
  const disabled = snapshot.status !== "ready" || snapshot.busy || snapshot.draft?.dirty === true || reading;
  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !snapshot.data) return;
    const id = ++readId.current;
    const expected = snapshot.data;
    setReading(true); setPreview(null); setMessage("");
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new PersonalError("capacity");
      const backup = parseBackup(await file.text());
      if (readId.current === id) setPreview({ backup, expected });
    } catch (error) { if (readId.current === id) setMessage(personalError(error).message); }
    finally { if (readId.current === id) setReading(false); }
  }
  async function exportSaved() {
    const fresh = await store.refresh();
    const data = store.getSnapshot().data;
    if (!data) return;
    downloadFile(JSON.stringify(exportPersonalData(data)), `stocklab-personal-${new Date().toISOString().slice(0, 10)}.json`, "application/json");
    setMessage(fresh ? "저장된 관심종목과 노트를 내보냈습니다. 미저장 초안은 별도로 내보내세요."
      : "마지막으로 불러온 기록을 내보냈습니다. 저장소의 최신 상태는 확인하지 못했습니다.");
  }
  return <section className="panel backup-panel" aria-labelledby="backup-title">
    <div className="panel-heading"><h2 id="backup-title">내 기록 백업</h2><span className="subtle">관심종목 · 노트 텍스트</span></div>
    <div className="personal-content"><p className="subtle">JSON 파일로 저장된 기록을 옮길 수 있습니다. 가져온 노트는 사본으로 추가되며 기존 기록을 덮어쓰지 않습니다. 파일은 최대 2MiB입니다.</p>
      <div className="research-actions"><button type="button" disabled={!snapshot.data || snapshot.busy} onClick={() => void exportSaved()}>저장된 기록 내보내기</button>
        <label className="file-label">백업 파일 선택<input type="file" accept="application/json,.json" disabled={disabled} onChange={(event) => void chooseFile(event)} /></label>
        <button type="button" className="danger-button" disabled={disabled} onClick={async () => {
          if (!snapshot.data || !window.confirm("이 브라우저의 관심종목과 저장된 노트를 모두 삭제할까요? 되돌릴 수 없습니다. 먼저 백업을 내보내세요.")) return;
          const done = await store.reset(snapshot.data); if (done) { setPreview(null); setMessage("이 브라우저의 개인 기록을 초기화했습니다."); }
        }}>로컬 기록 초기화</button></div>
      {snapshot.draft?.dirty ? <p className="personal-status">미저장 초안을 저장하거나 텍스트로 보관한 뒤 가져오기·초기화를 진행하세요.</p> : null}
      {reading ? <p role="status">백업 파일을 읽는 중…</p> : null}
      {preview ? <div className="import-preview"><p>관심종목 {preview.backup.watchlist.length}개 · 노트 {preview.backup.notes.length}개를 기존 기록에 추가합니다.</p>
        <div className="research-actions"><button type="button" disabled={disabled} onClick={async () => {
          if (await store.importBackup(preview.backup, preview.expected)) { setPreview(null); setMessage("기존 기록을 보존하고 백업을 추가했습니다."); }
          else { setPreview(null); setMessage("가져오지 못했습니다. 현재 기록을 확인하고 파일을 다시 선택하세요."); }
        }}>이 백업 추가하기</button><button type="button" onClick={() => setPreview(null)}>취소</button></div></div> : null}
      {message ? <p className="personal-status" role="status">{message}</p> : null}
    </div>
  </section>;
}
