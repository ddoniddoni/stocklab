import { z } from "zod";
const publicSchema = z.object({
  marketMode: z.enum(["synthetic", "kis-private"]).default("synthetic"),
  financialMode: z.enum(["fixture", "dart-cache"]).default("fixture"),
  persistenceMode: z.enum(["local", "supabase"]).default("local"),
  seed: z.string().trim().min(1).max(100).default("stocklab-v1"),
});
export type PublicConfig = z.infer<typeof publicSchema>;
export function parsePublicConfig(input: unknown): PublicConfig {
  const result = publicSchema.safeParse(input);
  if (!result.success)
    throw new Error(
      "공개 환경 설정이 올바르지 않습니다. 모드와 seed를 확인하세요.",
    );
  const config = result.data;
  if (
    config.marketMode !== "synthetic" ||
    config.financialMode !== "fixture" ||
    config.persistenceMode !== "local"
  ) {
    throw new Error(
      "P0/P1-A에서는 synthetic / fixture / local 모드만 지원합니다.",
    );
  }
  return config;
}
export function validateEnvironment(env: Record<string, string | undefined>) {
  const appEnv = z
    .enum(["local", "public"])
    .default("local")
    .safeParse(env.APP_ENV);
  if (!appEnv.success)
    throw new Error("APP_ENV는 local 또는 public이어야 합니다.");
  if (appEnv.data === "public" || env.VERCEL === "1") {
    const forbidden = [
      "KIS_APP_KEY",
      "KIS_APP_SECRET",
      "KIS_BRIDGE_SHARED_SECRET",
      "KIS_BRIDGE_HTTP_URL",
      "NEXT_PUBLIC_KIS_BRIDGE_WS_URL",
      "DART_API_KEY",
      "SUPABASE_SECRET_KEY",
    ];
    if (forbidden.some((key) => Boolean(env[key]?.trim())))
      throw new Error(
        "공개 환경에는 외부 수집 키나 로컬 브리지 설정을 둘 수 없습니다.",
      );
  }
  return parsePublicConfig({
    marketMode: env.NEXT_PUBLIC_MARKET_MODE,
    financialMode: env.NEXT_PUBLIC_FINANCIAL_MODE,
    persistenceMode: env.NEXT_PUBLIC_PERSISTENCE_MODE,
    seed: env.NEXT_PUBLIC_DEMO_SEED,
  });
}
