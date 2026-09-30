import { randomBytes } from "node:crypto";
import { fork, spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { bridgeHttp, bridgeWs } from "../../src/domain/local-market.ts";

// The launcher never reads the bridge's .env.local. Only that child gets KIS credentials.
if (process.env.VERCEL || process.env.VERCEL_ENV || process.env.APP_ENV === "public" || process.argv.length > 2) {
  console.error("dev:kis는 인자 없이 개인 로컬 환경에서만 실행하세요."); process.exitCode = 1;
} else {
  const secret = randomBytes(32).toString("hex");
  const base: NodeJS.ProcessEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/(?:^|_)(?:KIS|BRIDGE)(?:_|$)/.test(key)));
  const common = { ...base, APP_ENV: "local", KIS_BRIDGE_SHARED_SECRET: secret };
  const bridge = fork(fileURLToPath(new URL("server.ts", import.meta.url)), [], { env: common, stdio: ["inherit", "inherit", "inherit", "ipc"] });
  let next: ChildProcess | undefined; let stopping = false;
  const stop = (code = 0) => {
    if (stopping) return; stopping = true; process.exitCode = code;
    clearTimeout(startup); bridge.kill("SIGTERM"); next?.kill("SIGTERM");
  };
  const startup = setTimeout(() => { console.error("KIS 브리지가 준비되지 않았습니다."); stop(1); }, 15_000);
  bridge.once("message", (message) => {
    if (stopping || !message || typeof message !== "object" || !("type" in message) || message.type !== "ready") return;
    clearTimeout(startup);
    next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3000"], {
      stdio: "inherit", env: { ...common, KIS_APP_KEY: "", KIS_APP_SECRET: "", KIS_LOCAL_ENABLED: "1", NEXT_PUBLIC_MARKET_MODE: "kis-private", KIS_BRIDGE_HTTP_URL: bridgeHttp, NEXT_PUBLIC_KIS_BRIDGE_WS_URL: bridgeWs },
    });
    next.once("error", () => { console.error("Next 개발 서버를 시작하지 못했습니다."); stop(1); });
    next.once("exit", (code) => stop(code ?? 1));
  });
  bridge.once("error", () => { console.error("KIS 브리지를 시작하지 못했습니다."); stop(1); });
  bridge.once("exit", (code) => stop(code ?? 1));
  process.once("SIGINT", () => stop()); process.once("SIGTERM", () => stop());
}
