import { getPublicConfig } from "@/server/config";
import { publicRoute, publicSuccess, queryParameters } from "@/server/public-api";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return publicRoute(async () => {
    queryParameters(request, []);
    return publicSuccess(getPublicConfig(), { source: "synthetic", fetchedAt: null, stale: false, warnings: [] });
  });
}
