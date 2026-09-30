import { businessStatus } from "./client.ts";
import { collect, type ReadTask } from "./collect.ts";
import { fail } from "./errors.ts";
import { reviewedDataset } from "./review-model.ts";
import { json } from "./schema.ts";
import { digest, encode, loadState, readBounded, readRaw, runPath } from "./store.ts";

// Rebuild from hashed local source bytes. This adapter never makes an HTTP call.
export async function verifiedCandidate(runId: string) {
  const state = await loadState(runId);
  if (state.status !== "complete" || !state.candidateHash) fail("REVIEW_REQUIRED");
  const task: ReadTask = async (name, endpoint, _parameters, decode) => {
    const artifact = state.tasks[name];
    if (!artifact) fail("INTEGRITY");
    const bytes = await readRaw(artifact.hash);
    const empty = endpoint.endsWith(".json") && businessStatus(json(bytes)) === "013";
    if (empty !== artifact.empty) fail("INTEGRITY");
    return { artifact, data: decode(bytes, empty) };
  };
  const candidate = await collect(state.plan, task);
  const saved = await readBounded(runPath(runId, "candidate.json"));
  if (digest(encode(candidate)) !== state.candidateHash || digest(saved) !== state.candidateHash) fail("INTEGRITY");
  return { candidate, candidateHash: state.candidateHash };
}
export async function verifiedReview(runId: string) {
  const { candidate, candidateHash } = await verifiedCandidate(runId);
  const bytes = await readBounded(runPath(runId, "review.json"), 1024 * 1024);
  return { dataset: reviewedDataset(candidate, json(bytes), runId, candidateHash), reviewHash: digest(bytes) };
}
