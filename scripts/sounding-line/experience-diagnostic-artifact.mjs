// Failed-run diagnostics only. Never imported by the success attestation loader.
import { execFileSync } from "node:child_process";
import {
  createDiagnosticArtifactIntake,
  intakeResponse,
  readBoundedArtifactMetadata,
} from "./experience-artifact-intake.mjs";
import { capacityBinding, EXPERIENCE_INTAKE_LIMITS } from "./experience-capacity.mjs";
import { experienceDigest } from "./product-experience.mjs";

const fail = (code) => {
  throw new Error(`LOCAL_DIAGNOSTIC_${code}`);
};
function snapshot(value) {
  const cloned = structuredClone(value),
    queue = [cloned],
    seen = new Set();
  while (queue.length) {
    const item = queue.pop();
    if (!item || typeof item !== "object" || seen.has(item)) continue;
    if (seen.size >= 100000) fail("CONTEXT_LIMIT");
    seen.add(item);
    queue.push(...Object.values(item));
    Object.freeze(item);
  }
  return cloned;
}
export async function withLocalDiagnosticArtifact(
  {
    root,
    intakeRoot,
    plan,
    artifactId,
    expectedRunId,
    expectedRunAttempt,
    expectedArtifactBytes,
    expectedArtifactDigest,
    policy,
    request,
    signal,
    measure,
  },
  action,
) {
  plan = snapshot(plan);
  policy = snapshot(policy);
  if (
    typeof action !== "function" ||
    !Array.isArray(policy?.trustedReviewActors) ||
    ![artifactId, expectedRunId, expectedRunAttempt].every((n) => Number.isSafeInteger(n) && n > 0) ||
    !Number.isSafeInteger(expectedArtifactBytes) ||
    expectedArtifactBytes < 22 ||
    expectedArtifactBytes > EXPERIENCE_INTAKE_LIMITS.archiveBytes ||
    !/^sha256:[a-f0-9]{64}$/u.test(expectedArtifactDigest ?? "")
  )
    fail("EXPECTED_PROVIDER_IDENTITY_REQUIRED");
  const remote = execFileSync("git", ["remote", "get-url", "origin"], {
    cwd: root,
    encoding: "utf8",
    timeout: 5000,
    maxBuffer: 65536,
  }).trim();
  const repository = remote.match(/github\.com[:/]([^/]+\/[^/.]+)(?:\.git)?$/u)?.[1];
  if (!repository || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository)) fail("REPOSITORY_INVALID");
  const binding = capacityBinding({
    repository,
    baseSha: plan.baseSha,
    candidateSha: plan.candidateSha,
    sourceDigest: plan.sourceDigest,
    contractDigest: plan.contractDigest,
    planDigest: experienceDigest(plan),
    runId: String(expectedRunId),
    runAttempt: String(expectedRunAttempt),
  });
  const deadline = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(900000)]);
  let token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  if (!request && !token) {
    try {
      token = execFileSync("gh", ["auth", "token"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 5000,
        maxBuffer: 65536,
      }).trim();
    } catch {
      fail("ACCESS_UNAVAILABLE");
    }
  }
  const responseFor = async (endpoint, binary, activeSignal) => {
    if (request) {
      const value = await request(endpoint, binary);
      return value instanceof Response ? value : new Response(binary ? value : JSON.stringify(value));
    }
    return fetch(`https://api.github.com/repos/${repository}/${endpoint}`, {
      signal: activeSignal,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Accept-Encoding": "identity",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
  };
  const api = async (endpoint) =>
    snapshot(
      await readBoundedArtifactMetadata(
        await intakeResponse((s) => responseFor(endpoint, false, s), deadline),
        deadline,
      ),
    );
  const validate = (artifact, run, workflow) => {
    deadline.throwIfAborted();
    if (
      artifact.id !== artifactId ||
      artifact.workflow_run?.id !== expectedRunId ||
      artifact.name !== `product-experience-capture-${plan.sourceDigest.slice(0, 16)}` ||
      artifact.size_in_bytes !== expectedArtifactBytes ||
      artifact.digest !== expectedArtifactDigest ||
      artifact.expired !== false ||
      !Number.isFinite(Date.parse(artifact.expires_at)) ||
      Date.parse(artifact.expires_at) <= Date.now() ||
      run.id !== expectedRunId ||
      run.run_attempt !== expectedRunAttempt ||
      run.status !== "completed" ||
      run.conclusion !== "failure" ||
      run.event !== "workflow_dispatch" ||
      run.head_branch !== "main" ||
      run.head_sha !== plan.baseSha ||
      run.head_repository?.full_name !== repository ||
      !policy.trustedReviewActors.includes(run.actor?.login) ||
      !Number.isSafeInteger(run.workflow_id) ||
      run.workflow_id < 1 ||
      workflow.id !== run.workflow_id ||
      workflow.path !== ".github/workflows/sounding-line-ordinary.yml" ||
      (plan.exception && (run.run_attempt !== 1 || run.triggering_actor?.login !== run.actor?.login))
    )
      fail("PROVIDER_BINDING_INVALID");
  };
  const artifact = await api(`actions/artifacts/${artifactId}`),
    run = await api(`actions/runs/${expectedRunId}`);
  if (!Number.isSafeInteger(run.workflow_id) || run.workflow_id < 1) fail("WORKFLOW_INVALID");
  const workflow = await api(`actions/workflows/${run.workflow_id}`);
  validate(artifact, run, workflow);
  const identity = (a, r, w) =>
    experienceDigest({
      artifact: {
        id: a.id,
        name: a.name,
        size: a.size_in_bytes,
        digest: a.digest,
        runId: a.workflow_run?.id,
        expired: a.expired,
        expires: a.expires_at,
      },
      run: {
        id: r.id,
        attempt: r.run_attempt,
        status: r.status,
        conclusion: r.conclusion,
        event: r.event,
        branch: r.head_branch,
        head: r.head_sha,
        repository: r.head_repository?.full_name,
        actor: r.actor?.login,
        triggeringActor: r.triggering_actor?.login,
        workflowId: r.workflow_id,
      },
      workflow: { id: w.id, path: w.path },
    });
  const initial = identity(artifact, run, workflow);
  const recheck = async () => {
    const a = await api(`actions/artifacts/${artifactId}`),
      r = await api(`actions/runs/${expectedRunId}`),
      w = await api(`actions/workflows/${run.workflow_id}`);
    validate(a, r, w);
    if (identity(a, r, w) !== initial) fail("PROVIDER_CHANGED");
  };
  const result = await createDiagnosticArtifactIntake({ root: intakeRoot, measure }).withArtifact(
    {
      binding,
      expectedBytes: expectedArtifactBytes,
      expectedDigest: expectedArtifactDigest,
      signal: deadline,
      request: (s) => responseFor(`actions/artifacts/${artifactId}/zip`, true, s),
    },
    async (archive) => {
      // plan.json is source-bound independently before any archive member becomes a diagnostic descriptor.
      const catalog = await archive.catalog();
      const planNames = new Set([
        "plan.json",
        "product-experience-submission/plan.json",
        "artifacts/sounding-line/product-experience-submission/plan.json",
        "candidate/artifacts/sounding-line/product-experience-submission/plan.json",
      ]);
      const planMembers = catalog.filter((entry) => planNames.has(entry.name));
      if (
        planMembers.length !== 1 ||
        planMembers[0].bytes < 1 ||
        planMembers[0].bytes > EXPERIENCE_INTAKE_LIMITS.manifestBytes
      )
        fail("PLAN_MEMBER_MISSING_AMBIGUOUS_OR_LIMIT");
      const planBytes = Buffer.alloc(planMembers[0].bytes);
      let at = 0;
      await archive.copyDiagnosticMember({
        name: planMembers[0].name,
        write: (bytes) => {
          if (at + bytes.length > planBytes.length) fail("PLAN_MEMBER_LIMIT");
          bytes.copy(planBytes, at);
          at += bytes.length;
        },
      });
      let observedPlan;
      try {
        observedPlan = JSON.parse(planBytes.toString("utf8"));
      } catch {
        fail("PLAN_JSON_INVALID");
      }
      if (experienceDigest(observedPlan) !== experienceDigest(plan)) fail("ARCHIVE_PLAN_MISMATCH");
      await recheck();
      const manifest = snapshot({
        version: 1,
        classification: "FAILED_CAPTURE_DIAGNOSTIC_ONLY_NOT_ACCEPTANCE",
        baseSha: plan.baseSha,
        candidateSha: plan.candidateSha,
        sourceDigest: plan.sourceDigest,
        contractDigest: plan.contractDigest,
        diagnosticArtifact: {
          id: artifactId,
          digest: expectedArtifactDigest,
          bytes: expectedArtifactBytes,
          runId: expectedRunId,
          runAttempt: expectedRunAttempt,
          conclusion: "failure",
          repository,
          workflowPath: workflow.path,
          expiresAt: artifact.expires_at,
        },
        diagnosticPackage: {
          retentionPolicy: "ALL_ARCHIVE_MEMBERS_WITH_ORIGINAL_PATHS",
          failureJournalPaths: catalog
            .filter((e) => /journal[^/]*\.(?:json|pending)$/u.test(e.name))
            .map((e) => e.name),
          completedCaptureOrContextCoverage: "NOT_CLAIMED;PARTIAL_FAILURE_PACKAGE",
        },
        artifacts: catalog.map((e) => ({
          path: e.name,
          bytes: e.bytes,
          sha256: null,
          type: /\.png$/iu.test(e.name)
            ? "screenshot"
            : /\.webm$/iu.test(e.name)
              ? "recording"
              : /\.trace\.zip$/iu.test(e.name)
                ? "trace"
                : "diagnostic",
          hashAuthority: "AUTHENTICATED_COMPLETE_ARCHIVE;MEMBER_CRC_AND_COMPUTED_SHA256",
        })),
        qualification: false,
        productAccepted: false,
      });
      const value = await action(manifest, archive);
      await recheck();
      return value;
    },
  );
  validate(artifact, run, workflow);
  return result;
}
