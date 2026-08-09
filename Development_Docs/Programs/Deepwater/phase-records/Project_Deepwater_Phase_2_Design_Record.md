---
title: Project Deepwater Phase 2 Design Record
audience: product-engineering
status: current
canonical_for: project-deepwater-phase-2-design-record
last_reviewed: 2026-08-09
---

# Project Deepwater Phase 2 design record

## Decision and source boundary

Project Deepwater Phase 2, **Trace the Current**, is a forensic, audit, assignment, and evidence-normalization increment. It converts every accepted Phase 1 priority item into a source-bound trace, a defensible realization disposition, and an owner-consumable remediation packet. It does not implement the remediation, change product behavior, mutate business data, or begin Phase 3.

| Boundary                               | Frozen value                                                                                                                                               |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository                             | `Kgray44/treasurehuntSoT`                                                                                                                                  |
| Accepted Phase 2 base                  | `273fb5255ad222812530422e902db04c0ddd1961`                                                                                                                 |
| Phase 1 implementation ancestor        | `a57fe264` is an ancestor of the accepted Phase 2 base                                                                                                     |
| Phase 1 audited product source         | `f1c2f22dd935322c1a71eb80c51592f243dc196d`                                                                                                                 |
| Phase 1 accepted artifacts             | 53 capabilities, 22 findings, and 44 prioritized trace items                                                                                               |
| Product drift since Phase 1 audit      | None observed in the accepted diff; intervening accepted changes are Deepwater, documentation, catalog generation, and Sounding Line control-plane records |
| Phase branch                           | `codex/project-deepwater-phase2-trace-the-current`                                                                                                         |
| Phase worktree                         | `C:\Users\kkids\Documents\treasurehuntSoT-deepwater-phase2`                                                                                                |
| Concurrency                            | Class A for Deepwater control-plane files; trace and assign only where active owner phases overlap                                                         |
| Product source impact                  | None expected                                                                                                                                              |
| Prisma and business-data schema impact | None permitted                                                                                                                                             |
| Runtime or database mutation           | None permitted                                                                                                                                             |

The canonical checkout was preserved. Unaccepted work in Admiralty, Shipwright, Tideglass, Helm, Wakebook, and governance-bootstrap lanes is coordination evidence only and is not current product truth. Phase 2 traces accepted main. If `origin/main` advances, affected traces and evidence are refreshed before candidate validation.

## Governing authorities

The phase applies the following precedence:

1. current accepted `origin/main` source, schemas, tests, and machine-readable records for implementation truth;
2. Voyagewright global product governance for product-reality, natural-discovery, state, accessibility, and owner-acceptance rules;
3. the Project Deepwater governing document for audit semantics and phase boundaries;
4. Project Sounding Line governing documents and accepted control-plane policy for verification authority;
5. the continuous-development and mainline-integration standard for current-main and convergence rules;
6. current canonical subsystem governing and implementation records for ownership and intended behavior;
7. historical records only as explicitly bounded evidence.

The supplied Deepwater and continuous-development PDFs are governing inputs. Their presence outside accepted main does not make their files accepted implementation evidence.

## Queue reconciliation

The accepted `Project_Deepwater_Phase_2_Trace_Queue.json` is the seed worklist. All 44 queue IDs must appear in the Phase 2 trace authority with one outcome: `COMPLETED`, `SUPERSEDED`, or `EXTERNALLY_DEFERRED`. A non-completed outcome requires a reason, evidence, owner, and forward assignment. Queue order is preserved as a source field even when several queue items share one capability or one refined finding.

No accepted product implementation changed between the Phase 1 audited product SHA and the Phase 2 base. The queue is therefore current at design freeze. Catalog, route, screen, and journey records are nevertheless re-read at the Phase 2 base, and every prior catalog mismatch receives a current explicit reconciliation outcome.

## Complete trace contract

Every prioritized capability records identity, ownership, audience, terminal intent, source SHA, and each applicable layer:

1. domain;
2. service;
3. transport, API, or server action;
4. authorization;
5. projection or DTO;
6. client;
7. UI;
8. navigation and discoverability;
9. state model and recovery;
10. accessibility, responsive behavior, and motion relevance;
11. natural journey;
12. owner acceptance when the terminal rung requires it.

Each layer records status, exact repository-relative references, stable symbols or route/action IDs where practical, call direction, input/output contract, authorization and projection boundaries where relevant, state behavior, evidence kind, source SHA, freshness, and an analysis conclusion. Layer status alone is never the trace.

