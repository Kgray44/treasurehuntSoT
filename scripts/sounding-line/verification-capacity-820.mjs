// A finite execution allowance, never release or evidence-reuse authority.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { appendFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planProductExperience } from "./product-experience.mjs";
import {
  verifySourceJoin820,
  SOURCE_JOIN_TREE_BYTES,
  HOMEPORT_820_REVIEW,
  HOMEPORT_820_PUBLICATION,
} from "./verification-source-join-820.mjs";

export const CAPACITY_820 = Object.freeze({
  version: 2,
  repository: "Kgray44/treasurehuntSoT",
  repositoryId: 1303074266,
  ownerId: 64373011,
  pr: 820,
  originalBase: "b20199feee2a82129f1527a9c0099eca5c98be5a",
  originalCandidate: "5fce13d00211d45116cc93ae143f24889834380c",
  originalSourceDigest: "2c00cb867fe526182ef1413a7feba606db671756786862b8fd845253266f273e",
  notBefore: "2026-11-01T18:00:00Z",
  expiresAt: "2026-11-03T12:00:00Z",
  minutes: 65,
  attempt: 1,
});
const need = (value) => {
  if (!value) throw new Error("SOUNDING_LINE_VERIFICATION_CAPACITY_BINDING_INVALID");
};
const oid = (value) => /^[a-f0-9]{40}$/u.test(value ?? "");
export function capacity820Grant({
  baseSha,
  candidateSha,
  candidateTree,
  runId,
  attempt,
  sourceDigest,
  sourceJoinDigest,
  createdAt,
  now,
}) {
  const start = Date.parse(CAPACITY_820.notBefore),
    end = Date.parse(CAPACITY_820.expiresAt);
  need(oid(baseSha) && oid(candidateSha) && oid(candidateTree));
  need(/^[1-9]\d*$/u.test(runId ?? "") && String(attempt) === "1");
  need(/^[a-f0-9]{64}$/u.test(sourceDigest ?? "") && /^[a-f0-9]{64}$/u.test(sourceJoinDigest ?? ""));
  need(Number.isSafeInteger(now) && now >= start && now + CAPACITY_820.minutes * 60000 <= end);
  need(Number.isFinite(Date.parse(createdAt)) && Date.parse(createdAt) >= start && Date.parse(createdAt) <= now);
  return Object.freeze({
    ...CAPACITY_820,
    baseSha,
    candidateSha,
    candidateTree,
    runId,
    sourceDigest,
    sourceJoinDigest,
    qualification: false,
  });
}
export function encodeCapacity820Grant(grant) {
  const json = JSON.stringify(grant);
  need(Buffer.byteLength(json) <= 4096);
  return { json, id: createHash("sha256").update(json).digest("hex") };
}
export function requireCapacity820Grant(expected, env) {
  const encoded = encodeCapacity820Grant(expected);
  need(env.SOUNDING_LINE_VERIFICATION_CAPACITY_GRANT === encoded.json);
  need(env.SOUNDING_LINE_VERIFICATION_CAPACITY_ID === encoded.id);
  need(env.SOUNDING_LINE_VERIFICATION_JOB_MINUTES === "65");
  return expected;
}

