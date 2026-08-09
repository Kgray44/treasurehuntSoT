---
title: Project Deepwater Phase 1 Design Record
audience: product-engineering
status: current
canonical_for: project-deepwater-phase-1-design-record
last_reviewed: 2026-08-09
---

# Project Deepwater Phase 1 design record

## Decision and source boundary

Project Deepwater Phase 1, **Sound the Depths**, is an audit and governance increment. It creates a permanent capability-realization control plane without changing product behavior, product authority, or database schema. The design is frozen before broad ledger generation.

| Boundary                  | Frozen value                                                                                         |
| ------------------------- | ---------------------------------------------------------------------------------------------------- |
| Repository                | `Kgray44/treasurehuntSoT`                                                                            |
| Canonical checkout        | `C:\Users\kkids\Documents\Codex_TreasureHunt` (preserved; dirty and 247 commits behind at preflight) |
| Phase worktree            | `C:\Users\kkids\Documents\treasurehuntSoT-deepwater-phase1`                                          |
| Phase branch              | `codex/project-deepwater-phase1-sound-the-depths`                                                    |
| Base `origin/main`        | `f1c2f22dd935322c1a71eb80c51592f243dc196d`                                                           |
| Base commit               | `f1c2f22 Merge pull request #14 from Kgray44/agent/voyagewright-oauth-final-closure`                 |
| Local `main` at preflight | `424ecc3b7a15ad53fc591287968720829c27f6ae`                                                           |
| Concurrency               | Class A; no schema reservation; very low product-source pressure                                     |
| Activation                | Active governance and audit tooling only                                                             |
| Product behavior          | Unchanged                                                                                            |

The freshly fetched base contains 41 authoritative Feature Catalog entries, 281 Homeport route records, 97 Homeport screen records, 237 Homeport journey records, 47 Sounding Line suites, and 411 Sounding Line contracts. The Homeport owner-decision authority remains `PENDING_OWNER_DECISION`; local, synthetic, browser, staging-desktop, or Sounding Line evidence does not become owner acceptance.

Empty local Phase 1 branches for Admiralty, Helm, Shipwright, and Wakebook were based at the same `origin/main` SHA during preflight and had no committed divergence. No active branch had committed changes to the Feature Catalog, route/screen/journey inventories, or project-status metadata relative to `origin/main`.

## Governing authorities used

The design applies the authority order required by the implementation contract:

1. freshly fetched `origin/main` for implementation truth;
2. `Development_Docs/Governance/Voyagewright_Global_Product_Governance_Standard.md` for human-facing product reality;
3. the supplied `Project_Deepwater_Product_Capability_Realization_and_Systems_Audit_Program_Governing_Document.pdf` for Deepwater semantics;
4. `Development_Docs/Project_Sounding_Line_Governing_Document.md` and the current `testing/` control plane for verification;
5. the supplied `Voyagewright_Continuous_Development_and_Mainline_Integration_Standard_v1.0.pdf` for phase convergence;
6. current accepted subsystem design, architecture, completion, and integration records;
7. historical records only as bounded evidence.

The two supplied PDFs were read from the preserved canonical checkout because they were not tracked in the fetched base. They are input authorities, not evidence that their files are already accepted on main.

## Frozen audit semantics

### 1. Capability identity

A capability is a stable ability meaningful to a user, operator, developer, or external machine. It is broader than a helper or column and narrower than an entire project. IDs use semantic `DW-CAP-*` names and never derive from source paths. A renamed or moved implementation retains its capability ID.

Every current Feature Catalog entry creates a mandatory parent mapping. A catalog parent is split into additional capabilities only when a sub-capability has a different canonical owner, audience, privacy class, expected terminal rung, disposition, or independently actionable finding. This prevents both function-per-row noise and project-sized rows that conceal meaningful loss.

### 2. Feature Catalog mapping

`Development_Docs/Features/catalog/*.json` is the authoritative seed. Each parent entry records catalog ID, title, declared program, status, surfaces, subfeatures, limitations, and evidence. A catalog reference is valid only when the current catalog contains the ID. The generated Markdown is never edited by Deepwater tooling.

### 3. Uncataloged discovery

Meaningful uncataloged candidates are admitted from accepted domain models, services, APIs, projections, workers, providers, operations, recovery paths, route inventories, and tests. A candidate requires a named consumer or operational purpose and an intentional disposition. Helpers, raw columns, framework plumbing, and test-only conveniences are excluded.

### 4. Granularity

