import { getInstrument } from "@/domain/instruments";
import { NotesWorkspace } from "@/features/notes/notes-workspace";
import { z } from "zod";
export const metadata = { title: "리서치 노트" };
export default async function NotesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const symbol = typeof query.symbol === "string" && getInstrument(query.symbol) ? query.symbol : null;
  const parsedNote = z.uuid().safeParse(query.note);
  const noteId = parsedNote.success ? parsedNote.data : null;
  return <>{query.symbol !== undefined && symbol === null ? <p className="personal-issue">지원하지 않는 종목 필터입니다. 전체 노트를 표시합니다.</p> : null}
    {query.note !== undefined && !noteId ? <p className="personal-issue">올바르지 않은 노트 주소입니다. 목록에서 노트를 선택하세요.</p> : null}
    <NotesWorkspace key={`${symbol ?? "all"}:${noteId ?? "none"}`} initialSymbol={symbol} initialNoteId={noteId} /></>;
}