`VERIFIED` requires direct current source or accepted evidence. `ABSENT` requires evidence that an expected layer does not exist. `NOT_APPLICABLE` requires an intentional rationale tied to audience and disposition. `PARTIAL` requires a precise gap and linked finding. `UNKNOWN` is allowed only with attempted evidence, an exact unresolved reason, an external-evidence flag, a finding or limitation reference, and the owner responsible for resolution.

The actual architecture is recorded. Direct server actions are not rewritten as fictional APIs; internal workers are not penalized for having no UI; restricted capabilities are not broadened to make a trace visually complete.

## Root-cause and first-loss policy

The first loss point is the earliest meaningful layer at which intended realization becomes inadequate. The closed vocabulary is:

`DOMAIN`, `SERVICE`, `API`, `AUTHORIZATION`, `PROJECTION`, `CLIENT`, `UI`, `NAVIGATION`, `STATE`, `ACCESSIBILITY`, `JOURNEY`, `OWNER_ACCEPTANCE`, `EXTERNAL_PROVIDER`, and `DOCUMENTATION`.

Every prioritized capability below its expected terminal rung has exactly one primary first loss point and a root-cause statement explaining why the ladder stops there. A later symptom cannot replace an earlier cause. Phase 1's provisional `FEATURE_CATALOG_TO_ROUTE_INVENTORY` value is replaced by one of the Phase 2 loss points. Root-cause validation enforces these consistency rules:

- `PROJECTION` requires enough verified backend truth to prove capability existence and an absent or partial audience projection;
- `NAVIGATION` requires an existing UI or contextual surface and absent or partial natural discovery;
- `JOURNEY` requires the preceding applicable layers to be established;
- `BACKEND_ONLY` requires verified service truth and absent appropriate product projection or UI;
- `FRONTEND_ONLY` requires UI with absent or simulated canonical backend truth;
- `INTERNAL_BY_DESIGN` requires an intentional internal disposition, rationale, and terminal rung.

## Evidence freshness

Evidence is `CURRENT` when it is verified against the audited Phase 2 source, `BOUNDED` when it proves only its named source/version/environment, and `STALE` when relevant accepted changes can invalidate it. A current trace cannot derive maturity exclusively from stale evidence. Local, synthetic, harness, desktop, staging, live-provider, physical-device, deployment, and owner-decision evidence remain separate truth boundaries.

Trace records may contain repository paths, exported symbols, governed IDs, route patterns, safe contract summaries, and sanitized state names. They must not contain credentials, cookies, tokens, password values or hashes, invitation secrets, provider secrets, raw object keys, KMS material, private Chronicle prose or answers, private media, raw database content, or unnecessary personal data.

## Findings and assignments

All 22 Phase 1 findings are confirmed, refined, split, merged, superseded, or closed only from accepted evidence. Stable IDs are preserved when the underlying nonconformity remains the same. Splits require genuinely different owners or closure evidence. Every open finding records severity, confidence, observed SHA, expected and current behavior, exact first loss point, root cause, canonical owner, contributing owners, assigned project/phase, dependencies, closure evidence, and status.

Ownership follows the accepted ownership map and subsystem contracts, never file location. Deepwater owns audit semantics, traces, assignments, evidence, and eligible future glue slices; it does not absorb domain ownership because it found the loss.

## Remediation packet contract

The machine-readable remediation authority consists of a schema plus deterministic packet collection. Each actionable open finding has exactly one referenced packet. Packets contain stable packet ID, finding IDs, capability ID, canonical and contributing owners, recommended vehicle, current classification and rung, expected terminal rung, exact loss point, root cause, current and required behavior, affected contracts and surfaces, authorization/privacy constraints, state and accessibility implications, hard and soft dependencies, concurrency class, mainline-safety expectations, suggested integration pattern, prohibited shortcuts, required closure evidence, source SHA, and status.

Packets specify what is missing, where it is lost, who owns it, which boundaries must remain intact, and what proves closure. They do not dictate another owner's internal architecture. Packet owner must match the ownership map unless a recorded multi-owner rationale explains the exception.

## Catalog reconciliation

Every Phase 1 catalog/route mismatch receives exactly one outcome:

`CATALOG_STALE`, `ROUTE_INVENTORY_STALE`, `COMPATIBILITY_ALIAS`, `COMPOSITE_SURFACE`, `NON_ROUTE_BOUNDARY`, `ACTUAL_NAVIGATION_GAP`, `ACTUAL_MISSING_SURFACE`, `OWNER_MISMATCH`, or `UNRESOLVED`.

The record names the current canonical route identity, catalog fragment, owner plus Ledgerlight, and required closure validation. A documentation-only mismatch remains distinct from a product defect. Generated `FEATURE_CATALOG.md` is never hand-edited.

