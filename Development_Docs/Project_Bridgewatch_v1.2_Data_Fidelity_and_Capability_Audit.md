---
title: Project Bridgewatch v1.2 Data Fidelity and Capability Audit
audience: engineering
status: active-implementation
canonical_for: project-bridgewatch-v1.2-data-fidelity-audit
last_reviewed: 2026-08-16
---

# Project Bridgewatch v1.2 — Data Fidelity and Capability Audit

## Scope and status

This implementation audit tracks the v1.2 amendment only. Project Bridgewatch
Phase 1–3 accepted records remain historical authority. `COMPLETE` below means
implemented and covered by the named local source/tests on the v1.2 branch; it
does not mean protected-main integration, a live provider, or deployment.

## Owner issue ledger

| #   | Required capability                                                                             | Audit result                                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Discover projects and programs from bounded repository evidence.                                | `COMPLETE` — `bridgewatch/src/repository-evidence.ts` and `bridgewatch/src/discovery.ts` read only indexed documents and fixed Git refs.           |
| 2   | Do not use a new static project/version constant as truth.                                      | `COMPLETE` — the static registry is reconciled bootstrap history; `v1.2` is discovered from branch/document evidence.                              |
| 3   | Infer project/version lifecycle from project-bound documents, branches, and PRs.                | `COMPLETE` — pure discovery/reconciliation tests cover governing, branch, and PR evidence.                                                         |
| 4   | Associate PRs with projects, versions, and phases where evidence supports it.                   | `COMPLETE` — `/api/pull-requests/:number` emits explicit associations and unclassified absence.                                                    |
| 5   | Distinguish document revisions from project versions.                                           | `COMPLETE` — discovery tests reject a revision/dependency number as a version.                                                                     |
| 6   | Preserve ambiguous candidates as unclassified activity.                                         | `COMPLETE` — discovery persists bounded ambiguous branch/PR evidence rather than promoting it.                                                     |
| 7   | Migrate existing Bridgewatch history without reset or loss.                                     | `COMPLETE` — additive migration 4 follows migrations 1–3; migration tests open prior schema history.                                               |
| 8   | Use normalized relational rows for durable observation entities/relations.                      | `COMPLETE` — migration 4 adds discovered project/version/phase/evidence, observed PR/branch, unclassified activity, and source-observation tables. |
| 9   | Keep pre-migration data usable and accepted evidence non-prunable.                              | `COMPLETE` — retained registry, project history, event, snapshot, and completion paths remain compatible.                                          |
| 10  | Report source configuration, reachability, freshness, cache, retry, auth, and rate-limit state. | `COMPLETE` — source observation projection and GitHub collector expose safe operational fields.                                                    |
| 11  | Treat ProjectVersion as a first-class entity.                                                   | `COMPLETE` — domain, discovery, persistence, history events, and version profile endpoints are separate from phases.                               |
| 12  | Do not treat Phase as a synonym for Version.                                                    | `COMPLETE` — version/phase profile routes and historical-document tests preserve the distinction.                                                  |
| 13  | Render explicit status labels instead of invented truth.                                        | `COMPLETE` — UI uses source/project lifecycle text and `UNMEASURED` fallbacks.                                                                     |
| 14  | Reconcile historical records deterministically and idempotently.                                | `COMPLETE` — reconciliation preserves accepted Phase 1–3 facts and tests provisional discovery.                                                    |
| 15  | Preserve accepted, merge, mainline, receipt, and final-decision evidence immutably.             | `COMPLETE` — retained project/phase histories remain source-owned and mutation-free.                                                               |
| 16  | Provide Overview, Program, Projects, Operations, GitHub, Attention, History, and Sources views. | `COMPLETE` — named hash stations are rendered by `bridgewatch/public/app.js`.                                                                      |
| 17  | Give a selected project complete status, version, phase, history, and evidence detail.          | `COMPLETE` — project, version, and phase GET profiles are independently tested.                                                                    |
| 18  | Keep dense views responsive, keyboard-focusable, reduced-motion aware, and phone-safe.          | `COMPLETE` — station CSS covers wrapping, focus visibility, responsive grids, and reduced motion.                                                  |
| 19  | Offer read-only deep actions for projects, versions, phases, PRs, branches, sources, and runs.  | `COMPLETE` — hash routes lead only to bounded GET profiles.                                                                                        |
| 20  | Exclude write/control buttons from the dashboard.                                               | `COMPLETE` — UI has no lifecycle, GitHub, worker, Sounding Line, or deployment mutation path.                                                      |
| 21  | Keep Overview compact and suppress polling noise in recent changes.                             | `COMPLETE` — `conciseRecentChanges` tests prioritize governed events and hide source/branch churn.                                                 |
| 22  | Compare arbitrary bounded From/To windows with exact or coarse fidelity.                        | `COMPLETE` — `/api/compare` distinguishes `EXACT`, `ROLLUP`, and `COARSE` evidence.                                                                |
| 23  | Expose deep profile endpoints for PRs, branches, sources, and Sounding Line runs.               | `COMPLETE` — server integration tests cover each GET resource and reject POST.                                                                     |
| 24  | Keep `/bridgewatch` capability-gated and proxy only allowlisted GET/HEAD routes.                | `COMPLETE` — gateway/NGINX tests cover mounted routes, header stripping, and negative paths.                                                       |
| 25  | Refresh the dashboard from live bounded APIs while retaining static no-dependency delivery.     | `COMPLETE` — route rendering requests only the standalone Fastify GET API.                                                                         |
| 26  | Break source health down by GitHub, project truth, Sounding Line, and reporter.                 | `COMPLETE` — summary and source profiles expose the four distinct source rows.                                                                     |
| 27  | Show current and historical GitHub PR observation without mutating GitHub.                      | `COMPLETE` — collector requests `state=all`; list filters and profiles are GET-only.                                                               |
| 28  | Support browser navigation, Back/Forward, keyboard focus, and mobile layout.                    | `COMPLETE` — hashchange navigation and accessible station links are covered by focused UI tests.                                                   |
| 29  | Preserve last-known-good data and make source failures visible.                                 | `COMPLETE` — collector degradation records cache age/retry/detail instead of blanking projections.                                                 |
| 30  | Provide Windows start/status/restart/stop with strict process ownership proof.                  | `COMPLETE` — `bridgewatch/scripts/bridgewatch-lifecycle.ps1` records/validates only its own PID and checks `/healthz`.                             |

## Deliberate non-claims

This audit makes no claim of Phase 4, mainline acceptance, production listener
operation, live GitHub provider success, owner approval, deployment, or a
Sounding Line release decision. Those require separate current-candidate
evidence and protected-main reconciliation.
