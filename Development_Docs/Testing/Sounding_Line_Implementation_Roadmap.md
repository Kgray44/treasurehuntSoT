# Sounding Line Implementation Roadmap

## Phase 1 — Take the Soundings (complete)

Scope: inventory, taxonomy, ownership/contracts/metadata, seed impact graph, current-command adapters, and evidence schema. Non-goals: no scheduler/broker/CI replacement. Likely files are `testing/*.json`, documentation, adapter metadata, and receipt schema. Acceptance: every existing family has an owner, type, resource profile, and current command. Risks are incomplete mapping and historical-document drift; handoff is a validated baseline and unresolved-map list. Estimated effort: medium, iterative repository inventory.

## Phase 2 — Open the Channels (complete)

Scope: resource lease broker, isolated runtimes/ports/database clones/storage roots, shards, parallel lanes, deterministic cleanup. Non-goals: impact selection and distributed CI. Likely files are new runner/lease modules, harness adapters, test fixtures, and process/artifact utilities. Migration concern: preserve `test-all.ps1` canonical-data/process safety while moving one resource family at a time. Acceptance: independent browser/database suites run concurrently without collision. Risk: accidental shared-state fallback; handoff includes collision and cleanup receipts. Estimated effort: large.

## Phase 3 — Read the Current (complete)

Scope: changed-file impact/dependency/risk planning, root/cascade failures, stale-test detection, Codex enforcement. Non-goals: release-worker fleet. Likely files are planner, graph extractors, policy validators, receipt classification, and task templates. Acceptance: every change receives a deterministic explainable plan and cannot close without its obligations. Risk: under-selection; uncertain mappings must expand. Handoff includes false-positive/false-negative review. Estimated effort: large.

## Phase 4 — Prove the Passage (local control plane complete)

Implemented scope: provider-neutral worker enrollment and lifecycle, capability matching, sealed assignments, local/CI plan and dual-run comparison, evidence integrity and attestations, revocation, emergency serial fallback, and a secret-free focused workflow. Non-goals remain product semantics and authority escalation. The local implementation proves fail-closed behavior and records a `RELEASE_NO_GO` when P34 or external gates are pending; it does not prove hosted execution, remote workers, provider/MySQL validation, production signing, branch-protection application, or a P34 browser-matrix pass. Those are retained as separately governed external or non-green work.