One row may cover several interfaces to the same business ability. Separate rows are required when lifecycle, authority, audience, privacy, expected realization, or closure evidence differs. Compatibility aliases remain attached to the canonical capability unless they own independent behavior, which would itself be a `DW-OWN` concern.

### 5. Ownership resolution

Ownership is resolved from governing contracts, not file location. The ownership map recognizes current catalog programs and governed future owner families, including Platform, Wayfarer, One Voyage, Harborlight, Drydock, Helm, Wakebook, Admiralty, Shipwright, Tideglass, Sealed Hold, Lanternwake, Landfall, Watchglass, Breakwater, Sounding Line, Ledgerlight, True North, Universal Language, and Deepwater. Aliases such as `Player`, `Captain`, `Studio`, and phase-qualified program labels resolve to the canonical family named by the map.

Unresolved ownership is represented honestly with `OWNERSHIP_AMBIGUOUS` and a `DW-OWN` finding. Validation must not force an invented owner.

### 6. Expected terminal rung

The only rungs are `DOMAIN`, `SERVICE`, `API`, `PROJECTION`, `UI`, `DISCOVERABLE`, `STATE_COMPLETE`, `ACCESSIBLE`, `JOURNEY_PROVEN`, and `OWNER_ACCEPTED`. Internal primitives normally stop at `SERVICE`; machine consumers at `API` or `PROJECTION`; restricted operations at the safe privileged surface they require; ordinary human features at least at `JOURNEY_PROVEN`; major product-facing programs at `OWNER_ACCEPTED` when governance requires it.

### 7. Realization disposition

The closed dispositions are `USER_FACING`, `MACHINE_CONSUMER`, `INTERNAL`, `SECURITY_RESTRICTED`, `COMPATIBILITY`, and `DEPRECATED`. Internal and restricted rows require rationale. Restricted rows name the approved audience and, when applicable, the safe administrative or operational projection.

### 8. Primary classification

Each row has exactly one of `FULLY_REALIZED`, `PARTIALLY_REALIZED`, `BACKEND_ONLY`, `FRONTEND_ONLY`, `HIDDEN`, `INTERNAL_BY_DESIGN`, `SECURITY_RESTRICTED`, `MISSING`, `BROKEN`, or `DEPRECATED`.

`FULLY_REALIZED` requires current evidence through the expected terminal rung and no open blocking finding. Catalog `MAINLINE`, a route, a test, or a completion receipt is not sufficient by itself. User-facing rows without capability-specific natural-journey or owner evidence remain conservative. Internal and restricted rows are classified by intentional disposition rather than penalized for lacking ordinary UI.

### 9. Secondary flags

The closed flags are `UNVERIFIED`, `STALE_EVIDENCE`, `OWNERSHIP_AMBIGUOUS`, `LEGACY_DEPENDENT`, `EXTERNAL_PROVIDER_PENDING`, `VISUALLY_INCOMPLETE`, `JOURNEY_UNPROVEN`, and `DOCUMENTATION_MISMATCH`. Multiple flags may apply; they do not replace the primary classification.

### 10. Trace skeleton

Every row records domain, service, transport, authorization, projection, client, UI, navigation, accessibility, and journey layers. Each layer carries `VERIFIED`, `PARTIAL`, `ABSENT`, `NOT_APPLICABLE`, or `UNKNOWN`, plus sanitized repository-relative references. Unknown is valid Phase 1 truth and is never upgraded from filename inference alone.

### 11. Evidence references

Evidence references carry a stable evidence ID, kind, repository-relative path or governed record ID, source SHA, and freshness state. Existing Homeport and Sounding Line evidence may support a trace only within its stated local, synthetic, browser, staging, provider, deployment, and owner boundary. Deepwater never manufactures screenshots, journey results, or owner decisions.

### 12. Finding generation

Phase 1 opens findings only for obvious, high-confidence capability loss, material catalog mismatch, duplicate authority, privacy/authorization concern, backend-only ordinary behavior, hidden ordinary behavior, or materially broken/false realization. Uncertain clues remain trace uncertainty or Phase 2 queue reasons rather than speculative findings.

### 13. Finding severity

Severity is `CRITICAL`, `HIGH`, `MEDIUM`, or `LOW`. Security, privacy, authorization, and data-loss risk outrank aggregate scoring. Other severity considers user impact, breadth, frequency, discoverability, critical workflow impact, and dependency blocking.

### 14. Finding confidence

Confidence is `HIGH`, `MEDIUM`, or `LOW`. Phase 1 findings normally require `HIGH` or `MEDIUM`. Low-confidence observations are queued for tracing unless immediate safety warrants a finding.

