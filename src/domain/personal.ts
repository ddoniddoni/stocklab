import { z } from "zod";
import { getInstrument, instruments } from "./instruments";

export const MAX_BACKUP_BYTES = 2 * 1024 * 1024;
export const MAX_NOTES = 200;
const symbol = z.string().refine((value) => !!getInstrument(value), "지원하지 않는 종목입니다.");
export const checklistSchema = z.array(z.object({
  id: z.uuid(), text: z.string().max(300), done: z.boolean(),
}).strict()).max(30).refine((items) => new Set(items.map((item) => item.id)).size === items.length);
export const noteSchema = z.object({
  id: z.uuid(), symbol, title: z.string().min(1).max(120),
  thesis: z.string().max(10000), evidence: z.string().max(10000),
  risks: z.string().max(10000), review: z.string().max(10000), checklist: checklistSchema,
  version: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(),
}).strict().refine((note) => Date.parse(note.updatedAt) >= Date.parse(note.createdAt));
export type Note = z.infer<typeof noteSchema>;
export const watchlistSchema = z.array(symbol).max(instruments.length)
  .refine((items) => new Set(items).size === items.length);
const notesSchema = z.array(noteSchema).max(MAX_NOTES)
  .refine((items) => new Set(items.map((item) => item.id)).size === items.length);
export const personalSchema = z.object({
  schemaVersion: z.literal(1), namespace: z.literal("guest"), generation: z.uuid(),
  revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  watchVersion: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  watchlist: watchlistSchema, notes: notesSchema,
}).strict();
export type PersonalData = z.infer<typeof personalSchema>;
export const backupSchema = z.object({
  format: z.literal("stocklab-personal"), schemaVersion: z.literal(1), exportedAt: z.iso.datetime(),
  watchlist: watchlistSchema, notes: notesSchema,
}).strict();
export type PersonalBackup = z.infer<typeof backupSchema>;
export function emptyPersonalData(): PersonalData {
  return { schemaVersion: 1, namespace: "guest", generation: crypto.randomUUID(),
    revision: 0, watchVersion: 0, watchlist: [], notes: [] };
}
export function newNote(symbol: string): Note {
  const now = new Date().toISOString();
  return noteSchema.parse({ id: crypto.randomUUID(), symbol, title: "새 리서치 노트",
    thesis: "", evidence: "", risks: "", review: "", checklist: [], version: 0, createdAt: now, updatedAt: now });
}
export function exportPersonalData(data: PersonalData): PersonalBackup {
  // Only the explicit personal contract is serializable. No market/cache/config.
  return backupSchema.parse({ format: "stocklab-personal", schemaVersion: 1,
    exportedAt: new Date().toISOString(), watchlist: data.watchlist, notes: data.notes });
}

export class PersonalError extends Error {
  readonly code: "storage" | "conflict" | "invalid" | "capacity" | "blocked";
  constructor(code: PersonalError["code"]) {
    super({ storage: "브라우저에 저장하지 못했습니다. 저장 권한과 공간을 확인하거나 기록을 내보내세요.",
      conflict: "다른 탭에서 기록이 바뀌었습니다. 최신 내용을 확인하거나 내 초안을 사본으로 저장하세요.",
      invalid: "기록의 형식이나 길이를 확인하세요. 지원하는 StockLab 백업 파일만 가져올 수 있습니다.",
      capacity: "저장 한도(노트 200개·전체 2MiB)를 초과했습니다. 기록을 내보내고 정리하세요.",
      blocked: "저장소를 열지 못했습니다. 다른 StockLab 탭을 닫고 다시 시도하세요.",
    }[code]);
    this.code = code;
  }
}
export function personalError(error: unknown): PersonalError {
  return error instanceof PersonalError ? error : new PersonalError("storage");
}
export function parseBackup(text: string): PersonalBackup {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) throw new PersonalError("capacity");
  try { return backupSchema.parse(JSON.parse(text)); }
  catch { throw new PersonalError("invalid"); }
}
export interface PersonalRepository {
  load(): Promise<PersonalData>;
  saveNote(note: Note, generation: string, expectedVersion: number): Promise<PersonalData>;
  deleteNote(id: string, generation: string, expectedVersion: number): Promise<PersonalData>;
  setWatchlist(symbols: string[], generation: string, expectedVersion: number): Promise<PersonalData>;
  importBackup(backup: PersonalBackup, generation: string, expectedRevision: number): Promise<PersonalData>;
  reset(generation: string, expectedRevision: number): Promise<PersonalData>;
}
