import { resolve } from "node:path";
import { MAX_DATASET_BYTES, publishedDatasetSchema, sourceManifestSchema } from "../../src/domain/financials/published.ts";
import { canonicalJson, contentHash, readSourceManifest } from "../../src/lib/published-files.ts";
import { argumentsMap, localEnvironment } from "./options.ts";
import { fail, printError } from "./errors.ts";
import { parse, runIdSchema } from "./schema.ts";
import { atomicWrite, lock, writeNew } from "./store.ts";
import { verifiedReview } from "./verified-run.ts";

async function main() {
  const args = argumentsMap(process.argv.slice(2), ["--run", "--confirm-public", "--help"], ["--confirm-public", "--help"]);
  if (args.has("--help")) {
    console.log("data:publish --run ID --confirm-public\n원천·원문 대조 기록을 다시 확인하고 공개용 로컬 JSON/manifest만 만듭니다. DB 적재·Git·배포는 하지 않습니다.\n--confirm-public은 공개 DTO의 출처·정확성·재이용 조건 및 비밀정보/개인정보 부재를 직접 검토했다는 확인입니다.");
    return;
  }
  if (!args.has("--confirm-public")) fail("REVIEW_REQUIRED");
  const runId = parse(runIdSchema, args.get("--run"));
  await localEnvironment();
  const release = await lock();
  try {
    const { dataset: reviewed, reviewHash } = await verifiedReview(runId);
    const manifest = await readSourceManifest();
    const first = reviewed.reports[0];
    if (!first || reviewed.reports.some((report) => report.fiscalYear !== first.fiscalYear || report.basis !== first.basis)) fail("INTEGRITY");
    const id = `dart-${contentHash({ candidateHash: reviewed.candidateHash, reviewHash })}`;
    if (manifest.financials.datasets.some((entry) => entry.id === id)) fail("INVALID_INPUT");
    const previous = manifest.financials.datasets.filter((entry) => entry.symbol === reviewed.company.symbol && entry.year === first.fiscalYear && entry.basis === first.basis);
    const artifacts = [reviewed.sourceArtifacts.index, reviewed.sourceArtifacts.company, ...reviewed.sourceArtifacts.filings,
      ...reviewed.reports.map((report) => ({ hash: report.payloadHash, fetchedAt: report.fetchedAt }))];
    const data = publishedDatasetSchema.parse({
      schemaVersion: 1, id, source: "opendart", publicationStatus: "published",
      revision: Math.max(0, ...previous.map((entry) => entry.revision)) + 1,
      year: first.fiscalYear, basis: first.basis, currency: "KRW",
      company: { symbol: reviewed.company.symbol, corpCode: reviewed.company.corpCode, name: reviewed.company.name, fiscalMonth: reviewed.company.fiscalMonth },
      fetchedAt: artifacts.map((artifact) => artifact.fetchedAt).sort()[0], reviewedAt: reviewed.review.reviewedAt,
      publishedAt: new Date().toISOString(), mapperVersion: reviewed.mapperVersion,
      provenance: { candidateHash: reviewed.candidateHash, reviewHash, sourceHashes: [...new Set(artifacts.map((artifact) => artifact.hash))].sort() },
      reports: reviewed.reports.map((report) => {
        const filing = reviewed.filings.find((item) => item.receiptNumber === report.receiptNumber);
        if (!filing) fail("INTEGRITY");
        return { title: report.title, reportCode: report.reportCode, receiptNumber: report.receiptNumber,
          originalUrl: report.originalUrl, filedDate: `${filing.filedDate.slice(0, 4)}-${filing.filedDate.slice(4, 6)}-${filing.filedDate.slice(6)}`,
          payloadHash: report.payloadHash, fetchedAt: report.fetchedAt, accountingStandard: report.accountingStandard,
          restatementKey: report.restatementKey, periodStart: report.periodStart, periodEnd: report.periodEnd,
          metrics: report.metrics.map((metric) => ({ metric: metric.metric, value: metric.value, ytdValue: metric.ytdValue,
            periodKind: metric.periodKind, periodStart: metric.periodStart, periodEnd: metric.periodEnd, profitScope: metric.profitScope,
            quality: metric.quality, reason: metric.reason,
            evidence: metric.evidence ? { rowKey: metric.evidence.rowKey, statement: metric.evidence.statement,
              accountId: metric.evidence.accountId, accountName: metric.evidence.accountName, accountDetail: metric.evidence.accountDetail,
              rawAmount: metric.evidence.rawAmount, rawYtdAmount: metric.evidence.rawYtdAmount } : null })) };
      }),
    });
    const serialized = canonicalJson(data);
    if (Buffer.byteLength(serialized) > MAX_DATASET_BYTES) fail("TOO_LARGE");
    const entry = { id: data.id, sha256: contentHash(data), symbol: data.company.symbol, corpCode: data.company.corpCode,
      year: data.year, basis: data.basis, revision: data.revision };
    const next = sourceManifestSchema.parse({ ...manifest, financials: { source: "opendart", datasets: [...manifest.financials.datasets, entry] } });
    // File first, catalog last: interruption cannot reference a half-written file.
    // Existing revisions are preserved; no privileged database key is used here.
    await writeNew(resolve("data/published", `${id}.json`), serialized);
    await atomicWrite(resolve("data/published/manifest.json"), next);
    console.log(`공개용 로컬 스냅샷 준비: data/published/${id}.json\n원본/검토자 이름은 제외했습니다. Git 반영·DB 적재·배포는 별도 작업입니다.`);
  } finally { await release(); }
}
await main().catch(printError);
