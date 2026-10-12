import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import {
  defaultAIGlobalPolicy,
  aiModelIds,
  aiMaximumExposureNano,
  aiPricing,
  type AIModelId,
} from "../../src/parallax/ai-policy";
import { AI_CONTROL_ID } from "../../src/parallax/ai-ledger";
import { assistantInterpretationSchema, SpatialAssistantError } from "../../src/parallax/spatial-assistant";
import { requestSpatialAssistant } from "../../src/parallax/spatial-assistant-service";
import { canonicalChecksum } from "../../src/drydock/canonical";
import { spatialItemKind } from "../../src/parallax/library-service";
import { parseUSDNano } from "../../src/components/admiralty/ai-quota-format";
import {
  assistantEvaluationCorpus,
  CORPUS_VERSION,
  evaluationScene,
} from "../../tests/parallax/spatial-assistant-corpus-v1";
import { evaluateAssistantCase } from "../../tests/parallax/evaluate-assistant-case";
import { assistantSystemInstructions } from "../../src/parallax/openai-provider";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
let evaluationStage = "CASE_SELECTION";
let attemptedCalls = 0;
const argument = (name: string) => {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
};
async function main() {
  const ids = argument("--cases")?.split(",") ?? assistantEvaluationCorpus.map((item) => item.id);
  const cases = ids.map((id) => {
    const item = assistantEvaluationCorpus.find((candidate) => candidate.id === id);
    if (!item) throw new Error("Unknown corpus case identity.");
    return item;
  });
  if (new Set(ids).size !== ids.length) throw new Error("Corpus case identities must be unique.");
  evaluationStage = "MODEL_SELECTION";
  const models = (argument("--models")?.split(",") ?? ["gpt-6-luna"]) as AIModelId[];
  if (!models.length || models.some((model) => !aiModelIds.includes(model)) || new Set(models).size !== models.length)
    throw new Error("Choose supported unique model identities.");
  if (!args.includes("--live-authorized")) {
    const results = cases.map((item) => ({
      caseId: item.id,
      category: item.category,
      ...evaluateAssistantCase(item, evaluationScene(item), item.deterministicFixture),
    }));
    process.stdout.write(
      JSON.stringify(
        { corpusVersion: CORPUS_VERSION, mode: "DETERMINISTIC_CONTRACT", liveModelEvidence: false, calls: 0, results },
        null,
        2,
      ),
    );
    if (results.some((result) => !result.passed)) process.exitCode = 1;
    return;
  }
  // Explicit authorization plus explicit cost AND call ceilings, checked before
  // fixture setup or any network operation. No automatic retries or escalation.
  evaluationStage = "AUTHORIZED_LIMITS";
  const maxCalls = Number(argument("--max-calls")),
    budget = parseUSDNano(argument("--budget-usd") ?? "");
  if (
    !Number.isInteger(maxCalls) ||
    maxCalls < 1 ||
    maxCalls > 120 ||
    !Number.isSafeInteger(budget) ||
    budget <= 0 ||
    budget > 10000000000
  )
    throw new Error("Live mode requires --max-calls 1..120 and --budget-usd greater than zero and at most 10.");
  evaluationStage = "SERVER_CONFIGURATION";
  if (!process.env.OPENAI_API_KEY?.trim()) throw new Error("The server process has no configured OPENAI_API_KEY.");
  const maximumInputTokens = Number(argument("--maximum-input-tokens") ?? defaultAIGlobalPolicy.maximumInputTokens);
  const maximumOutputTokens = Number(argument("--maximum-output-tokens") ?? defaultAIGlobalPolicy.maximumOutputTokens);
  if (
    !Number.isInteger(maximumInputTokens) ||
    maximumInputTokens < 1000 ||
    maximumInputTokens > defaultAIGlobalPolicy.maximumInputTokens ||
    !Number.isInteger(maximumOutputTokens) ||
    maximumOutputTokens < 256 ||
    maximumOutputTokens > defaultAIGlobalPolicy.maximumOutputTokens
  )
    throw new Error("Evaluation token ceilings must fit within the existing default policy.");
  evaluationStage = "RESERVATION_CEILING";
  for (const model of models)
    if (aiMaximumExposureNano(aiPricing[model], maximumInputTokens, maximumOutputTokens) > BigInt(budget))
      throw new Error("The live budget cannot cover one conservative reservation for a selected model.");
  evaluationStage = "FIXTURE_DIRECTORY";
  const fixtureRoot = await mkdtemp(join(tmpdir(), "voyagewright-parallax-a1-live-"));
  const url = `file:${join(fixtureRoot, "evaluation.sqlite").replaceAll("\\", "/")}`;
  let store: PrismaClient | undefined;
  const records: Record<string, unknown>[] = [];
  try {
    evaluationStage = "DATABASE_PROVISION";
    const provision = spawnSync(
      process.execPath,
      [join(repository, "scripts/sounding-line/sqlite-bootstrap.mjs"), "--database-url", url],
      {
        cwd: repository,
        env: { ...process.env, DATABASE_URL: url, OPENAI_API_KEY: "" },
        encoding: "utf8",
        timeout: 60000,
        windowsHide: true,
      },
    );
    if (provision.status !== 0)
      throw new Error("Owned synthetic evaluation database could not be provisioned. Raw child output suppressed.");
    evaluationStage = "ACCOUNT_PROVISION";
    store = new PrismaClient({ datasources: { db: { url } } });
    const accountId = `synthetic-a1-evaluator-${randomUUID()}`;
    await store.userAccount.create({ data: { id: accountId, status: "ACTIVE" } });
    evaluationStage = "POLICY_PROVISION";
    await store.aIQuotaControl.create({
      data: {
        id: AI_CONTROL_ID,
        policy: JSON.stringify({
          ...defaultAIGlobalPolicy,
          enabled: true,
          maximumInputTokens,
          maximumOutputTokens,
          advancedEnabled: models.includes("gpt-6.1-sol"),
          monthlyRequests: maxCalls,
          defaultUserRequests: maxCalls,
          monthlySpendNano: budget,
          warningSpendNano: 0,
          userRequestsPerMinute: 100,
          globalRequestsPerMinute: 1000,
        }),
      },
    });
    if (models.includes("gpt-6.1-sol"))
      await store.aIQuotaUserPolicy.create({
        data: {
          accountId,
          policy: JSON.stringify({
            monthlyRequests: null,
            monthlySpendNano: null,
            advancedEnabled: true,
            requestsPerMinute: null,
            suspended: false,
            expiresAt: null,
          }),
        },
      });
    let attempts = 0,
      stop = false;
    for (const item of cases) {
      if (stop) break;
      for (const model of models) {
        if (attempts >= maxCalls || stop) break;
        evaluationStage = "DRAFT_PROVISION";
        const draft = evaluationScene(item);
        await store.reusableAuthoringItem.upsert({
          where: { id: draft.content.definitionId },
          create: {
            id: draft.content.definitionId,
            ownerAccountId: accountId,
            kind: spatialItemKind,
            name: "Synthetic evaluation draft",
          },
          update: { currentVersionNumber: 1 },
        });
        await store.reusableAuthoringItemVersion.upsert({
          where: { itemId_versionNumber: { itemId: draft.content.definitionId, versionNumber: 0 } },
          create: {
            itemId: draft.content.definitionId,
            versionNumber: 0,
            envelope: JSON.stringify(draft),
            checksum: canonicalChecksum(draft),
          },
          update: { envelope: JSON.stringify(draft), checksum: canonicalChecksum(draft) },
        });
        attempts++;
        attemptedCalls = attempts;
        evaluationStage = "BOUNDED_PROVIDER_REQUEST";
        const requestId = `synthetic-${randomUUID()}`;
        try {
          const reply = await requestSpatialAssistant(
            accountId,
            {
              draft,
              revision: 1,
              editorGeneration: 0,
              requestId,
              idempotencyKey: randomUUID(),
              request: item.request,
              selectedEntityId: item.selectedEntityId,
              mode: model === "gpt-6.1-sol" ? "ADVANCED" : "STANDARD",
            },
            { store },
          );
          const evaluation =
            "proposal" in reply
              ? evaluateAssistantCase(item, draft, assistantInterpretationSchema.strip().parse(reply.proposal))
              : { passed: false, findings: ["NO_VALID_PROPOSAL"] };
          records.push({
            caseId: item.id,
            category: item.category,
            model,
            ...evaluation,
            // This runner accepts only public synthetic corpus cases. Retain the
            // reviewed interpretation so semantic findings can be investigated.
            interpretation: "proposal" in reply ? assistantInterpretationSchema.strip().parse(reply.proposal) : null,
          });
          if ((reply as { accounting?: string }).accounting !== "SETTLED") stop = true;
        } catch (cause) {
          records.push({
            caseId: item.id,
            category: item.category,
            model,
            passed: false,
            findings: [cause instanceof SpatialAssistantError ? cause.code : "EVALUATION_FAILED"],
          });
          stop = true;
        }
      }
    }
    evaluationStage = "SAFE_REPORT";
    const ledger = await store.aIUsageLedger.findMany({
      select: {
        requestId: true,
        model: true,
        status: true,
        reservationNano: true,
        exposureNano: true,
        settledCostNano: true,
        inputTokens: true,
        outputTokens: true,
        failureCode: true,
        timings: true,
      },
    });
    const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: repository, encoding: "utf8", windowsHide: true });
    const dirty = spawnSync("git", ["status", "--porcelain"], { cwd: repository, encoding: "utf8", windowsHide: true });
    const report = {
      corpusVersion: CORPUS_VERSION,
      mode: "BOUNDED_LIVE_PROVIDER",
      candidateCommit: head.status === 0 ? head.stdout.trim() : null,
      uncommittedSource: Boolean(dirty.stdout.trim()),
      createdAt: new Date().toISOString(),
      maxCalls,
      budgetNano: budget,
      maximumInputTokens,
      maximumOutputTokens,
      instructionsDigest: canonicalChecksum(assistantSystemInstructions),
      attempts,
      stoppedEarly: stop,
      results: records,
      usage: ledger.map((row) => ({
        ...row,
        reservationNano: row.reservationNano.toString(),
        exposureNano: row.exposureNano.toString(),
        settledCostNano: row.settledCostNano?.toString() ?? null,
      })),
    };
    const evidenceDirectory = join(repository, "tmp/parallax-a1/evaluations");
    await mkdir(evidenceDirectory, { recursive: true });
    const output = join(evidenceDirectory, `live-${randomUUID()}.json`);
    await writeFile(output, JSON.stringify(report, null, 2));
    process.stdout.write(
      JSON.stringify({
        reportPath: output,
        corpusVersion: CORPUS_VERSION,
        attempts,
        maxCalls,
        budgetNano: budget,
        passed: records.filter((record) => record.passed).length,
        failed: records.filter((record) => !record.passed).length,
        stoppedEarly: stop,
      }),
    );
    if (stop || records.some((record) => !record.passed)) process.exitCode = 1;
  } finally {
    await store?.$disconnect();
    const taskRelative = relative(tmpdir(), fixtureRoot);
    if (
      isAbsolute(taskRelative) ||
      taskRelative.startsWith("..") ||
      !taskRelative.startsWith("voyagewright-parallax-a1-live-")
    )
      throw new Error("Unsafe evaluation cleanup target.");
    await rm(fixtureRoot, { recursive: true, force: true });
  }
}
main().catch(() => {
  // Only fixed lifecycle labels and counts are safe to print. Never emit raw
  // provider, database or environment errors, which may contain private data.
  process.stderr.write(JSON.stringify({ status: "EVALUATION_FAILED", stage: evaluationStage, attemptedCalls }) + "\n");
  process.exitCode = 1;
});
