# Sounding Line Implementation Roadmap

## Phase 1 — Take the Soundings

Scope: inventory, taxonomy, ownership/contracts/metadata, seed impact graph, current-command adapters, and evidence schema. Non-goals: no scheduler/broker/CI replacement. Likely files are `testing/*.json`, documentation, adapter metadata, and receipt schema. Acceptance: every existing family has an owner, type, resource profile, and current command. Risks are incomplete mapping and historical-document drift; handoff is a validated baseline and unresolved-map list. Estimated effort: medium, iterative repository inventory.

## Phase 2 — Open the Channels

Scope: resource lease broker, isolated runtimes/ports/database clones/storage roots, shards, parallel lanes, deterministic cleanup. Non-goals: impact selection and distributed CI. Likely files are new runner/lease modules, harness adapters, test fixtures, and process/artifact utilities. Migration concern: preserve `test-all.ps1` canonical-data/process safety while moving one resource family at a time. Acceptance: independent browser/database suites run concurrently without collision. Risk: accidental shared-state fallback; handoff includes collision and cleanup receipts. Estimated effort: large.

## Phase 3 — Read the Current

Scope: changed-file impact/dependency/risk planning, root/cascade failures, stale-test detection, Codex enforcement. Non-goals: release-worker fleet. Likely files are planner, graph extractors, policy validators, receipt classification, and task templates. Acceptance: every change receives a deterministic explainable plan and cannot close without its obligations. Risk: under-selection; uncertain mappings must expand. Handoff includes false-positive/false-negative review. Estimated effort: large.

## Phase 4 — Prove the Passage

Scope: CI distribution, cross-platform workers, compatibility matrices, release receipts, historical performance, flake governance, final migration/build/restart/provider gates. Non-goals: product semantics. Likely files are workflow adapters, worker images, result store, gate policies, and dashboards. Acceptance: local, Codex, and CI produce the same release decision from the same commit/policy. Risks are environment drift and provider availability; handoff includes parity fixtures and external-gate runbook. Estimated effort: large.
