import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { z } from "zod";
import { localOrigins } from "../../src/domain/local-market.ts";

export async function readBridgeConfig() {
  // This file is read only by the bridge child, never by Next or the launcher.
  let file: Record<string, string> = {};
  try { file = parseEnv(await readFile(new URL(".env.local", import.meta.url), "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const env = { ...file, ...process.env };
  if (env.VERCEL || env.VERCEL_ENV || env.APP_ENV !== "local") throw new Error("local only");
  return z.object({
    APP_ENV: z.literal("local"), KIS_ENV: z.literal("real"),
    KIS_APP_KEY: z.string().trim().min(10), KIS_APP_SECRET: z.string().trim().min(10),
    KIS_BRIDGE_SHARED_SECRET: z.string().min(32).max(200),
    KIS_REST_RPS: z.coerce.number().int().min(1).max(2).default(2),
    KIS_MAX_SUBSCRIPTIONS: z.coerce.number().int().min(1).max(10).default(10),
    BRIDGE_HOST: z.literal("127.0.0.1").default("127.0.0.1"),
    BRIDGE_PORT: z.coerce.number().refine((n) => n === 8787).default(8787),
    BRIDGE_ALLOWED_ORIGINS: z.literal(localOrigins.join(",")).default(localOrigins.join(",")),
  }).parse(env);
}
export type BridgeConfig = Awaited<ReturnType<typeof readBridgeConfig>>;
