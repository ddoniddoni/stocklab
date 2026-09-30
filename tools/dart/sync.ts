import { DartClient, businessStatus } from "./client.ts";
import { collect, type ReadTask } from "./collect.ts";
import { fail, printError, safeError } from "./errors.ts";
import { filingWindows, localEnvironment, syncOptions } from "./options.ts";
import { json, type State } from "./schema.ts";
import { atomicWrite, digest, encode, loadState, lock, readRaw, runPath, saveRaw, saveState, writeNew } from "./store.ts";

async function main() {
  const options = syncOptions(process.argv.slice(2));
  if (options.help) {
    console.log("data:sync [--symbol 005930] [--year 2025] [--basis CFS|OFS] [--reports 11014,11011] [--until YYYYMMDD] [--run ID] [--dry-run] [--max-requests 1000] [--timeout-ms 15000]\n재개: data:sync --run ID --resume [--dry-run] [--max-requests N]");
    return;
  }
  if (options.resume && options.hasPlanArguments) fail("INVALID_INPUT");
  const existing = options.resume ? await loadState(options.runId) : null;
  const plan = existing?.plan ?? options.plan;
  if (options.dryRun) {
    console.log(JSON.stringify({
      dryRun: true, runId: options.runId, plan, filingWindows: filingWindows(plan),
      requestBudget: options.hasBudgetArgument ? options.maxRequests : existing?.requestBudget ?? options.maxRequests,
      requestsAlreadyUsed: existing?.requests ?? 0,
      completedTasks: Object.keys(existing?.tasks ?? {}).length,
      minimumRequestsForNewRun: 2 + filingWindows(plan).length + plan.reports.length,
      note: "키·네트워크·파일 쓰기 없이 계획만 출력합니다. 추가 페이지와 재시도도 예산에 포함됩니다.",
    }, null, 2));
    return;
  }
  const env = await localEnvironment();
  const key = env.DART_API_KEY?.trim();
  if (!key || !/^[a-zA-Z0-9]{40}$/.test(key)) fail("NOT_CONFIGURED");
  const release = await lock();
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once("SIGINT", cancel);
  process.once("SIGTERM", cancel);
  let state: State | null = null;
  try {
    // Read again after locking, in case another process completed before us.
    const initial: State = options.resume ? await loadState(options.runId) : {
      schemaVersion: 1, runId: options.runId, plan, startedAt: new Date().toISOString(),
      status: "running", requests: 0, requestBudget: options.maxRequests, lastRequestAt: 0,
      tasks: {}, error: null, candidateHash: null,
    };
    if (!options.resume) await writeNew(runPath(initial.runId, "state.json"), encode(initial));
    state = initial;
    const current = state;
    if (options.hasBudgetArgument) current.requestBudget = options.maxRequests;
    current.status = "running";
    current.error = null;
    await saveState(current);
    const client = new DartClient({
      key, signal: controller.signal, timeoutMs: options.timeoutMs, lastRequestAt: current.lastRequestAt,
      beforeRequest: async () => {
        if (current.requests >= current.requestBudget) fail("BUDGET");
        current.requests++;
        current.lastRequestAt = Date.now();
        try { await saveState(current); } catch { fail("IO"); }
      },
    });
    const task: ReadTask = async (name, endpoint, params, decode) => {
      if (controller.signal.aborted) fail("CANCELLED");
      const previous = current.tasks[name];
      if (previous) {
        const bytes = await readRaw(previous.hash);
        const empty = endpoint.endsWith(".json") && businessStatus(json(bytes)) === "013";
        if (empty !== previous.empty) fail("INTEGRITY");
        return { artifact: previous, data: decode(bytes, empty) };
      }
      const result = await client.request(endpoint, params, decode);
      const artifact = { hash: await saveRaw(result.bytes), empty: result.empty, fetchedAt: result.fetchedAt };
      current.tasks[name] = artifact;
      await saveState(current);
      console.log(`저장: ${name} / 누적 요청 ${current.requests}/${current.requestBudget}`);
      return { artifact, data: result.data };
    };
    const candidate = await collect(current.plan, task);
    if (controller.signal.aborted) fail("CANCELLED");
    const candidateHash = digest(encode(candidate));
    if (current.candidateHash !== null && current.candidateHash !== candidateHash) fail("INTEGRITY");
    await atomicWrite(runPath(current.runId, "candidate.json"), candidate);
    current.candidateHash = candidateHash;
    current.status = "complete";
    await saveState(current);
    console.log(`수집 저장: ${current.runId} / 보고서 ${candidate.reports.length}개 / 미제공 ${candidate.unavailable.length}개. 원문 대조 전이며 공개되지 않았습니다.`);
  } catch (error) {
    if (state) {
      state.status = controller.signal.aborted ? "cancelled" : "failed";
      state.error = safeError(error).code;
      await saveState(state).catch(() => undefined);
    }
    throw error;
  } finally {
    process.removeListener("SIGINT", cancel);
    process.removeListener("SIGTERM", cancel);
    await release();
  }
}
await main().catch(printError);
