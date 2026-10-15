---
title: SC-00C paged Library component and installed content handoff
audience: product-engineering
status: implementation-in-validation
canonical_for: sc-00c-paged-library-component-handoff
last_reviewed: 2026-10-15
---

# Paged Library component and installed content handoff

The Library component now has an optional `PAGED` mode. It requests 48 compact cards per page from the account-scoped `library-catalog` view, sends search, source, state, sort and parent Environment filters to the server, and loads one verified full record from `library-item` after selection. Actions that need a full owned record wait for that exact read. A changed query aborts the prior request; a stale catalog cursor produces a refresh path. The original full mode remains available until the combined Spatial Studio host activates the new mode.

SC-07A's pinned installation summary has a pure presentation adapter. It maps local installed Spatial or Environment targets to Library identities, carries release version, license and attribution, and marks them read-only. A separate collector consumes all pages from SC-07A's owner-scoped reader at its 200-installation page limit before global Library filtering. Repeated cursors and duplicate local targets fail explicitly; there is no first-page truncation. Ordinary owner summary pages exclude `INSTALLED_READ_ONLY` Spatial records so they cannot appear as private creations. Exact selected Spatial reads retain a read-only marker. The component hides owner mutation actions for installed content, labels the pinned Community release, and says when the Community summary has no preview. The adapter and collector do not read packages or create a second installation authority.

This branch does not yet call SC-07A's `readInstalledSpatialCommunitySummaryPage`, because that source is owned by SC-07A and must be integrated in the combined branch. The combined API must read all installation pages before global filtering, avoid duplicate Environment cards if the ordinary Environment provider also returns an installed target, and resolve an installed Environment exact read through SC-01's canonical Environment service. The combined Spatial Studio host must activate `catalogMode="PAGED"` and invalidate it after mutations. Those integrations, rendered browser journeys, protected qualification and owner acceptance remain pending.

Focused Vitest checks cover two Library page loads totaling 50 entries, exact-read action gating, installed read-only actions and provenance text, installed adapter identity/provenance mapping, owner summary exclusion, collection of 201 installed entries across two reader pages, and rejection of repeated cursors or duplicate local targets. Ten tests passed across the three focused files. TypeScript and changed-file ESLint passed. This is local component and service proof; the earlier [synthetic 1,000-Scene scale observation](evidence/sc-00c/20261015-catalog-scale/README.md) is a service measurement rather than rendered browser performance.
