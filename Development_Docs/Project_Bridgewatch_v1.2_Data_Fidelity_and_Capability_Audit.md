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

The owner-issue ledger uses only the three terminal labels required by the
brief. `NOT_SUPPORTED_BY_AVAILABLE_EVIDENCE` is not a product excuse: it names
the precise unavailable historical source and requires the UI to report the
field as `NOT_RECORDED` or `UNMEASURED`, never to fabricate it.

## Owner issue ledger

| # | Owner-identified acceptance item | Terminal result |
| --- | --- | --- |
| 1 | Replace giant page with stations/tabs/pages. | `COMPLETE` — the eight named stations are hash-routed Mission Control views. |
| 2 | Standalone highly detailed project profiles. | `COMPLETE` — project profiles retain status, phases, versions, evidence, history, workers, tests, PRs, and branches. |
| 3 | Slightly improve readability without changing the aesthetic drastically. | `COMPLETE` — dark monospace visual language remains, with responsive grids, table wrapping, focus, and reduced-motion treatment. |
| 4 | Automatic project discovery. | `COMPLETE` — bounded repository, GitHub, and retained observations are reconciled deterministically. |
| 5 | Governing-document project discovery. | `COMPLETE` — indexed governing titles/frontmatter establish project identity. |
| 6 | Governing-document phase-count discovery. | `COMPLETE` — explicit phase titles/sections establish a declared denominator without prose inference. |
| 7 | Automatic version discovery. | `COMPLETE` — document, branch, and PR evidence produces first-class `ProjectVersion` records. |
| 8 | Bridgewatch v1.2 self-discovery. | `COMPLETE` — the v1.2 governing/design evidence and branch are discovered as `IN_DEVELOPMENT`, not a registry constant. |
| 9 | Version display on project cards/profile. | `COMPLETE` — project rows and independent version profiles display observed version identities/lifecycle. |
| 10 | Arbitrary From/To historical comparison. | `COMPLETE` — bounded `/api/compare` and History controls preserve `EXACT`, `ROLLUP`, or `COARSE` fidelity. |
| 11 | Fix useless `Progress: UNMEASURED`. | `COMPLETE` — project cards show an explicit measured phase numerator/denominator or `NOT_RECORDED`, not a misleading progress label. |
| 12 | Fix `Main: UNMEASURED` where reconstructable. | `COMPLETE` — accepted final-main SHAs are backfilled from completion records; unsupported records render `NOT_RECORDED`. |
| 13 | Separate status badge and phase progress on cards. | `COMPLETE` — project state and phase progress are independent card/table columns. |
| 14 | Richer Branch section. | `COMPLETE` — searchable branch view and deep profile include association, divergence, activity, attention, and evidence. |
| 15 | Open + historical PR views. | `COMPLETE` — the PR station provides Open, Historical, and All filters over GET-only observations. |
| 16 | Standalone PR profiles. | `COMPLETE` — independent GET profile includes available metadata, associations, checks, history, evidence, and safe GitHub link. |
| 17 | Project association on PRs. | `COMPLETE` — explicit evidence-based project/version associations are returned; uncertain records remain unclassified. |
| 18 | GitHub `STALE` diagnostics/repair. | `COMPLETE` — source profiles state configuration, reachability, cache age, retry, auth class, rate limit, and sanitized failure detail. |
| 19 | Reporter `UNMEASURED` diagnostics/repair. | `COMPLETE` — reporter source states distinguish `NOT_CONFIGURED`, no active telemetry, retained telemetry, and stale telemetry. |
| 20 | Prettier Program History. | `COMPLETE` — bounded rich event rows carry entity/type badges, timestamps, evidence context, and client filtering. |
| 21 | Prettier All-Time Accepted History. | `COMPLETE` — Program’s accepted timeline is distinct from live discovery and renders retained governed transitions. |
| 22 | Distinguish no active workers from missing history. | `COMPLETE` — active worker count and retained worker/task records are independently reported. |
| 23 | Phase-level tasks/workers. | `COMPLETE` — phase profile projects telemetry into retained task records with worker, branch, timing, result, and evidence. |
| 24 | Phase-level Sounding Line runs. | `COMPLETE` — phase profiles show retained runs whose source SHA exactly matches accepted/integrated phase identity. |
| 25 | Phase-level detailed tests. | `COMPLETE` — retained node data supplies suite, counts, failures, blocks, retries, root failures, and resources; unsupported fields remain `UNMEASURED`. |
| 26 | Backfill `Not recorded`/`UNMEASURED` fields. | `NOT_SUPPORTED_BY_AVAILABLE_EVIDENCE` — legacy receipts do not retain every task/test/provider field; recoverable main and lifecycle facts are backfilled, all other absent facts remain explicit. |
| 27 | Highly detailed repository Program page. | `COMPLETE` — program counts, observed main, discovery, accepted timeline, and a bounded history window are all independent read-only views. |
| 28 | Program page historical window filtering. | `COMPLETE` — Program exposes bounded From/To GET history with client-side retained-event filtering. |
| 29 | Project/version/phase evidence provenance. | `COMPLETE` — governing references and discovery evidence survive reconciliation and profile display. |
| 30 | Current Sounding Line v1.4 train awareness. | `COMPLETE` — v1.4 authority/candidate/tree/freshness/finalizer fields and retained train cars are projected when runtime evidence provides them. |

## Deliberate non-claims

This audit makes no claim of Phase 4, mainline acceptance, production listener
operation, live GitHub provider success, owner approval, deployment, or a
Sounding Line release decision. Those require separate current-candidate
evidence and protected-main reconciliation.
