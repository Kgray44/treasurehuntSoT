---
title: Project Sounding Line Phase 4 Final Acceptance Matrix
audience: engineering
status: planned
canonical_for: sounding-line-phase-4-final-acceptance
last_reviewed: 2026-07-29
---

# Phase 4 Final Acceptance Matrix

Every future gate has a release owner, governed command/plan, retained evidence,
veto, external prerequisite, and rollback to legacy or emergency serial. Values
below describe future proof and are not evidence of completion.

| Gate                                    | Owner / environment              | Required evidence and veto                                         | External prerequisite / rollback |
| --------------------------------------- | -------------------------------- | ------------------------------------------------------------------ | -------------------------------- |
| policy and plan parity                  | Sounding Line / local+CI         | same sealed plan; mismatch veto                                    | none / Stage 0                   |
| local/CI parity                         | Sounding Line / paired           | same outcome and counts; drift veto                                | trusted CI / Stage 0             |
| worker trust and source identity        | Security / trusted worker        | attestation and identities; invalid identity veto                  | enrollment / quarantine          |
| database isolation and migrations       | Data / isolated DB               | clone/schema, migration, cleanup; mutation veto                    | DB capability / serial           |
| browser compatibility and accessibility | Quality / browser worker         | selected matrix and artifacts; missing case veto                   | browser capability / serial      |
| build, restart, backup/restore          | Release / build host             | build/restart/restore receipts; failure veto                       | host capability / serial         |
| providers                               | owning project / provider worker | configured proof or explicit pending rule                          | provider access / Stage 0        |
| security and privacy                    | Security / controlled            | scans and review; exposure veto                                    | approved scanner / Stage 0       |
| performance and cleanup                 | Sounding Line / measured lanes   | budget decomposition and cleanup; escape veto                      | capacity class / serial          |
| dual run and release decision           | Release / paired                 | required window and valid decision; disagreement veto              | accepted prerequisites / Stage 0 |
| branch protection and documentation     | Release / repository             | approved human proposal and Ledgerlight records; stale review veto | repository authority / no change |
| emergency serial and rollback           | Release / local                  | activation and restoration drills; unavailable fallback veto       | legacy retained / Stage 0        |

The controlling requirement ledger expands these gates and maps each to a named
preparation record. No matrix row authorizes a release until every applicable
future command and evidence reference is accepted.

Current baseline facts for every future row are Phase 1 and Phase 2 accepted
and mainline; 14 suites, 17 contracts, and 19 resources; reviewed adapters;
and the protected legacy full-release lock. The local concurrent Harborlight
lanes satisfy none of the dual-run, CI parity, distributed-worker, release
authority, or cutover rows. P34 and external-provider rows remain unresolved.
