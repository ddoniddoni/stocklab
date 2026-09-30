import { lstat, readdir, readFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { loadEnvConfig } from "@next/env";
import { validateEnvironment, publicCacheConnection } from "../../src/lib/config.ts";
import { readPublishedJson, readSourceManifest, validatePublishedDataset } from "../../src/lib/published-files.ts";

// An opt-in quality command, also wired to future npm build/start lifecycles.
// It is not an automatic collection, DB write, test runner, or deployment.
async function files(directory: string, optional = false): Promise<string[]> {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (optional && (error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  const result: string[] = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error("symlink");
    if (entry.isDirectory()) result.push(...await files(path));
    else if (entry.isFile()) result.push(path);
  }
  return result;
}
const forbiddenPath = /(?:^|\/)(?:data\/(?:raw|private)|tools\/(?:dart|kis-bridge))(?:\/|$)|(?:^|\/)\.env(?:\.|$)|(?:kis[-_](?:record|replay|capture)|market[-_](?:record|capture))/i;
async function inspect(path: string, secrets: string[]) {
  const name = relative(process.cwd(), path).replaceAll("\\", "/");
  if (forbiddenPath.test(name)) throw new Error("private artifact");
  const stat = await lstat(path);
  if (stat.size > 32 * 1024 * 1024) throw new Error("oversize artifact");
  const text = await readFile(path, "utf8");
  if (/sb_secret_[A-Za-z0-9_-]{16,}/.test(text) || /["'](?:stck_prpr|stck_oprc|askp1|bidp1)["']\s*:/.test(text) ||
    secrets.some((secret) => text.includes(secret))) throw new Error("sensitive artifact");
  if (path.endsWith(".nft.json")) {
    const trace = JSON.parse(text) as { files?: unknown };
    if (!Array.isArray(trace.files) || trace.files.some((item) => typeof item !== "string" || forbiddenPath.test(item.replaceAll("\\", "/"))))
      throw new Error("private trace");
  }
}
async function main() {
  if (process.argv.slice(2).some((arg) => arg !== "--artifacts") || process.argv.slice(2).length > 1) throw new Error("arguments");
  // Match Next production env-file precedence without logging environment contents.
  loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
  const config = validateEnvironment(process.env);
  if (config.marketMode !== "synthetic") throw new Error("public market mode");
  if (config.financialMode === "dart-cache") publicCacheConnection(process.env);
  const manifest = await readSourceManifest();
  const source = config.financialMode === "fixture" ? "fixture" : "opendart";
  if (manifest.financials.source !== source) throw new Error("source mismatch");
  const registered = new Set(["manifest.json", ...manifest.financials.datasets.map((entry) => `${entry.id}.json`)]);
  const published = await files(resolve("data/published"));
  if (published.length !== registered.size || published.some((path) => !registered.has(relative(resolve("data/published"), path))))
    throw new Error("unregistered dataset");
  for (const entry of manifest.financials.datasets) validatePublishedDataset(await readPublishedJson(`${entry.id}.json`), entry);
  const secrets = Object.entries(process.env).filter(([key, value]) =>
    /(?:SECRET|SERVICE_ROLE|DART_API_KEY|KIS_APP_KEY|ACCESS_TOKEN)/.test(key) && value && value.length >= 8).map(([, value]) => value!);
  for (const path of [...published, ...await files(resolve("public"), true)]) await inspect(path, secrets);
  if (process.argv.includes("--artifacts")) {
    const paths = [...await files(resolve(".next/server")), ...await files(resolve(".next/static"))];
    for (const path of paths) await inspect(path, secrets);
    await inspect(resolve(".next/next-server.js.nft.json"), secrets);
    await inspect(resolve(".next/required-server-files.json"), secrets);
    for (const path of await files(resolve(".next/standalone"), true)) await inspect(path, secrets);
  }
  console.log(`공개 경계 검사: manifest/등록 자료 ${manifest.financials.datasets.length}개/설정${process.argv.includes("--artifacts") ? "/빌드 산출물" : ""} 확인.`);
  console.log("파일·설정 검사이며 실제 Network, RLS, 데이터 재이용 권한이나 원문 정확성의 검증을 대신하지 않습니다.");
}
await main().catch(() => {
  console.error("PUBLIC_BOUNDARY: 공개 설정·출처 manifest·등록 파일·산출물을 확인하세요. 비밀정보와 원천 내용을 로그에 출력하지 않습니다.");
  process.exitCode = 1;
});
