import "server-only";
import { validateEnvironment } from "@/lib/config";
// Only this explicit allowlisted DTO crosses the server/client boundary.
export function getPublicConfig() {
  return validateEnvironment(process.env);
}
