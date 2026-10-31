# SC-07A Spatial Publishing recovery on protected main

**Source:** protected `main` `f7ef7de4b606eec734d04eeaed316fea959cf80e` (the #776 merge); source PR #736 head `9c6de12a34f7391607eb26df37752dcdc82c60ed`.

## Current-main disposition

The canonical publish route, preflight route, package projection, publication service, moderation service, installation service and reuse-rights service already exist on protected main. The first six are byte-identical to #736; the reuse-rights service is also byte-identical. The current-main Library and publisher UI have subsequent integration changes. Copying #736's broad branch would duplicate working code and overwrite those changes.

Current main supports saved owned Assets, procedural Effects, source-matched Compositions, Scenes with eligible pinned Environments, and eligible standalone synthetic Environments. A saved Scene without a pinned Environment is represented as a self-contained Spatial asset release. Preflight re-reads the exact saved revision, verifies checksums, projects allowlisted JSON and binds the review digest to content, listing, license and attribution. Submission scans the projected files, creates an immutable package and release, and waits for independent moderator approval. Discovery and installation use approved releases, checksum pins and read-only Library copies. Private reuse checks the pinned release's modification and attribution rights.

The source still deliberately refuses photo-derived or measured rooms, private Vision/calibration references, fixed worldspace anchors, unresolved physical/media rights, placed reusable assets without pinned redistribution rights, installed read-only sources, and arbitrary remix lineage. This recovery does not reinterpret those refusals as missing features.

## Confirmed gap and focused correction

Before this branch, the three `/api/community/spatial-publication/*` Creator endpoints accepted an account-rooted session without checking the active Creator workspace. The Studio source editor requires that workspace, so a direct request from an account with an owned saved item and public Profile could bypass the Creator transition lock. The routes now use `requireStudioWorkspace`; preflight and submission retain their explicit CSRF check. The services' package, rights and release behavior are unchanged.

## Focused verification

- `src/app/api/community/spatial-publication/authorization.test.ts`: blocked Creator access cannot reach listing, preflight or publish services; CSRF denial and authorized account forwarding are covered.
- `src/community/spatial-package.test.ts`: public projection and deliberate privacy/rights refusals remain covered.
- Focused Vitest: 16/16 passed (two files).
- Targeted ESLint: passed.
- Full TypeScript check: passed after restoring the source JSON registries needed by the sparse checkout.
- Product Experience planner on this current-main delta: `PRODUCT_EXPERIENCE_INTEGRATION_SCOPE_REQUIRED:parallax.integration.pilot-owner-boundary`. Combined capture and independent experience review remain with Spatial Integration; this focused branch does not claim that gate.
- Current-main production Chromium publishing journey: record result and exact candidate in the PR handoff after the isolated run.

The first TypeScript attempt failed only because the sparse worktree omitted imported registry JSON. Those small tracked directories were restored; the passing rerun used the same product changes. This recovery does not claim physical-device privacy, live scanner-provider behavior, formal Product Experience acceptance or owner approval.

## Spatial Integration handoff

The Integration owner retains `SpatialStudio.tsx`, Scene Manager, Inspector, Spatial Library UI and shared Parallax authoring routes. Current `SpatialContentLibrary.tsx` chooses the saved source kind/revision and shows publication state; `SpatialCommunityPublisher.tsx` performs license selection, rights review, server package review, submission, retry and return. The new 403 from the Harborlight routes is surfaced through the publisher's existing error path if Creator access changes while the dialog is open. Integration should inspect that transition in the combined journey and decide any contextual UI change there. This branch makes none.

For final #736 closure, reconcile the current-main Library/publisher UI against the desired saved-item entry and return paths, rerun combined Creator-to-Community-to-installed-Library acceptance with an independent reviewer, and preserve the deliberate rights refusals above. This document and the recovery PR are focused Harborlight evidence; they do not decide #736's combined product acceptance.
