---
title: SC-00C paged Library component and installed content handoff
audience: product-engineering
status: implementation-in-validation
canonical_for: sc-00c-paged-library-component-handoff
last_reviewed: 2026-10-15
---

# Paged Library component and installed content handoff

The Library component now has an optional `PAGED` mode. It requests 48 compact cards per page from the account-scoped `library-catalog` view, sends search, source, state, sort and parent Environment filters to the server, and loads one verified full record from `library-item` after selection. Actions that need a full owned record wait for that exact read. A changed query aborts the prior request; a stale catalog cursor produces a refresh path. The original full mode remains available until the combined Spatial Studio host activates the new mode.

SC-07A's pinned installation summary has a pure presentation adapter. It maps local installed Spatial or Environment targets to Library identities, carries release version, license and attribution, and marks them read-only. Ordinary owner summary pages exclude `INSTALLED_READ_ONLY` Spatial records so they cannot appear as private creations. Exact selected Spatial reads retain a read-only marker. The component hides owner mutation actions for installed content, labels the pinned Community release, and says when the Community summary has no preview. The adapter does not read packages or create a second installation authority.

This branch does not yet call SC-07A's `readInstalledSpatialCommunitySummaryPage`, because that source is owned by SC-07A and must be integrated in the combined branch. The combined API must read all installation pages before global filtering, avoid duplicate Environment cards if the ordinary Environment provider also returns an installed target, and resolve an installed Environment exact read through SC-01's canonical Environment service. The combined Spatial Studio host must activate `catalogMode="PAGED"` and invalidate it after mutations. Those integrations, rendered browser journeys, protected qualification and owner acceptance remain pending.

Focused Vitest checks cover two page loads totaling 50 entries, exact-read action gating, installed read-only actions and provenance text, installed adapter identity/provenance mapping, and owner summary exclusion. Nine tests passed across the three focused files. TypeScript and changed-file ESLint passed. This is local component and service proof; the earlier [synthetic 1,000-Scene scale observation](evidence/sc-00c/20261015-catalog-scale/README.md) is a service measurement rather than rendered browser performance.

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

The host still uses full mode. Canonical installed-provider fanout, source
deduplication, exact installed Environment reuse and eligible Community publishing
entry points must be wired before the combined paged browser journey. No browser,
protected, owner or complete Library qualification is claimed here.
