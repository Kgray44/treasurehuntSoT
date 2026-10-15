---
title: SC-00C paged Library component and installed content handoff
audience: product-engineering
status: implementation-in-validation
canonical_for: sc-00c-paged-library-component-handoff
last_reviewed: 2026-10-15
---

# Paged Library component and installed content handoff

The Library component has a `PAGED` mode, now enabled in the combined Spatial Studio host. It requests 48 compact cards per page from the account-scoped `library-catalog` view, sends search, source, state, sort and parent Environment filters to the server, and loads one verified full record from `library-item` after selection. Actions that need a full owned record wait for that exact read. A changed query aborts the prior request; a stale catalog cursor produces a refresh path. The original full mode remains available for compatibility.

SC-07A's pinned installation summary has a pure presentation adapter. It maps local installed Spatial or Environment targets to Library identities, carries release version, license and attribution, and marks them read-only. A separate collector consumes all pages from SC-07A's owner-scoped reader at its 200-installation page limit before global Library filtering. Repeated cursors and duplicate local targets fail explicitly; there is no first-page truncation. Ordinary owner summary pages exclude `INSTALLED_READ_ONLY` Spatial records so they cannot appear as private creations. Exact selected Spatial reads retain a read-only marker. The component hides owner mutation actions for installed content, labels the pinned Community release, and says when the Community summary has no preview. The adapter and collector do not read packages or create a second installation authority.

The earlier component-only handoff did not yet call SC-07A's installed reader. The combined root now adopts that reader from `9dfec95f5`, retaining its body and mapping the Environment kind import to the existing canonical legacy service. Its API collects every installation page before global filtering and replaces duplicate ordinary Environment/stale provider cards with the pinned installation projection. Exact Environment reads retain SC-01's checked compatibility records. Host loading and Environment refresh invalidate the paged query. Rendered combined journeys, protected qualification and owner acceptance remain pending.

Focused Vitest checks cover two Library page loads totaling 50 entries, exact-read action gating, installed read-only actions and provenance text, installed adapter identity/provenance mapping, owner summary exclusion, collection of 201 installed entries across two reader pages, and rejection of repeated cursors or duplicate local targets. Ten tests passed across the three focused files. TypeScript and changed-file ESLint passed. This is local component and service proof; the earlier [synthetic 1,000-Scene scale observation](evidence/sc-00c/20261015-catalog-scale/README.md) is a service measurement rather than rendered browser performance.

## Combined root detail-safety correction

Independent technical review of imported root `816a1153` identified two blockers
before enabling paged mode. Filtering could remove an installed Environment's
summary and with it the detail view's permission/provenance guards. An earlier
page summary could also override freshly read archive, membership, revision or
name fields. The root correction uses the exact checked record for lifecycle
state and keeps only installed presentation/provenance context separately from
page membership. Both Inspect and the card's Preview details command capture
that same context. Installed permission is also projected from the existing
canonical `INSTALLED_READ_ONLY` status onto the legacy Environment wrapper, so a
parent Environment opened outside the loaded page remains protected. Immutable
Environment contents, versions and references are unchanged.

Regressions cover an item archived after its card was read, installed Environment
filtering through both selection commands, and an installed parent outside the
loaded page. The first correction suite passes 26 checks/five files; the completed
menu-path suite passes 27 checks/five files. Independent source re-review resolves
`PX-PAGED-INSTALLED-GUARD-01` and `PX-PAGED-EXACT-STATE-01` against Library source
SHA256 `9a3eefe066faf0f0441160772626961844aa04505c6f033135e4eba471727a26`.
The reviewer inspected supplied logs without rerunning tests. A subsequent full
TypeScript check caught two unsupported Testing Library test options; removing
only those options restores typing without changing assertions. Both typing logs
are retained, and changed-source lint passes.

The root host now uses paged browsing, with installed-provider fanout and source
deduplication. Canonical installed Environment reuse and eligible Community
publishing entry points still need the remaining SC-07A integration and actual
consumer journeys. The initial workspace bootstrap and Scene Manager still load
full records. This change therefore makes no whole-payload, database-scalability
or reduction of the historical 11.98 MB bootstrap claim.

The initial host test run failed because its mocks returned workspace records for
the new catalog GET; the next run retained one old synchronous card selector.
Corrected fixtures model the separate views and wait for asynchronous browsing.
The completed source suite passes 38 checks/five files. A separate six-check
projection suite verifies the current wire contract for all five Library kinds.
These suites overlap. Reader regressions verify owner/status query scope and omit
corrupt manifest/package receipts, moderated releases and missing local targets.
Independent review found that container-only HTTP200 validation allowed null
entries and malformed preview marks to crash rendering. A client-safe strict
schema now rejects those payloads before state installation and presents a visible
Refresh action; both regressions pass and source re-review resolves the finding.
No browser, protected, owner or complete Library qualification is claimed here.

## Combined browser filter transition repair

The first twelve-journey combined production run at
`a885b6c3481f1f3c93769addf65417f46c53d5c5` passes eleven journeys and fails the
composition-reuse journey. The original [attempt 3 packet](evidence/sc01/root-integration-20261015/studio-browser-attempt3/packet.json)
retains 104 artifacts, including the failed screenshot and complete recordings;
its SHA256 is `0b56d8d10562de238142db746757173dcad3551158e42f7639ab48412f8061f3`.
Build/type checking and owned cleanup pass. The failed selector saw both built-in
and saved cards immediately after choosing My Creations; the later error capture
showed only the saved card. This exposed a real transient stale-page action window,
not a persistent server-filter failure or a passing overall suite.

Pages are now bound to the complete current query identity, including filters,
catalog revision and reload token. Prior-query cards, totals and continuation
cursors are unavailable synchronously while replacement results are pending;
append is permitted only within the same query. Capability metadata is retained
so Effects/Compositions tabs and Source choices stay present, and pending feedback
replaces an empty-results flash. Exact selected-item permission/provenance remains
independent of page membership. A deferred-response regression checks the immediate
old-card refusal, loading feedback, retained navigation and final saved-only card;
ten focused component checks pass. Independent source review confirms the stale
action/cursor repair and identified the subsequently repaired capability-metadata
continuity issue. Fresh affected-browser evidence remains required.
