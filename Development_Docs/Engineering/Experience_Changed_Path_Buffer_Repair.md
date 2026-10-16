---
title: Experience changed path buffer repair
audience: engineering
status: prepared-awaiting-protected-qualification
canonical_for: experience-changed-path-buffer-repair-20261016
last_reviewed: 2026-10-16
---

# Experience changed path buffer repair

Accepted main `151417a772c1bcde4e5c7f256302b803d25d40da` reads the
experience command's complete Git changed-path output with Node's default
1,048,576-byte subprocess output limit. The metadata-only comparison to
Parallax candidate `6a6fbd733514a58ad8ade4023ada81720dc461a2` contains
9,319 paths and 1,201,844 bytes (SHA-256
`5456cf922023c0698b34b9e93bf8d33a3a62ec8a64cfb48a4827ef1c683a1495`).
That output exceeds the limit before the experience planner can run.

`experienceChangedPaths` keeps the same Git command, complete output and parser,
with an explicit finite 64 MiB limit matching existing experience source readers.
Preparation uses the same reader. Ordinary qualification's Git text reader and
NUL-delimited tracked-tree reader receive the same bound; the latter's full tree
inventory also exceeds Node's default for this repository.
Overflow and Git failure throw before planning. No paths, contracts or evidence
requirements are filtered or weakened.

The regression constructs real Git trees with 8,192 long paths without creating
product files. The old subprocess boundary fails with `ENOBUFS`; the corrected
reader returns every expected path in order without duplicates. The same real
fixture reproduces tracked-tree overflow and verifies every parsed path, blob
and type. Invalid revisions
remain errors. All 99 product-experience and ordinary regressions pass locally. These checks
execute no consumer plan, application, browser, capture or protected workflow.

This is an isolated infrastructure correction. Its independent review and exact
candidate qualification remain required. Installation is sequenced after #721's
accepted merge and landed verification, before #722's final accepted-base freeze.
Any resulting candidate change needs fresh exact-source review and qualification.
No consumer proof allowance, historical receipt or protected-main decision is
issued by this preparation. Feature Catalog: no capability change.
