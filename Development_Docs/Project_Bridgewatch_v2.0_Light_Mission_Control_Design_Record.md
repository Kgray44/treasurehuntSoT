---
title: Project Bridgewatch v2.0 Light Mission Control Design Record
audience: engineering
status: active-implementation
canonical_for: project-bridgewatch-v2-light-mission-control
last_reviewed: 2026-08-27
---

# Project Bridgewatch v2.0 — Light Mission Control

## Governing scope and preserved plateau

This record governs the supplied **v2.0 Phase 3 — Light Mission Control**
product scope. It is a presentation, intelligence, discoverability, and final
product-acceptance increment built on the accepted Bridgewatch observer and
the v1.2 P2 bounded data fabric. It does not reopen or renumber the accepted
Bridgewatch Phase 1 _Raise the Board_, Phase 2 _Wire the Signals_, or Phase 3
_Keep the Watch_ records.

The v2.0 label is a first-class version/increment identity. The retained
project data model has no separately source-bound v2.0 Phase 1 or Phase 2
record, so this record does not invent them, add a duplicate phase ordinal, or
claim a new phase denominator. The governing scope supplied for this work is
the authority for its v2.0 Phase 3 name. The accepted P1/P2 source fabric and
observation coverage remain the implementation plateau.

Bridgewatch remains private, read-only, and observational. It does not create,
approve, merge, retry, cancel, deploy, release, queue, schedule, or mutate
projects, workers, tests, GitHub, Sounding Line, Voyagewright, providers, or
product data. Existing machine-only activity telemetry remains activity-only
and does not establish lifecycle or release truth.

## Mission Control information architecture

The static browser client uses History API-compatible hash deep links and the
following stations:

| Station                | Operator question                                                                            | Bounded sources                                                      |
| ---------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Fleet Overview         | What is active, accepted, observed, or requiring attention now?                              | Program totals, current main, retained recent transitions, attention |
| Active Operations      | What worker, controller, queue-front, and test activity is currently retained?               | Telemetry, Nightwatch projection, Sounding Line                      |
| Mainline               | What candidate, current-main, decision, cleanup, or train evidence is retained?              | Local Git, GitHub, Sounding Line                                     |
| Verification           | What did verification observe, including no-go, blocked, retry, and missing evidence states? | Sounding Line projection and attention                               |
| Projects               | What is the source-bound lifecycle of each project/version/phase?                            | Registry, discovery, GitHub, retained history                        |
| Repository             | Which bounded branches, pull requests, and workflows are observed?                           | GitHub GET cache                                                     |
| Product Intelligence   | What catalog, governing, registry, and capability evidence is actually available?            | Feature Catalog, governing index, registry, Deepwater evidence       |
| Voyagewright Runtime   | What host-approved runtime/schema/provider status is available?                              | Runtime identity, schema inventory, provider projection              |
| Sources & Data Quality | Which adapters and fact classes are healthy, stale, unavailable, or unrecorded?              | All fixed P2 sources and coverage                                    |
| History                | What changed in the retained bounded window and comparison range?                            | Events, snapshots, rollups                                           |
| Attention              | Which explainable, source-bound conditions require operator awareness?                       | Derived from the preceding observations                              |

Project profiles are deliberately dense and hierarchical: identity and
governing status; phases and candidate/main relationships; versions;
repository branches and pull requests; Sounding Line runs; worker activity;
attention; product/capability evidence; provenance; and retained history. A
field is shown only from a supporting source. Dependency mapping, capability
realization mapping, deployment ancestry, and historical fields without a
source remain visibly `NOT_RECORDED`, `UNKNOWN`, or explicitly limited.

## Attention contract

`deriveOperatorAttention` is a pure presentation projection over bounded facts.
Each item has a severity, stable code, operator-facing title, explanation,
optional project association, and source ID/reference/observation time/state.
It can report source disconnection/staleness, missing expected fact classes,
blocked or stale pull requests, stalled candidates, verification failures or
no-go decisions, worker conditions, branch divergence/aging, runtime identity
that differs from observed current main without inferring ancestry, configured
provider degradation, and history persistence loss.

Schema/migration disagreement and backend-to-product realization are not
invented. The dashboard reports the available schema inventory and capability
evidence; it can report their source loss or a stated evidence gap, but it does
not infer a deployed schema state or product-realization relationship from
counts, commits, or prose.

## Presentation and accessibility contract

The desktop layout prioritizes a compact command deck, station navigation,
small metric cards, grouped detail cards, bounded searchable tables, explicit
empty/degraded states, and source references. Tables retain headers and a
horizontal wrapper; mobile has a narrower shell, wrapped navigation, and
single-column details. Native buttons and links support keyboard navigation;
search and date controls have accessible names; focus remains visible; and
reduced-motion preferences disable transitions and scrolling animation.

No unavailable source or fact is hidden to improve the dashboard's apparent
health. `UNAVAILABLE`, `STALE`, `UNKNOWN`, `NOT_CONFIGURED`,
`NOT_HISTORICALLY_RECORDED`, and `PROVISIONAL` remain distinct display states.

## Validation and closure contract

Before one final candidate, run focused attention/UI/source tests, Bridgewatch
validation and build, the current gateway test, documentation and Feature
Catalog validation, task-owned live loopback browser acceptance, desktop and
mobile layouts, keyboard checks, and accessibility scanning. The live stack
must use actual local repository observations and must report locally available
degraded/unconfigured sources truthfully.

Only after the current-main reconciliation may this increment have one frozen
candidate, an ordinary candidate-bound Sounding Line / Mainline Decision,
protected merge, landed Mission Control smoke, and a v2.0 closure record. This
record does not itself claim any of those completion gates and does not
authorize Bridgewatch Phase 4.
