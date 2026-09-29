import type { NextConfig } from "next";
import { validateEnvironment } from "./src/lib/config";
validateEnvironment(process.env);
const config: NextConfig = {
  agentRules: false,
  reactStrictMode: true,
  poweredByHeader: false,
};
export default config;
