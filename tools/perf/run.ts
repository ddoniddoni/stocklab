import { fileURLToPath } from "node:url";
import { parseOptions, help } from "./options.ts";
import { measure } from "./measure.ts";
import { scenario } from "./scenario.ts";
import { createOutput, environment, limitations, saveReport, type Report } from "./report.ts";

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--help") { console.log(help); return; }
  const options = parseOptions(args);
  if (Number(process.versions.node.split(".")[0]) !== 24) throw new Error("NODE_VERSION");
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const metadata = await environment(root);
  const path = await createOutput(root, options.runId);
  const report: Report = {
    schemaVersion: 1, runId: options.runId, status: "running", startedAt: new Date().toISOString(), finishedAt: null,
    options, environment: metadata, scenario, cases: [], plannedCases: options.rates.length * options.repeats, failure: null,
    browser: { measured: false, reactCommits: null, longTasks: null, inputLatencyMs: null }, limitations,
  };
  const controller = new AbortController();
  let signalExitCode = 130;
  const interrupt = () => { signalExitCode = 130; controller.abort(); };
  const terminate = () => { signalExitCode = 143; controller.abort(); };
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", terminate);
  try {
    await saveReport(path, report);
    console.log(`합성 엔진 측정: ${options.runId}. 브라우저 및 실제 한투 측정이 아닙니다.`);
    for (const rate of options.rates) {
      for (let repetition = 1; repetition <= options.repeats; repetition++) {
        controller.signal.throwIfAborted();
        console.log(`시작: ${rate} 체결/초, ${options.seconds}초, 반복 ${repetition}/${options.repeats}`);
        const result = await measure(options, rate, repetition, controller.signal);
        report.cases.push(result);
        await saveReport(path, report);
        console.log(`기록: ${result.status}, ${result.processedTrades}/${result.plannedTrades} 체결, 정합성 ${result.integrity.status}`);
        controller.signal.throwIfAborted();
        if (result.status !== "completed" || result.buffers.limitExceeded || result.integrity.status !== "matched")
          throw new Error("CASE_INCOMPLETE");
      }
    }
    report.status = "completed";
  } catch {
    report.status = controller.signal.aborted ? "cancelled" : "failed";
    report.failure = controller.signal.aborted ? "사용자 신호로 중단됨" : "측정·정합성·출력 중 오류 또는 처리 제한 시간 초과";
    process.exitCode = controller.signal.aborted ? signalExitCode : 1;
  } finally {
    report.finishedAt = new Date().toISOString();
    try {
      await saveReport(path, report);
      // Also honor a signal arriving while the final report was being written.
      if (controller.signal.aborted && report.status !== "cancelled") {
        report.status = "cancelled";
        report.failure = "사용자 신호로 중단됨";
        process.exitCode = signalExitCode;
        await saveReport(path, report);
      }
    }
    finally {
      process.removeListener("SIGINT", interrupt);
      process.removeListener("SIGTERM", terminate);
    }
  }
  console.log(`보고서: test-results/performance/${options.runId}/report.json, report.md · ${report.status}`);
  console.log("도구 실행 결과이며 앱 전체 검증이나 목표 성능 달성을 뜻하지 않습니다.");
}
await main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "";
  console.error(message === "INVALID_OPTIONS" ? "인자가 올바르지 않습니다. npm run test:perf -- --help를 참고하세요."
    : message === "NODE_VERSION" ? "프로젝트 .nvmrc에 맞는 Node 24에서 실행하세요."
      : "측정 도구를 완료하지 못했습니다. 실행 ID 중복, 출력 경로·쓰기 권한과 기존 부분 보고서를 확인하세요.");
  process.exitCode = 1;
});
