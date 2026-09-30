import type { NextConfig } from "next";
import { publicCacheConnection, validateEnvironment } from "./src/lib/config";
const modes = validateEnvironment(process.env);
if (modes.financialMode === "dart-cache") publicCacheConnection(process.env);
const config: NextConfig = {
  agentRules: false,
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingIncludes: { "/*": ["./data/published/*.json"] },
  outputFileTracingExcludes: { "/*": ["./data/raw/**/*", "./data/private/**/*", "./tools/dart/**/*", "./tools/kis-bridge/**/*", "./tools/perf/**/*", "./test-results/**/*", "./.env*", "./supabase/**/*"] },
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "X-Content-Type-Options", value: "nosniff" }] }];
  },
};
export default config;
