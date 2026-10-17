---
title: Focused development and final verification
audience: automation
status: current
canonical_for: focused-development-testing-workflow
last_reviewed: 2026-10-17
---

# Focused development and final verification

Develop in an isolated branch and worktree from protected main. Reproduce the
reported failure with the smallest existing test that exercises its cause. Keep
the original failure, source identity, test configuration and diagnostic state.
Use focused tests while changing code; Sounding Line final qualification is not
a debugging loop.

For unit and policy changes, run the relevant existing Vitest or Node test files.
For browser development, use `scripts/sounding-line/develop-browser-suite.mjs`
with its task-owned database, synthetic fixtures, production server and supervised
cleanup:

```sh
node scripts/sounding-line/develop-browser-suite.mjs prepare --workspace <dedicated-worktree> --test tests/e2e/reach-laboratory.spec.ts:357 --output <new-private-preparation-output>
node scripts/sounding-line/develop-browser-suite.mjs run --workspace <dedicated-worktree> --test tests/e2e/reach-laboratory.spec.ts:357 --output <new-private-run-output> --prepared <returned-manifest-file> --manifest-sha256 <returned-manifest-sha256>
```

Dependency installation is a separate setup step using the repository lock and
its locked browser revision. The runner does not install dependencies itself.
The manual [focused development workflow](../.github/workflows/sounding-line-focused-repair.yml)
runs this route from protected main against one exact same-repository commit.
It has read-only repository permissions and produces no mainline decision.
Prepare dependencies and a source-bound runtime once; reuse preparation only
while its source, fixtures, configuration, lock, browser and runtime identities
match. Mutable databases, browser contexts, ports and output directories remain
isolated for each execution. A changed input requires new preparation.

Development results are labelled `DEVELOPMENT_ONLY` and `qualification: false`.
They do not reserve campaign custody, consume a final-verification allowance,
mint a qualifier, or satisfy a protected integration decision. Ordinary focused
development within the owner's authorized task does not require another finite
diagnostic exception or repeated owner permission. Existing reservations and
failed final qualification records remain immutable and spent.

Keep the original assertions, fixture safeguards and timeouts when diagnosing a
failure. If an isolated case does not reproduce a failure, record that result as
incomplete causal evidence. Add bounded observations or expand to the relevant
test order only for a concrete unresolved question. Do not exclude obligations,
weaken assertions or infer acceptance from a passing test count.

When an unchanged shared test fails, compare protected main and the candidate
using matched, measured environments and separate mutable state. Matching test
files alone do not establish independence from shared runtime changes. Record
the baseline disposition and complete dependency closure before preserving or
narrowing any final verification obligation.

Retain failure diagnostics privately, including collection or cleanup failures.
Only encrypted diagnostics may be uploaded where traces, screenshots or context
could contain private runtime data. Keep collection completeness, encryption,
upload, cleanup and the original test outcome distinct. A retention failure must
not replace or erase the original application failure.

Completed passing obligations may be retained after a later obligation fails.
Reuse requires complete fingerprints and independently verified trusted producer
provenance. A self-hashed cache file or a historical stdout pass is insufficient.
Missing, incompatible, partial or unauthenticated evidence requires fresh proof.
Retained partial progress never changes the failed whole-run outcome.

After the cause is corrected, focused regressions and applicable
[Product Experience Engineering](product-experience-workflow.md) evidence are
complete, freeze one candidate and use the normal protected final check. Preserve
current source, base, product/browser obligations and qualification requirements.
Merge only after that check and its exact seals pass; verify the actual landed
tree before releasing dependent integration work.