async function providerJson(endpoint, env) {
  const response = await fetch(`https://api.github.com/repos/${CAPACITY_820.repository}/${endpoint}`, {
    headers: {
      Authorization: `Bearer ${env.GH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Cache-Control": "no-cache",
    },
    signal: AbortSignal.timeout(5000),
    redirect: "error",
  });
  if (response.status !== 200) {
    await response.body?.cancel();
    need(false);
  }
  let size = 0;
  const chunks = [];
  try {
    for await (const chunk of response.body) {
      size += chunk.length;
      need(size <= 2 * 1024 * 1024);
      chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    await response.body?.cancel().catch(() => {});
    need(false);
  }
}

export function validateCapacity820Provider({ pull, run, main, env, baseSha, candidateSha }) {
  need(pull.number === 820 && pull.state === "open" && pull.merged === false && pull.draft === false);
  need(pull.user?.id === CAPACITY_820.ownerId && pull.user?.login === "Kgray44");
  for (const side of [pull.base, pull.head]) {
    need(side?.repo?.id === CAPACITY_820.repositoryId && side.repo.full_name === CAPACITY_820.repository);
    need(side.repo.owner?.id === CAPACITY_820.ownerId);
  }
  need(pull.base.sha === baseSha && pull.head.sha === candidateSha && main.object?.sha === baseSha);
  need(String(run.id) === env.GITHUB_RUN_ID && run.run_attempt === 1 && run.event === env.GITHUB_EVENT_NAME);
  need(run.repository?.id === CAPACITY_820.repositoryId && run.actor?.id === CAPACITY_820.ownerId);
  need(run.path === ".github/workflows/sounding-line-ordinary.yml");
}

export async function installedCapacity820Grant({ root, baseSha, candidateSha, env = process.env }) {
  need(env.GITHUB_ACTIONS === "true" && env.GITHUB_REPOSITORY === CAPACITY_820.repository);
  need(env.GITHUB_REF === "refs/heads/main" && env.GITHUB_SHA === baseSha && env.GITHUB_WORKFLOW_SHA === baseSha);
  need(
    env.GITHUB_WORKFLOW_REF ===
      `${CAPACITY_820.repository}/.github/workflows/sounding-line-ordinary.yml@refs/heads/main`,
  );
  need(["campaign-custody", "final-check"].includes(env.GITHUB_JOB));
  need(["pull_request_target", "workflow_dispatch"].includes(env.GITHUB_EVENT_NAME));
  need(env.SOUNDING_LINE_PR_NUMBER === "820" && env.GITHUB_RUN_ATTEMPT === "1" && Boolean(env.GH_TOKEN));
  need(oid(baseSha) && oid(candidateSha) && /^[1-9]\d*$/u.test(env.GITHUB_RUN_ID ?? ""));
  const [pull, run, main] = await Promise.all([
    providerJson("pulls/820", env),
    providerJson(`actions/runs/${env.GITHUB_RUN_ID}/attempts/1`, env),
    providerJson("git/ref/heads/main", env),
  ]);
  validateCapacity820Provider({ pull, run, main, env, baseSha, candidateSha });
  const git = (args, raw = false) =>
    execFileSync("git", ["-c", "gc.auto=0", "-c", "maintenance.auto=false", ...args], {
      cwd: root,
      encoding: raw ? null : "utf8",
      timeout: 30000,
      maxBuffer: SOURCE_JOIN_TREE_BYTES,
      env: { ...env, GIT_NO_LAZY_FETCH: "1", GIT_NO_REPLACE_OBJECTS: "1", GIT_TERMINAL_PROMPT: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
  const text = (args) => git(args).trim();
  need(text(["rev-parse", "HEAD"]) === candidateSha);
  git(["merge-base", "--is-ancestor", CAPACITY_820.originalBase, baseSha]);
  git(["merge-base", "--is-ancestor", baseSha, candidateSha]);
  git(["merge-base", "--is-ancestor", CAPACITY_820.originalCandidate, candidateSha]);
  const candidateTree = text(["rev-parse", `${candidateSha}^{tree}`]);
  const registry = JSON.parse(text(["show", `${baseSha}:testing/contracts.json`]));
  need(registry.experiencePolicy?.journeyMigration?.reviewPath === HOMEPORT_820_REVIEW);
  need(registry.experiencePolicy?.journeyMigration?.publicationRoot === HOMEPORT_820_PUBLICATION);
  const tree = (revision) => git(["ls-tree", "-rz", "--full-tree", revision], true);
  const sourceJoin = verifySourceJoin820({
    originalBase: tree(CAPACITY_820.originalBase),
    originalCandidate: tree(CAPACITY_820.originalCandidate),
    currentBase: tree(baseSha),
    candidate: tree(candidateSha),
  });
  const changedPaths = git(["diff", "--name-only", "--no-renames", "-z", baseSha, candidateSha, "--"])
    .split("\0")
    .filter(Boolean);
  const plan = planProductExperience({ root, baseSha, candidateSha, changedPaths, prNumber: 820 });
  need(plan.baseSha === baseSha && plan.candidateSha === candidateSha);
  return capacity820Grant({
    baseSha,
    candidateSha,
    candidateTree,
    runId: env.GITHUB_RUN_ID,
    attempt: env.GITHUB_RUN_ATTEMPT,
    sourceDigest: plan.sourceDigest,
    sourceJoinDigest: sourceJoin.digest,
    createdAt: run.created_at,
    now: Date.now(),
  });
}

export async function verificationCapacity820({ root, baseSha, candidateSha, env = process.env }) {
  if (env.SOUNDING_LINE_PR_NUMBER !== "820") {
    need(
      !env.SOUNDING_LINE_VERIFICATION_CAPACITY_GRANT &&
        !env.SOUNDING_LINE_VERIFICATION_CAPACITY_ID &&
        !env.SOUNDING_LINE_VERIFICATION_JOB_MINUTES,
    );
    return null;
  }
  return requireCapacity820Grant(await installedCapacity820Grant({ root, baseSha, candidateSha, env }), env);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    need(args.length === 6 && args[0] === "--workspace" && args[2] === "--base" && args[4] === "--candidate");
    const grant = await installedCapacity820Grant({
      root: path.resolve(args[1]),
      baseSha: args[3],
      candidateSha: args[5],
    });
    const encoded = encodeCapacity820Grant(grant);
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `verification_job_minutes=65\nverification_capacity_grant=${encoded.json}\nverification_capacity_id=${encoded.id}\n`,
    );
  } catch {
    process.stderr.write("SOUNDING_LINE_VERIFICATION_CAPACITY_BINDING_INVALID\n");
    process.exitCode = 1;
  }
}
