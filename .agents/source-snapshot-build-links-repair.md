---
title: Source snapshot and Windows development build link repair
audience: automation
status: implementation-candidate
canonical_for: source-snapshot-build-links-repair-20261021
last_reviewed: 2026-10-21
---

# Source snapshot and Windows development build link repair

Implement the two necessary Sounding Line infrastructure corrections for the
existing Parallax integration owner. The candidate is reconciled to accepted main
`fc5855f465314fa2c80c3a8966f8b6ce405f010a` in its existing owned D worktree. The
independent documentation follow-up #786 may qualify concurrently. Preserve its
38 historical migration rows as that owner's scope until accepted; retain every
accepted row when regenerating the inventory. Freeze and independently review the
exact candidate before normal protected qualification. Merge requires fresh main
ancestry and requalification if accepted source changes.

Keep complete source selection, all historical JSON, entry and Map order, UTF-8
conversion and the existing 128 MiB per-call bound. Read bounded exact blob
metadata, partition complete framed objects deterministically, and reject invalid,
missing, oversized, truncated or misordered responses. Do not increase the bound,
filter inputs, retry or return a partial snapshot. Diagnostic recognition adds
only the exact product-source `cat-file --batch-check` shape with object-ID stdin.

Accept only canonical absolute Windows directory links contained strictly inside
the same workspace's `node_modules`; copy those links with native junction
semantics. Preserve relative links, POSIX absolute-link rejection, identity and
literal checks, source/dependency fingerprints and supervised cleanup. Never
traverse or chmod dependency link targets during build immutability.

Use synthetic real-Git and native filesystem regressions, full independent content
comparison on the diagnosed immutable consumer revision, exact-source review,
normal protected Linux qualification and independent landed verification. Preserve
all original failed preparations and evidence. These corrections grant no consumer
capture, review, replay, qualification, retry, custody or counter action. The
development report/closed-log retention correction and consumer attachment patch
have separate scopes; do not fold them into this repair without a fresh review.

[Engineering diagnosis and proof](../Development_Docs/Engineering/Sounding_Line_Source_Snapshot_And_Windows_Build_Links_Repair.md).
