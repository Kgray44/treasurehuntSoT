---
title: Architecture
audience: developer
status: current
canonical_for: system-architecture
last_reviewed: 2026-08-12
---

# Architecture

Chronicles is a Next.js application with route-level role surfaces, domain modules, service boundaries, Prisma persistence, and a typed presentation layer. `src/app` owns routing; `src/chronicle`, `src/platform`, `src/wayfarer`, `src/community`, `src/private-content`, and `src/tideglass` represent major domains; `prisma` defines SQLite and MySQL schema paths.

Player, Captain, and Studio routes consume domain services rather than treating
UI state as authorization. True North provides the persistent role-aware
navigation shell; Wayfarer owns personal history, consent, artifacts, and
achievements; Harborlight owns community exchange and Phase 3 social/discovery
projections. Publishing creates immutable versions for stable play.

`src/admiralty` owns platform-administration capability resolution,
session-bound privileged assurance, scoped Support Access, safe administrative
projections, and administrative audit composition. It consumes canonical
identity, session, credential, role, Chronicle, Community, and private-content
authorities without replacing them. `/admin` is a privileged direct-entry
surface; `/account/support-access` remains an ordinary account-owner consent
surface.

Tideglass reads two exact immutable published editions through a server-authorized repository port, verifies their stored-byte checksums, normalizes supported snapshot schemas into one comparison-only semantic model, and emits deterministic redacted Change Sets and receipts. Phase 2 layers versioned classification, significance, compatibility, summaries, audience projections, and a bounded digest-validating cache over that unchanged Phase 1 truth. Its only business persistence is the immutable `TideglassCreatorAnnotation` revision chain plus existing platform audit evidence. Phase 3 adds a server-projected Chronicle comparison route, owner-checked Passport history handoff, and Creator semantic consumer on main; it does not add raw snapshot delivery, new history persistence, or live-Voyage mutation.

Private-content workflows retain separate authorization, scanning, storage,
recovery, protected-media, grant, derivative, and withdrawal concerns. Local
and integration tests establish repository behavior, while live providers,
production MySQL, and deployment remain external validation. See [domain
ownership](domain-ownership.md), [database](database-and-migrations.md), and
[security architecture](security-architecture.md).
