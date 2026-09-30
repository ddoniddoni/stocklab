import { createHistogram, monitorEventLoopDelay, performance, type Histogram } from "node:perf_hooks";
import { setTimeout } from "node:timers/promises";
import { audit, unchecked } from "./audit.ts";
import { scenario, Workload } from "./scenario.ts";
import type { Options, Rate } from "./options.ts";

function distribution(histogram: Histogram) {
  if (!histogram.count) return null;
  return { count: histogram.count, exceeds: histogram.exceeds, min: histogram.min / 1e6, mean: histogram.mean / 1e6,
    p50: histogram.percentile(50) / 1e6, p95: histogram.percentile(95) / 1e6, p99: histogram.percentile(99) / 1e6, max: histogram.max / 1e6 };
}
function memory(elapsedMs: number, processedTrades: number, pendingTrades: number) {
  return { elapsedMs, processedTrades, pendingTrades, ...process.memoryUsage() };
}
type Status = "completed" | "cancelled" | "deadline" | "failed";

export async function measure(options: Options, rate: Rate, repetition: number, signal: AbortSignal) {
  signal.throwIfAborted();
  const initialized = performance.now();
  const workload = new Workload(options.seed, rate);
  const initializationMs = performance.now() - initialized;
  const durationMs = options.seconds * 1000;
  const plannedTrades = rate * options.seconds;
  const dueAt = (elapsedMs: number) => Math.min(plannedTrades, Math.floor(Math.max(0, elapsedMs) * rate / 1000) + 1);
  const lag = createHistogram();
  const delay = monitorEventLoopDelay({ resolution: scenario.eventLoopResolutionMs });
  let status: Status = "completed";
  let maxPendingTrades = 0, processedWithinWindow = 0, batches = 0, batchWorkMs = 0, nextMemoryAt = 1000;
  const samples = [memory(0, 0, 1)];
  const cpuStart = process.cpuUsage();
  const utilizationStart = performance.eventLoopUtilization();
  const started = performance.now();
  delay.enable();
  try {
    while (true) {
      signal.throwIfAborted();
      const elapsed = performance.now() - started;
      if (elapsed >= durationMs + scenario.drainLimitMs) { status = "deadline"; break; }
      const due = dueAt(elapsed);
      maxPendingTrades = Math.max(maxPendingTrades, due - workload.processed);
      const endIndex = Math.min(due, workload.processed + scenario.maxBatchTrades);
      const batchStarted = performance.now();
      if (endIndex > workload.processed) batches++;
      while (workload.processed < endIndex) {
        const scheduledAt = workload.processed * 1000 / rate;
        workload.advance();
        const completedAt = performance.now() - started;
        lag.record(Math.max(1, Math.round((completedAt - scheduledAt) * 1e6)));
        if (completedAt <= durationMs) processedWithinWindow++;
        if (performance.now() - batchStarted >= scenario.batchBudgetMs) break;
      }
      batchWorkMs += performance.now() - batchStarted;
      const afterBatch = performance.now() - started;
      const pending = dueAt(afterBatch) - workload.processed;
      maxPendingTrades = Math.max(maxPendingTrades, pending);
      if (afterBatch >= nextMemoryAt) {
        samples.push(memory(afterBatch, workload.processed, pending));
        nextMemoryAt = afterBatch + scenario.memorySampleIntervalMs;
      }
      if (afterBatch >= durationMs + scenario.drainLimitMs) { status = "deadline"; break; }
      if (workload.processed === plannedTrades && afterBatch >= durationMs) break;
      // Debt is an index, not an unbounded event queue. Never skip overdue inputs.
      await setTimeout(pending > 0 ? 1 : scenario.schedulerIntervalMs, undefined, { signal });
    }
  } catch {
    status = signal.aborted ? "cancelled" : "failed";
  } finally {
    delay.disable();
  }
  const elapsedMs = performance.now() - started;
  const cpu = process.cpuUsage(cpuStart);
  const utilization = performance.eventLoopUtilization(utilizationStart);
  const pendingTrades = Math.max(0, dueAt(elapsedMs) - workload.processed);
  maxPendingTrades = Math.max(maxPendingTrades, pendingTrades);
  samples.push(memory(elapsedMs, workload.processed, pendingTrades));
  const result = {
    rate, repetition, status, initializationMs, elapsedMs, configuredWindowMs: durationMs,
    drainMs: Math.max(0, elapsedMs - durationMs), plannedTrades, processedTrades: workload.processed,
    processedWithinWindow, pendingTrades, notYetDueTrades: plannedTrades - dueAt(elapsedMs), maxPendingTrades,
    observedTradesPerSecond: workload.processed / (elapsedMs / 1000),
    derivedPayloads: { quotes: workload.processed, orderBooks: workload.processed },
    batches, batchWorkMs, cpuMs: { user: cpu.user / 1000, system: cpu.system / 1000 },
    eventLoopUtilization: utilization,
    eventLoopDelayMs: distribution(delay), scheduledCompletionLagMs: distribution(lag),
    memoryBytes: { start: samples[0]!, end: samples.at(-1)!,
      sampledMaxHeapUsed: Math.max(...samples.map((sample) => sample.heapUsed)),
      sampledMaxRss: Math.max(...samples.map((sample) => sample.rss)), samples },
    buffers: { maxTradeBuffer: workload.maxTradeBuffer, maxCandleBuffer: workload.maxCandleBuffer,
      limitExceeded: workload.bufferLimitExceeded },
    integrity: unchecked(workload.digest()),
  };
  // Replay/reference work is deliberately after the final measurement sample.
  if (status !== "cancelled" && status !== "failed") result.integrity = await audit(workload, options.seed, rate, signal);
  return result;
}
export type CaseResult = Awaited<ReturnType<typeof measure>>;
