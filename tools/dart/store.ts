import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, rename, rmdir, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fail } from "./errors.ts";
import { hashSchema, json, parse, runIdSchema, stateSchema, type State } from "./schema.ts";

const privateRoot = resolve("data/private/dart");
const rawRoot = resolve("data/raw/dart");
export function digest(bytes: string | Uint8Array) { return createHash("sha256").update(bytes).digest("hex"); }
export function encode(value: unknown) { return `${JSON.stringify(value, null, 2)}\n`; }
export function runPath(runId: string, name: "state.json" | "candidate.json" | "review.json") {
  return resolve(privateRoot, "runs", parse(runIdSchema, runId), name);
}
export async function readBounded(path: string, limit = 20 * 1024 * 1024) {
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > limit) fail("INTEGRITY");
  const bytes = await readFile(path);
  if (bytes.byteLength > limit) fail("TOO_LARGE");
  return bytes;
}
export async function writeNew(path: string, bytes: string | Uint8Array) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, bytes, { flag: "wx", mode: 0o600 });
}
export async function atomicWrite(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, encode(value), { flag: "wx", mode: 0o600 });
    await rename(temporary, path);
  } finally { await unlink(temporary).catch(() => undefined); }
}
export async function saveRaw(bytes: Uint8Array) {
  const hash = digest(bytes);
  const path = resolve(rawRoot, `${hash}.bin`);
  try { await writeNew(path, bytes); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    if (digest(await readBounded(path)) !== hash) fail("INTEGRITY");
  }
  return hash;
}
export async function readRaw(hash: string) {
  const bytes = await readBounded(resolve(rawRoot, `${parse(hashSchema, hash)}.bin`));
  if (digest(bytes) !== hash) fail("INTEGRITY");
  return bytes;
}
export async function loadState(runId: string): Promise<State> {
  const state = parse(stateSchema, json(await readBounded(runPath(runId, "state.json"))));
  if (state.runId !== runId) fail("INTEGRITY");
  return state;
}
export async function saveState(state: State) {
  await atomicWrite(runPath(state.runId, "state.json"), parse(stateSchema, state));
}
export async function lock() {
  await mkdir(privateRoot, { recursive: true, mode: 0o700 });
  const path = resolve(privateRoot, ".sync.lock");
  try { await mkdir(path, { mode: 0o700 }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") fail("LOCKED");
    throw error;
  }
  return async () => { await rmdir(path); };
}
export async function writeExport(runId: string, reviewHash: string, value: unknown) {
  const path = resolve(privateRoot, "exports", `${parse(runIdSchema, runId)}-${parse(hashSchema, reviewHash)}.json`);
  await writeNew(path, encode(value));
  return path;
}
