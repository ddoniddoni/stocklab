import { z } from "zod";
const publicSchema = z.object({
  marketMode: z.enum(["synthetic", "kis-private"]).default("synthetic"),
  financialMode: z.enum(["fixture", "dart-cache"]).default("fixture"),
  persistenceMode: z.enum(["local", "supabase"]).default("local"),
  seed: z.string().trim().min(1).max(100).default("stocklab-v1"),
});
export type PublicConfig = z.infer<typeof publicSchema>;
export function parsePublicConfig(input: unknown, allowLocalMarket = false): PublicConfig {
  const result = publicSchema.safeParse(input);
  if (!result.success)
    throw new Error(
      "공개 환경 설정이 올바르지 않습니다. 모드와 seed를 확인하세요.",
    );
  const config = result.data;
  if (config.marketMode === "kis-private" && !allowLocalMarket)
    throw new Error("개인 시세는 허용된 로컬 개발 설정에서만 지원합니다.");
  if (config.persistenceMode !== "local") throw new Error("개인 저장은 local 모드만 지원합니다.");
  return config;
}
export function validateEnvironment(env: Record<string, string | undefined>) {
  const appEnv = z
    .enum(["local", "public"])
    .default("local")
    .safeParse(env.APP_ENV);
  if (!appEnv.success)
    throw new Error("APP_ENV는 local 또는 public이어야 합니다.");
  const publicHost = appEnv.data === "public" || env.VERCEL === "1" || Boolean(env.VERCEL_ENV);
  const entries = Object.entries(env).filter(([, value]) => Boolean(value?.trim()));
  if (entries.some(([key, value]) => key.startsWith("NEXT_PUBLIC_") &&
    (/(?:SECRET|SERVICE_ROLE|DART_API_KEY|KIS_APP_KEY|ACCESS_TOKEN)/.test(key) || value?.startsWith("sb_secret_"))))
    throw new Error("브라우저 공개 변수에 비밀정보를 설정할 수 없습니다.");
  if (publicHost) {
    if (env.NEXT_PUBLIC_MARKET_MODE === "kis-private")
      throw new Error("공개 환경에서는 개인 한투 시세를 실행할 수 없습니다.");
    if (entries.some(([key]) => /(?:^|_)(?:KIS|DART)(?:_|$)/.test(key) ||
      /SUPABASE_(?:SECRET|SERVICE_ROLE|ACCESS_TOKEN|DB_PASSWORD)/.test(key)))
      throw new Error(
        "공개 환경에는 외부 수집 키나 로컬 브리지 설정을 둘 수 없습니다.",
      );
  }
  if (env.NEXT_PUBLIC_MARKET_MODE === "kis-private" &&
    (publicHost || env.NODE_ENV !== "development" || env.APP_ENV !== "local" || env.KIS_LOCAL_ENABLED !== "1" ||
      env.KIS_BRIDGE_HTTP_URL !== "http://127.0.0.1:8787" || env.NEXT_PUBLIC_KIS_BRIDGE_WS_URL !== "ws://127.0.0.1:8787/ws" ||
      (env.KIS_BRIDGE_SHARED_SECRET?.length ?? 0) < 32 || env.KIS_APP_KEY?.trim() || env.KIS_APP_SECRET?.trim()))
    throw new Error("개인 시세는 dev:kis로 실행하세요. 한투 앱 키는 브리지 프로세스에만 설정합니다.");
  return parsePublicConfig({
    marketMode: env.NEXT_PUBLIC_MARKET_MODE,
    financialMode: env.NEXT_PUBLIC_FINANCIAL_MODE,
    persistenceMode: env.NEXT_PUBLIC_PERSISTENCE_MODE,
    seed: env.NEXT_PUBLIC_DEMO_SEED,
  }, env.NEXT_PUBLIC_MARKET_MODE === "kis-private");
}

export function publicCacheConnection(env: Record<string, string | undefined>) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url && !key) return null;
  // Fixed Supabase host only. No request parameter controls the origin or path.
  if (!url || !/^https:\/\/[a-z0-9]{20}\.supabase\.co\/?$/.test(url) ||
    !key || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key))
    throw new Error("공개 캐시에는 Supabase 프로젝트 URL과 publishable 키를 함께 설정하세요.");
  return { url: url.replace(/\/$/, ""), key };
}