## Active-project coordination policy

The coordination register records capability, finding, owner, active owner phase, conflict surface, permitted Deepwater action, hard dependency, and recommended vehicle. Accepted main remains truth while an owner lane is unaccepted. In overlapping active areas Phase 2 may trace, classify, and assign, but it must not edit the owner's UI, schema, business semantics, or unaccepted artifacts. If an owner phase lands on main, only impacted traces are refreshed and Sounding Line decides which evidence is invalidated.

## Deepwater slice eligibility

A future Deepwater slice is `ELIGIBLE` only when a canonical business owner exists, semantics are frozen, the work is cross-layer glue/projection/navigation/state/evidence, no active owner phase is rewriting the surface, schema impact is absent or minimal, the change is independently mainline-safe, and a Sounding Line gate can be defined. Other values are `NOT_ELIGIBLE`, `BLOCKED_BY_ACTIVE_OWNER`, and `BLOCKED_BY_DEPENDENCY`. Eligibility is planning metadata, not Phase 3 authorization.

## Classification and lifecycle rules

Classification changes require current evidence and an explanation. User-facing `FULLY_REALIZED` requires current proof through the declared terminal rung, including applicable authorization, projection, discoverability, states, accessibility, and natural journey. `OWNER_ACCEPTED` additionally requires the governing owner decision. Internal service capabilities may legitimately become fully realized at their intentional terminal rung. Evidence gaps are never hidden by lowering the terminal rung.

Phase 3 queue items separate `OWNER_PROJECT_WORK`, `DEEPWATER_SLICE_ELIGIBLE`, `EXTERNAL_DEPENDENCY`, `OWNER_ACCEPTANCE_REQUIRED`, `DOCUMENTATION_RECONCILIATION`, and `DEBT_CANDIDATE`. Every item includes owner, packet, severity, priority, dependencies, active-project status, recommended vehicle, earliest eligible phase, closure evidence, and slice eligibility. Phase 2 generates the queue and performs none of its work.

## Deterministic output and validation

Machine authorities are stable-ID sorted, canonicalized JSON. Semantic output contains no wall-clock timestamps. Regeneration from identical inputs produces identical semantic output and a Phase 2 semantic digest. Markdown reports are generated summaries, not competing truth.

Validation fails for unknown references, missing owners or rungs, unexplained applicable layers, unlinked partial or absent layers, unbounded unknowns, missing authorization/projection/navigation/state conclusions, incomplete capabilities without loss/root cause/assignment, invalid finding or packet ownership, stale-only maturity, inconsistent loss/classification combinations, credential-like output, and nondeterministic regeneration. Negative tests cover each required failure family.

## Mainline Safety Contract

| Field                 | Phase 2 contract                                                                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Post-phase capability | Deterministic complete traces, refined findings, owner assignments, remediation packets, catalog reconciliation, coordination register, reports, and Phase 3 queue |
| Active behavior       | Repository-only generation, validation, reporting, and Sounding Line selection                                                                                     |
| Product behavior      | Unchanged                                                                                                                                                          |
| Schema and migrations | Unchanged                                                                                                                                                          |
| Runtime and data      | No database, external-provider, or private-data mutation                                                                                                           |
| Compatibility         | No product route or compatibility behavior changes                                                                                                                 |
| Dormant future work   | All remediation and Phase 3 realization                                                                                                                            |
| Rollback/disable      | Remove Deepwater Phase 2 control-plane additions; runtime and data are unaffected                                                                                  |
| Permanent-stop test   | Product behavior remains unchanged and owner projects can consume packets independently even if Deepwater never continues                                          |
| Failure path          | Validation fails closed without modifying product or data                                                                                                          |

## Sounding Line obligations and acceptance

Sounding Line is the only verification authority. Phase 2 registers trace-schema, packet-schema, assignment, referential-integrity, root-cause consistency, privacy, determinism, report, and regression tests in the accepted testing control plane. Focused candidate validation must pass, evidence must be source-bound, and the protected `Sounding Line / Mainline Decision` is required for mainline convergence.

Phase 2 is locally complete only when Phase 1 ancestry and artifacts validate; all 44 seed items are accounted for; every priority trace satisfies the complete-trace contract; every incomplete trace has exact loss/root cause/evidence; every open finding is unambiguously assigned; every actionable finding has an owner-consumable packet; every catalog mismatch has an explicit outcome; the deterministic Phase 3 queue and required reports exist; privacy and negative tests pass; product source and Prisma schemas remain unchanged; current main is reconciled; and Sounding Line produces the required candidate evidence.

Phase 2 completion does not require remediation findings to be fixed and does not authorize Phase 3.
