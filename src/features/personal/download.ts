import type { Note } from "@/domain/personal";

export function downloadFile(text: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function downloadDraft(note: Note) {
  const text = `${note.title}\n종목: ${note.symbol}\n\n핵심 생각\n${note.thesis}\n\n근거\n${note.evidence}\n\n위험 요인\n${note.risks}\n\n확인할 일\n${note.checklist.map((item) => `${item.done ? "[x]" : "[ ]"} ${item.text}`).join("\n")}\n\n회고\n${note.review}\n`;
  downloadFile(text, `stocklab-note-${note.id}.txt`, "text/plain;charset=utf-8");
}