### 15. Privacy and redaction

The ledger and evidence may contain repository paths, schema/model names, route patterns, governed IDs, and sanitized summaries. They must not contain passwords, password hashes as values, tokens, invitation secrets, OAuth secrets, raw object credentials, KMS material, private Chronicle prose or answers, private media, raw databases, cookie values, or unnecessary personal information. Validation scans all generated Deepwater artifacts for forbidden patterns.

### 16. Active projects and concurrency

Phase 1 audits accepted main only. It may name an active owner project and assign a finding, but it does not consume unaccepted branch code or remediate another project's source. If main advances, only capabilities affected by intervening paths are refreshed, followed by a recorded reconciliation.

### 17. Stale evidence

Evidence is stale when its bound source does not match the audited source and the changed area can affect the claim. A historic SHA is not automatically discarded; it remains bounded evidence with `STALE_EVIDENCE` when impact is plausible. Sounding Line decides which proof must rerun for acceptance.

### 18. Deterministic generation

Audit inputs are the explicit Deepwater registry, Feature Catalog fragments, ownership map, audit config, accepted Homeport inventories, accepted Sounding Line registries, and current source census. Capability and finding IDs are explicit. Outputs sort by stable IDs, normalize arrays, avoid wall-clock timestamps in semantic records, and use a config-declared audit date. Re-running against identical inputs and source SHA must produce byte-identical semantic JSON and reports.

### 19. Ledger validation

Validation enforces the JSON schema plus uniqueness, known owners or explicit ambiguity, valid rungs/classifications/flags/dispositions, catalog referential integrity, finding referential integrity, ownership-map agreement, required internal/restricted rationale, user-facing full-realization evidence, blocking-finding exclusion, closure/debt evidence, source binding, deterministic ordering, and privacy scanning.

### 20. Phase 2 queue

The queue is generated from blocking findings and conservative realization gaps. Priority order is security/privacy/authorization first, then `BROKEN`, `FRONTEND_ONLY`, high-impact `BACKEND_ONLY`, hidden ordinary behavior, serious partial realization, ownership ambiguity, documentation mismatch, state loss, and cross-project seams. Queue records include loss layer, owner, severity, confidence, present evidence, missing evidence, and active-project considerations.

### 21. Feature Catalog reconciliation

Phase 1 compares catalog claim, source existence, route/screen/journey evidence, owner, role/privacy, and Deepwater classification. It does not erase history or change feature capability. Confirmed metadata mismatches are recorded in Deepwater findings and the audit report. Because Phase 1 adds only audit/governance capability, no existing Feature Catalog fragment is changed unless the completed Deepwater control plane itself meets catalog governance after acceptance.

### 22. Reports and metrics

Metrics are generated from the ledger and findings, never hand-counted. They include all required classification and flag counts, owner and terminal-rung distributions, finding severity, user-facing evidence gaps, catalog coverage, initial realization coverage, natural-journey coverage, and owner-mapped coverage. Ratios support prioritization and do not override safety judgment.

## Mainline Safety Contract

| Field                 | Phase 1 contract                                                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Post-phase capability | Deterministic capability inventory, realization ledger, ownership map, findings, reports, trace queue, and validation tooling |
| Active behavior       | Repository-only audit commands and validation                                                                                 |
| Dormant behavior      | All later Deepwater tracing and remediation phases                                                                            |
| Compatibility         | No product compatibility path changes                                                                                         |
| Future work           | Phase 2 performs deep traces from a fresh accepted-main branch                                                                |
| Schema impact         | None; Prisma schemas and migrations are out of scope                                                                          |
| Rollback/disable      | Audit tooling can be removed without product/runtime/data effect                                                              |
| Permanent-stop test   | Voyagewright continues exactly as before; the ledger remains useful if no later phase occurs                                  |
| Failure path          | Validation fails closed and leaves product state untouched                                                                    |

## Completion criteria

Phase 1 is complete only when every current Feature Catalog entry maps to a ledger row or governed parent, meaningful uncataloged capabilities have intentional dispositions, every row has owner or explicit ambiguity, expected rung, classification, confidence, and trace skeleton, obvious material findings exist, all required control files and reports validate, focused Sounding Line evidence is source-bound, documentation and feature validation pass, current main is reconciled, and the governed integration path either accepts the phase on main or produces an exact external/policy convergence blocker.

Phase 1 does not claim that all capabilities are fully traced, all findings are closed, Deepwater is complete, the product is deployed, or Homeport owner acceptance has occurred.
