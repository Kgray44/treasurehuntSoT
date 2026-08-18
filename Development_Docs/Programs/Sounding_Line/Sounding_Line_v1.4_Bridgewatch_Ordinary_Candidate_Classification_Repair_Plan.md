---
title: Sounding Line v1.4 Bridgewatch Ordinary Candidate Classification Repair Plan
audience: engineering
status: implementation
canonical_for: sounding-line-v14-bridgewatch-ordinary-candidate-classification-repair
last_reviewed: 2026-08-16
---

# Sounding Line v1.4 Bridgewatch Ordinary Candidate Classification Repair Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recognize the owned Bridgewatch workspace and its explicitly bounded integration surfaces as ordinary v1.4 product-candidate scope without admitting any Sounding Line authority change.

**Architecture:** Keep the authoritative allowlist in `testing/verification-maintenance-policy.json`. Add one tested ordinary-candidate classifier beside the existing trusted maintenance classifier, and have the trusted-main authoritative workflow invoke that code rather than carrying a second inline glob implementation. The classifier always checks `authorityChangePathGlobs` before the ordinary allowlist.

**Tech Stack:** Node.js ESM, Node test runner, PowerShell GitHub Actions workflow, JSON policy.

---

### Task 1: Specify the bounded ordinary scope with failing regressions

**Files:**

- Modify: `tests/sounding-line/v14/verification-maintenance.test.mjs`
- Modify: `testing/verification-maintenance-policy.json`

- [ ] **Step 1: Write failing ordinary-candidate cases**

Import `classifyOrdinaryCandidate` and add cases that expect `ORDINARY_CANDIDATE` for `bridgewatch/src/discovery.ts`, `bridgewatch/test/discovery.test.ts`, `deploy/nginx.conf`, `scripts/sounding-line/status-projection.mjs`, and Bridgewatch design/validation records. Add independent fail-closed cases for `deploy/unrelated.conf`, `scripts/sounding-line/unrelated-adapter.mjs`, `scripts/sounding-line/planner.mjs`, a mixed `bridgewatch/**` plus authority-change diff, and an unknown path.

- [ ] **Step 2: Run the focused tests and observe the missing-export failure**

Run: `node --test tests/sounding-line/v14/verification-maintenance.test.mjs`

Expected: fail because `classifyOrdinaryCandidate` is not yet exported.

- [ ] **Step 3: Add the minimal policy allowlist**

Add only `bridgewatch/**`, `deploy/nginx.conf`, `scripts/sounding-line/status-projection.mjs`, `Development_Docs/Project_Bridgewatch_*.md`, and the exact repository documentation navigation records required by the existing Bridgewatch candidate. Do not add `deploy/**`, `scripts/sounding-line/**`, or an authority path.

### Task 2: Make the authoritative workflow consume the tested classifier

**Files:**

- Modify: `scripts/sounding-line/verification-maintenance.mjs`
- Modify: `.github/workflows/sounding-line-authoritative.yml`
- Modify: `tests/sounding-line/v14/verification-maintenance.test.mjs`

- [ ] **Step 1: Implement a shared ordinary classifier**

Export `classifyOrdinaryCandidate({ trustedPolicy, changedPaths })`. It must sort/deduplicate paths, reject authority paths first with `ORDINARY_CANDIDATE_AUTHORITY_CHANGE_REJECTED:<path>`, reject non-allowlisted paths with `ORDINARY_CANDIDATE_UNKNOWN_SCOPE_REJECTED:<path>`, and otherwise return `ORDINARY_CANDIDATE` with no errors.

- [ ] **Step 2: Add the `ordinary` CLI command**

Read `--policy` and `--paths`, write the classification to `--out`, print the classification, and exit nonzero only when classification has errors. Reuse the exact trusted policy file supplied by the workflow.

- [ ] **Step 3: Replace the workflow's inline glob loop**

In the `candidate`-only trusted boundary step, extract both policy and `verification-maintenance.mjs` from `SOUNDING_LINE_BASE_SHA`; write the sorted changed-path JSON; then run `node trusted-verification-maintenance.mjs ordinary ...`. Throw with the classifier's ordered errors if it rejects. Do not read candidate policy or classifier source.

- [ ] **Step 4: Run the focused regression suite**

Run: `node --test tests/sounding-line/v14/verification-maintenance.test.mjs tests/sounding-line/v14/maintenance-protected-binding.test.mjs tests/sounding-line/authority-cutover.test.mjs`

Expected: all tests pass and the workflow-source assertion proves trusted classifier invocation.

### Task 3: Verify the exact PR #160 envelope and integrate under authority-change governance

**Files:**

- Modify: `Development_Docs/Programs/Sounding_Line/Sounding_Line_v1.4_Bridgewatch_Ordinary_Candidate_Classification_Repair_Plan.md`
- Modify: `Development_Docs/INDEX.md`
- Modify: `Development_Docs/document-index.json`

- [ ] **Step 1: Verify PR #160's exact changed-file set locally**

Run the tested classifier against `git diff --name-only 3df555a0 30fc2858865ba47a6dccf0176f827e533c410601`. Expected: `ORDINARY_CANDIDATE` with no errors; separately verify that the status-projection diff only adds projected metadata and does not modify planner, finalizer, binding, or `RELEASE_GO` semantics.

- [ ] **Step 2: Run the authority-change evidence set**

Run focused classifier and binding tests, `npm run test:policy`, `npm run test:inventory`, `npm run docs:validate`, `npm run features:sync`, and `npm run features:validate`. Record command output before publication; do not dispatch ordinary candidate authority for the policy candidate.

- [ ] **Step 3: Publish and integrate only through the current authority-change procedure**

Create a dedicated policy-repair PR. Its trusted-base maintenance preflight must remain authority-change rejected; use the owner-authorized authority-change path to land the reviewed repair, never a self-issued `MAINTENANCE_GO` or an ordinary-candidate envelope.

- [ ] **Step 4: Reconcile and qualify PR #160 only after protected main advances**

Rebase or merge `origin/main` into the Bridgewatch branch without changing its product scope, re-run only invalidated focused qualification, dispatch one normal `candidate` mode v1.4 authority on the reconciled exact SHA, inspect the sealed envelope and finalizer for `RELEASE_GO`, and verify normal protected binding/tree parity.

- [ ] **Step 5: Merge and verify Bridgewatch v1.2 on exact protected main**

After its normal protected binding succeeds, merge PR #160 through the normal protected path. Fetch current protected main; prove the exact Bridgewatch v1.2 implementation tree is present, record the integration SHA, and run the required post-merge exact-main verification. Do not treat eligibility, qualification, or binding as completion.
