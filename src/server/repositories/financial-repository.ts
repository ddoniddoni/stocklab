import "server-only";
import { getPublicConfig } from "@/server/config";
import { fixtureFinancialRepository, financialYears } from "./fixture-financial-repository";
import { publishedFinancialRepository } from "./published-financial-repository";
import { getSourceManifest } from "./published-dataset-repository";

export function getFinancialRepository() {
  return getPublicConfig().financialMode === "fixture" ? fixtureFinancialRepository : publishedFinancialRepository;
}
export async function getFinancialYears() {
  if (getPublicConfig().financialMode === "fixture") return [...financialYears];
  try {
    const years = [...new Set((await getSourceManifest()).financials.datasets.map((entry) => entry.year))].sort((a, b) => b - a);
    return years.length ? years : [new Date().getUTCFullYear() - 1];
  } catch { return [new Date().getUTCFullYear() - 1]; }
}
