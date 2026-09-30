import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { instruments } from "../../src/domain/instruments.ts";
import { fail } from "./errors.ts";
import { codes, parse, planSchema, runIdSchema, type Plan } from "./schema.ts";

export function argumentsMap(args: string[], allowed: readonly string[], flags: readonly string[] = []) {
  const values = new Map<string, string>();
  for (let i = 0; i < args.length; i++) {
    const name = args[i]!;
    if (!allowed.includes(name) || values.has(name)) fail("INVALID_INPUT");
    const value = flags.includes(name) ? "true" : args[++i];
    if (!value || value.startsWith("--")) fail("INVALID_INPUT");
    values.set(name, value);
  }
  return values;
}
export function numberOption(value: string | undefined, fallback: number, min: number, max: number) {
  if (value !== undefined && !/^\d+$/.test(value)) fail("INVALID_INPUT");
  const number = Number(value ?? fallback);
  if (!Number.isSafeInteger(number) || number < min || number > max) fail("INVALID_INPUT");
  return number;
}
export function syncOptions(args: string[]) {
  const values = argumentsMap(args,
    ["--symbol", "--year", "--basis", "--reports", "--until", "--run", "--resume", "--dry-run", "--max-requests", "--timeout-ms", "--help"],
    ["--resume", "--dry-run", "--help"]);
  const today = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const plan = parse(planSchema, {
    symbol: values.get("--symbol") ?? "005930",
    year: numberOption(values.get("--year"), new Date().getUTCFullYear() - 1, 2015, new Date().getUTCFullYear()),
    basis: values.get("--basis") ?? "CFS",
    reports: (values.get("--reports") ?? "11014,11011").split(","),
    until: values.get("--until") ?? today,
  });
  validatePlan(plan);
  plan.reports.sort((a, b) => codes.indexOf(a) - codes.indexOf(b));
  const resume = values.has("--resume");
  if (resume && !values.has("--run")) fail("INVALID_INPUT");
  const runId = parse(runIdSchema, values.get("--run") ?? `dart-${Date.now()}`);
  return {
    plan, runId, resume, dryRun: values.has("--dry-run"), help: values.has("--help"),
    // Resume uses its saved plan; supplied plan flags must not silently override it.
    hasPlanArguments: ["--symbol", "--year", "--basis", "--reports", "--until"].some((key) => values.has(key)),
    hasBudgetArgument: values.has("--max-requests"),
    maxRequests: numberOption(values.get("--max-requests"), 1000, 1, 1000),
    timeoutMs: numberOption(values.get("--timeout-ms"), 15000, 1000, 60000),
  };
}

export function validatePlan(plan: Plan) {
  const today = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  if (!instruments.some((item) => item.symbol === plan.symbol) || plan.until > today ||
    plan.until < `${plan.year}0101` || plan.year > new Date().getUTCFullYear() ||
    new Set(plan.reports).size !== plan.reports.length) fail("INVALID_INPUT");
}

export async function localEnvironment() {
  let file: Record<string, string> = {};
  try { file = parseEnv(await readFile(".env.local", "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") fail("IO"); }
  const env = { ...file, ...process.env };
  // Check both sources so a local file cannot hide the host's public environment.
  if ([file, process.env].some((source) =>
    (source.APP_ENV !== undefined && source.APP_ENV !== "local") ||
    source.VERCEL === "1" || source.CI === "true" || source.CI === "1")) fail("FORBIDDEN");
  if ((env.APP_ENV ?? "local") !== "local") fail("FORBIDDEN");
  return env;
}

export function filingWindows(plan: Plan) {
  const windows: { from: string; to: string }[] = [];
  for (let year = plan.year; year <= Number(plan.until.slice(0, 4)); year++) {
    for (let quarter = 0; quarter < 4; quarter++) {
      const from = `${year}${String(quarter * 3 + 1).padStart(2, "0")}01`;
      const to = `${year}${["0331", "0630", "0930", "1231"][quarter]}`;
      if (from > plan.until) break;
      windows.push({ from, to: to < plan.until ? to : plan.until });
    }
  }
  return windows;
}
