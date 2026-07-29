---
title: Project Sounding Line Phase 4 Performance and Capacity Qualification
audience: engineering
status: planned
canonical_for: sounding-line-phase-4-performance-capacity
last_reviewed: 2026-07-29
---

# Phase 4 Performance and Capacity Qualification

## Measurement model

Future measurements use the current Sounding Line budgets as governing inputs
and decompose queue, provision, setup, execution, teardown, cleanup, critical
path, and wall time. Each result records plan size, worker class, hardware/
runtime identity, resource contention, retries, and evidence/cleanup outcome.
Budgets diagnose work; a missed budget creates owned remediation and never
authorizes weaker coverage, a smaller matrix, or omitted cleanup.

The initial population is the accepted Phase 2 14-suite, 17-contract,
19-resource policy. Measurements must retain its per-lane resource keys,
local clone/browser/server identities, process ownership, cleanup/quarantine
receipts, and emergency-serial comparison. The two concurrent Harborlight
lanes supply a local isolation sample only; they are not a distributed capacity
claim or a local/CI parity result.

## Required experiment matrix

The qualification plan covers focused static; unit/component; service
integration; focused browser; subsystem closure; cross-project closure; local
release; and distributed release scopes. Each is measured with 1, 2, and 4
workers; constrained workstation; CI standard; browser-heavy; database-heavy;
mixed release; and provider-limited conditions. The baseline serial harness is
included for comparison. External/provider-limited results remain explicitly
blocked or pending when their prerequisite is unavailable.

## Acceptance discipline

An experiment is valid only when source/policy/lock identity, worker identity,
capability match, test counts, artifact hashes, and cleanup are valid. Report
throughput and critical path separately so hidden queue/provision cost cannot be
mistaken for execution improvement. Capacity claims require repeated approved
observations and must retain failure, flake, and resource-safety evidence.
