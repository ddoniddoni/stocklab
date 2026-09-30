import { randomUUID } from "node:crypto";

export const rates = [100, 500, 1000] as const;
export type Rate = (typeof rates)[number];
export type Options = {
  rates: Rate[];
  seconds: number;
  repeats: number;
  seed: string;
  runId: string;
  label: string | null;
};
export const help = `test:perf [--rates 100,500,1000] [--seconds 60] [--repeats 1]
  [--seed stocklab-perf-v1] [--run ID] [--label LABEL]

Node 24 전용 합성 엔진 측정. 입력 단위는 5종목 전체의 체결/초입니다.
seconds: 1~1800, repeats: 1~5, 전체 예정 시간은 최대 1800초.
seed/run: 영문·숫자·하이픈·밑줄 1~64자. label: 같은 장비/조건을 식별할 짧은 메모.
보고서: test-results/performance/<ID>/report.json 및 report.md (Git 제외).
같은 ID는 덮어쓰지 않습니다. Ctrl+C는 부분 보고서 저장 후 종료합니다.
브라우저/React/실제 한투 성능은 측정하지 않습니다. 키와 환경파일을 읽지 않습니다.`;

function integer(value: string | undefined, fallback: number, max: number) {
  if (value !== undefined && !/^\d+$/.test(value)) throw new Error("INVALID_OPTIONS");
  const parsed = Number(value ?? fallback);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) throw new Error("INVALID_OPTIONS");
  return parsed;
}
export function parseOptions(args: string[]): Options {
  const values = new Map<string, string>();
  const allowed = ["--rates", "--seconds", "--repeats", "--seed", "--run", "--label"];
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]!, value = args[i + 1];
    if (!allowed.includes(key) || values.has(key) || !value || value.startsWith("--")) throw new Error("INVALID_OPTIONS");
    values.set(key, value);
  }
  const selected = (values.get("--rates") ?? "100,500,1000").split(",");
  if (selected.some((value) => !["100", "500", "1000"].includes(value)) || new Set(selected).size !== selected.length)
    throw new Error("INVALID_OPTIONS");
  const seconds = integer(values.get("--seconds"), 60, 1800);
  const repeats = integer(values.get("--repeats"), 1, 5);
  if (seconds * repeats * selected.length > 1800) throw new Error("INVALID_OPTIONS");
  const seed = values.get("--seed") ?? "stocklab-perf-v1";
  const runId = values.get("--run") ?? `perf-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const label = values.get("--label") ?? null;
  if (![seed, runId].every((value) => /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value)) ||
    (label !== null && (label.length > 100 || /[\p{Cc}\p{Cf}|<>`]/u.test(label)))) throw new Error("INVALID_OPTIONS");
  return { rates: selected.map(Number) as Rate[], seconds, repeats, seed, runId, label };
}
