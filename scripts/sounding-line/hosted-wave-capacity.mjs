/*
 * Hosted authority has a finite, statically declared GitHub Actions topology.
 * Keep that topology and the governed dependency graph under one fail-closed
 * capacity contract so a deeper valid plan cannot be silently dropped.
 */
const archivedStatus = "ARCHIVED_HISTORICAL_MATRIX";

const sorted = (values) => [...values].sort((left, right) => String(left).localeCompare(String(right)));

export function calculateMaximumLegalWave(suites = []) {
  const active = suites.filter((suite) => suite?.status !== archivedStatus);
  const byId = new Map(active.map((suite) => [suite.id, suite]));
  const memo = new Map();
  const visit = (suiteId, chain = []) => {
    if (memo.has(suiteId)) return memo.get(suiteId);
    if (chain.includes(suiteId))
      throw new Error(`HOSTED_WAVE_CAPACITY_DEPENDENCY_CYCLE:${[...chain, suiteId].join("->")}`);
    const suite = byId.get(suiteId);
    if (!suite) throw new Error(`HOSTED_WAVE_CAPACITY_DEPENDENCY_UNKNOWN:${suiteId}`);
    const wave = Math.max(
      0,
      ...(suite.dependencies ?? []).map((dependency) => 1 + visit(dependency, [...chain, suiteId])),
    );
    memo.set(suiteId, wave);
    return wave;
  };
  const waves = active.map((suite) => ({ suiteId: suite.id, wave: visit(suite.id) }));
  const maximumWave = Math.max(0, ...waves.map((entry) => entry.wave));
  return {
    maximumWave,
    deepestSuiteIds: sorted(waves.filter((entry) => entry.wave === maximumWave).map((entry) => entry.suiteId)),
  };
}

