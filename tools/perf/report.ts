import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { cpus, release, totalmem } from "node:os";
import { lstat, mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Options } from "./options.ts";
import { scenario } from "./scenario.ts";
import type { CaseResult } from "./measure.ts";

const execute = promisify(execFile);
export async function environment(root: string) {
  let commit: string | null = null, dirty: boolean | null = null;
  try {
    const head = await execute("git", ["rev-parse", "HEAD"], { cwd: root, timeout: 5000 });
    const status = await execute("git", ["status", "--porcelain", "--untracked-files=normal"], { cwd: root, timeout: 5000 });
    commit = /^[a-f0-9]{40,64}$/.test(head.stdout.trim()) ? head.stdout.trim() : null;
    dirty = status.stdout.trim().length > 0;
  } catch { /* Unknown stays null, never silently becomes a clean revision. */ }
  const processors = cpus();
  return { commit, dirty, node: process.version, v8: process.versions.v8, platform: process.platform,
    osRelease: release(), architecture: process.arch, cpuModel: processors[0]?.model ?? null,
    logicalCpus: processors.length, systemMemoryBytes: totalmem() };
}

export const limitations = [
  "입력 1건은 5종목 전체에서 발생하는 합성 체결 1건이다. 각 입력은 quote/book도 1개씩 생성한다. 실제 한투 처리량이 아니다.",
  "측정 대상은 기존 SyntheticEngine의 생성·검증·집계와 이 CLI 스케줄러다. 앱 provider/store, 네트워크, React 렌더링은 실행하지 않는다.",
  "초기 이력 생성, 사후 대조, 보고서 쓰기 중에는 계측하지 않는다. 초기화 후 보유 메모리는 시작 표본에 포함된다. 초기 이력 자체는 독립 대조하지 않는다.",
  "예약한 가상 입력과 완료 시각의 차이를 측정한다. 외부 소켓 도착 지연이나 사용자 입력 지연이 아니다. Node 이벤트 루프 지표는 브라우저 long task가 아니다.",
  "메모리는 전체 Node 프로세스의 약 1초 간격 표본이다. 표본 최댓값은 순간 peak가 아니며 증가만으로 누수를 판정하지 않는다. 강제 GC를 실행하지 않는다.",
  "반복은 같은 프로세스에서 순서대로 실행한다. JIT/GC/앞선 보고서 보관 비용과 계측 오버헤드가 포함되므로 같은 장비·Node·조건끼리 비교한다.",
  "정합성 matched는 이 합성 실행의 최종 bounded 상태와 대조 결과다. 목표 처리량 달성, 앱 전체 정확성, 접근성 또는 릴리스 게이트 통과를 뜻하지 않는다.",
];
export type Report = {
  schemaVersion: 1;
  runId: string;
  status: "running" | "completed" | "cancelled" | "failed";
  startedAt: string;
  finishedAt: string | null;
  options: Options;
  environment: Awaited<ReturnType<typeof environment>>;
  scenario: typeof scenario;
  cases: CaseResult[];
  plannedCases: number;
  failure: string | null;
  browser: { measured: false; reactCommits: null; longTasks: null; inputLatencyMs: null };
  limitations: string[];
};

async function directory(path: string) {
  try { await mkdir(path); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("OUTPUT_PATH");
}
export async function createOutput(root: string, runId: string) {
  const results = join(root, "test-results"), performance = join(results, "performance");
  await directory(results);
  await directory(performance);
  const path = join(performance, runId);
  // Exclusive directory ownership: even an interrupted run is never overwritten.
  await mkdir(path);
  return path;
}
const display = (value: number | null | undefined) => value == null ? "미측정" : value.toFixed(2);
const escapeCell = (value: string) => value.replaceAll("|", "\\|").replaceAll("\n", " ");
function markdown(report: Report) {
  const env = report.environment;
  return [
    "# StockLab 합성 엔진 측정", "", `실행: ${report.runId} · 상태: ${report.status}`,
    `시작: ${report.startedAt} · 종료: ${report.finishedAt ?? "미종료"}`,
    `코드: ${env.commit ?? "확인 불가"} · 미커밋 변경: ${env.dirty === null ? "확인 불가" : env.dirty ? "있음" : "없음"}`,
    `환경: ${env.node} / V8 ${env.v8} / ${env.platform} ${env.osRelease} ${env.architecture}`,
    `CPU: ${env.cpuModel ?? "미확인"} · 논리 CPU ${env.logicalCpus} · 시스템 메모리 ${env.systemMemoryBytes} bytes`,
    `조건 메모: ${report.options.label ?? "미입력"}`,
    `시나리오: ${scenario.id} · seed ${report.options.seed} · 각 ${report.options.seconds}초 · ${report.options.repeats}회`,
    `사례 기록: ${report.cases.length} / ${report.plannedCases} (중단·실패 사례 포함)`, "",
    "| 목표 체결/초 | 반복 | 상태 | 처리/예정 | 관측 처리/초 | 최대 대기 건수 | 완료 지연 p95 ms | Node 루프 p99 ms | 표본 최대 heap MiB | 정합성 |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...report.cases.map((item) => `| ${item.rate} | ${item.repetition} | ${item.status} | ${item.processedTrades}/${item.plannedTrades} | ${display(item.observedTradesPerSecond)} | ${item.maxPendingTrades} | ${display(item.scheduledCompletionLagMs?.p95)} | ${display(item.eventLoopDelayMs?.p99)} | ${display(item.memoryBytes.sampledMaxHeapUsed / 1024 / 1024)} | ${item.integrity.status} |`),
    "", "브라우저 commit·long task·사용자 입력 지연: **미측정**. 0으로 취급하지 않습니다.",
    `오류: ${report.failure ? escapeCell(report.failure) : "기록 없음"}`, "",
    "## 해석 범위", "", ...report.limitations.map((line) => `- ${line}`), "",
    "세부 CPU·메모리 표본·처리 잔량·버퍼 상한·대조 SHA-256은 report.json에 있습니다.", "",
  ].join("\n");
}
async function replace(path: string, content: string) {
  await writeFile(`${path}.tmp`, content, { encoding: "utf8", mode: 0o600 });
  await rename(`${path}.tmp`, path);
}
export async function saveReport(path: string, report: Report) {
  // JSON is canonical. Each file is replaced atomically; a forced exit can leave MD older.
  await replace(join(path, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await replace(join(path, "report.md"), markdown(report));
}
