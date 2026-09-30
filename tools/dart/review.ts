import { fail, printError } from "./errors.ts";
import { argumentsMap, localEnvironment } from "./options.ts";
import { reviewedDataset, reviewTemplate } from "./review-model.ts";
import { json, parse, runIdSchema } from "./schema.ts";
import { digest, encode, lock, readBounded, runPath, writeExport, writeNew } from "./store.ts";
import { verifiedCandidate } from "./verified-run.ts";

async function main() {
  const args = argumentsMap(process.argv.slice(2), ["--run", "--prepare", "--export", "--help"], ["--prepare", "--export", "--help"]);
  if (args.has("--help")) {
    console.log("원문 대조 양식: data:review --run ID --prepare\n원문 대조 후 로컬 DTO 생성: data:review --run ID --export\n검토 파일: data/private/dart/runs/ID/review.json (원천 해시에 결합되며 네트워크를 호출하지 않습니다.)");
    return;
  }
  if (args.has("--prepare") === args.has("--export")) fail("INVALID_INPUT");
  const runId = parse(runIdSchema, args.get("--run"));
  await localEnvironment();
  const release = await lock();
  try {
    const { candidate, candidateHash } = await verifiedCandidate(runId);
    if (args.has("--prepare")) {
      await writeNew(runPath(runId, "review.json"), encode(reviewTemplate(candidate, runId, candidateHash)));
      console.log(`검토 양식: data/private/dart/runs/${runId}/review.json. 회사·기간·기준·금액을 원문과 대조한 뒤 작성하세요.`);
      return;
    }
    const reviewBytes = await readBounded(runPath(runId, "review.json"), 1024 * 1024);
    const dataset = reviewedDataset(candidate, json(reviewBytes), runId, candidateHash);
    const path = await writeExport(runId, digest(reviewBytes), dataset);
    console.log(`검토된 로컬 DTO: ${path}\n웹 앱의 데이터 모드 변경·공개 캐시 적재·배포는 수행하지 않았습니다.`);
  } finally { await release(); }
}
await main().catch(printError);