export function validateHostedWaveCapacity({ capacity, suites }) {
  const errors = [];
  if (!capacity || typeof capacity !== "object") return { valid: false, errors: ["HOSTED_WAVE_CAPACITY_REQUIRED"] };
  const { maximumWave, minimumHeadroom, enforcement } = capacity;
  if (!Number.isInteger(maximumWave) || maximumWave < 0) errors.push("HOSTED_WAVE_CAPACITY_MAXIMUM_INVALID");
  if (!Number.isInteger(minimumHeadroom) || minimumHeadroom < 1) errors.push("HOSTED_WAVE_CAPACITY_HEADROOM_INVALID");
  if (enforcement !== "FAIL_CLOSED_STATIC_QUALIFICATION") errors.push("HOSTED_WAVE_CAPACITY_ENFORCEMENT_INVALID");
  let legal = null;
  try {
    legal = calculateMaximumLegalWave(suites);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  if (legal && Number.isInteger(maximumWave) && Number.isInteger(minimumHeadroom)) {
    if (legal.maximumWave > maximumWave) errors.push("HOSTED_WAVE_CAPACITY_EXCEEDED_BY_GOVERNED_GRAPH");
    if (legal.maximumWave + minimumHeadroom > maximumWave) errors.push("HOSTED_WAVE_CAPACITY_HEADROOM_INSUFFICIENT");
  }
  return { valid: errors.length === 0, errors: sorted(errors), legal };
}

export function validateHostedPlanCapacity({ capacity, plan }) {
  const errors = [];
  if (!Number.isInteger(capacity?.maximumWave))
    return { valid: false, errors: ["HOSTED_WAVE_CAPACITY_MAXIMUM_INVALID"] };
  for (const node of plan?.nodes ?? []) {
    const wave = node?.execution?.wave;
    if (!Number.isInteger(wave) || wave < 0) errors.push(`HOSTED_EXECUTION_WAVE_INVALID:${node?.id ?? "missing"}`);
    else if (wave > capacity.maximumWave)
      errors.push(`HOSTED_EXECUTION_WAVE_CAPACITY_EXCEEDED:${node?.id ?? "missing"}:${wave}`);
  }
  return { valid: errors.length === 0, errors: sorted(errors) };
}

export function validateHostedWorkflowCapacity({ capacity, workflow }) {
  const errors = [];
  if (!Number.isInteger(capacity?.maximumWave))
    return { valid: false, errors: ["HOSTED_WAVE_CAPACITY_MAXIMUM_INVALID"] };
  if (!/\$maximumWave\s*=\s*\[int\]\$authority\.hostedExecutionCapacity\.maximumWave/u.test(workflow))
    errors.push("HOSTED_WAVE_CAPACITY_WORKFLOW_CONTRACT_UNREAD");
  if (!/foreach \(\$wave in 0\.\.\$maximumWave\)/u.test(workflow))
    errors.push("HOSTED_WAVE_CAPACITY_WORKFLOW_MATRIX_NOT_CONTRACT_BOUND");
  if (!workflow.includes("activeMaximumWave: ${{ steps.matrix.outputs.activeMaximumWave }}"))
    errors.push("HOSTED_WAVE_CAPACITY_ACTIVE_MAXIMUM_OUTPUT_MISSING");
  if (!/"activeMaximumWave=\$planMaximumWave" \| Out-File -FilePath \$env:GITHUB_OUTPUT/u.test(workflow))
    errors.push("HOSTED_WAVE_CAPACITY_ACTIVE_MAXIMUM_UNSEALED");
  for (let wave = 0; wave <= capacity.maximumWave; wave += 1) {
    const predecessor = wave ? `wave-${wave - 1}-complete` : "plan";
    const parallel = new RegExp(`governed-parallel-wave-${wave}:[\\s\\S]*?needs: \\[[^\\]]*${predecessor}`, "u");
    const exclusive = new RegExp(`governed-exclusive-wave-${wave}:[\\s\\S]*?needs: \\[[^\\]]*${predecessor}`, "u");
    const barrier = new RegExp(
      `wave-${wave}-complete:[\\s\\S]*?governed-parallel-wave-${wave}[\\s\\S]*?governed-exclusive-wave-${wave}`,
      "u",
    );
    if (!workflow.includes("parallel" + wave + ": ${{ steps.matrix.outputs.parallel" + wave + " }}"))
      errors.push(`HOSTED_WAVE_CAPACITY_OUTPUT_MISSING:parallel${wave}`);
    if (!workflow.includes("exclusive" + wave + ": ${{ steps.matrix.outputs.exclusive" + wave + " }}"))
      errors.push(`HOSTED_WAVE_CAPACITY_OUTPUT_MISSING:exclusive${wave}`);
    if (!workflow.includes("exclusive" + wave + "Present: ${{ steps.matrix.outputs.exclusive" + wave + "Present }}"))
      errors.push(`HOSTED_WAVE_CAPACITY_OUTPUT_MISSING:exclusive${wave}Present`);
    if (!parallel.test(workflow)) errors.push(`HOSTED_WAVE_CAPACITY_PARALLEL_JOB_MISSING:${wave}`);
    if (!exclusive.test(workflow)) errors.push(`HOSTED_WAVE_CAPACITY_EXCLUSIVE_JOB_MISSING:${wave}`);
    if (!barrier.test(workflow)) errors.push(`HOSTED_WAVE_CAPACITY_BARRIER_MISSING:${wave}`);
    if (wave > 0 && !workflow.includes(`fromJSON(needs.plan.outputs.activeMaximumWave) >= ${wave}`))
      errors.push(`HOSTED_WAVE_CAPACITY_DORMANT_WAVE_GUARD_MISSING:${wave}`);
    if (
      !new RegExp(
        `finalizer:[\\s\\S]*?governed-parallel-wave-${wave}[\\s\\S]*?governed-exclusive-wave-${wave}[\\s\\S]*?wave-${wave}-complete`,
        "u",
      ).test(workflow)
    )
      errors.push(`HOSTED_WAVE_CAPACITY_FINALIZER_NEEDS_MISSING:${wave}`);
  }
  return { valid: errors.length === 0, errors: sorted(errors) };
}
