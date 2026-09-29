import { describe, expect, it } from "vitest";
import { parsePublicConfig, validateEnvironment } from "@/lib/config";
describe("environment boundary", () => {
  it("runs with no keys and returns only a public DTO", () => {
    expect(validateEnvironment({})).toEqual({
      marketMode: "synthetic",
      financialMode: "fixture",
      persistenceMode: "local",
      seed: "stocklab-v1",
    });
    expect(
      JSON.stringify(validateEnvironment({ SOME_SECRET: "never-return-me" })),
    ).not.toContain("never-return-me");
  });
  it.each([
    "NEXT_PUBLIC_MARKET_MODE",
    "NEXT_PUBLIC_FINANCIAL_MODE",
    "NEXT_PUBLIC_PERSISTENCE_MODE",
    "APP_ENV",
  ])("rejects invalid %s", (key) => {
    expect(() => validateEnvironment({ [key]: "invalid-value" })).toThrow();
  });
  it.each([
    { NEXT_PUBLIC_MARKET_MODE: "kis-private" },
    { NEXT_PUBLIC_FINANCIAL_MODE: "dart-cache" },
    { NEXT_PUBLIC_PERSISTENCE_MODE: "supabase" },
  ])("rejects unimplemented modes %j", (env) => {
    expect(() => validateEnvironment(env)).toThrow("P0/P1-A");
  });
  it.each([
    "KIS_APP_KEY",
    "KIS_APP_SECRET",
    "KIS_BRIDGE_SHARED_SECRET",
    "KIS_BRIDGE_HTTP_URL",
    "NEXT_PUBLIC_KIS_BRIDGE_WS_URL",
    "DART_API_KEY",
    "SUPABASE_SECRET_KEY",
  ])("blocks public %s without exposing its value", (key) => {
    for (const publicEnv of [
      { APP_ENV: "public" },
      { VERCEL: "1", APP_ENV: "local" },
    ]) {
      expect(() =>
        validateEnvironment({ ...publicEnv, [key]: "test-only-secret" }),
      ).toThrow("공개 환경");
      try {
        validateEnvironment({ ...publicEnv, [key]: "test-only-secret" });
      } catch (error) {
        expect(String(error)).not.toContain("test-only-secret");
      }
    }
  });
  it("validates client modes and seed", () => {
    expect(() => parsePublicConfig({ marketMode: "kis-private" })).toThrow();
    expect(() => parsePublicConfig({ seed: "" })).toThrow();
    expect(() => parsePublicConfig({ seed: "x".repeat(101) })).toThrow();
  });
});
