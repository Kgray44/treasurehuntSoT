---
title: Architecture
audience: developer
status: current
canonical_for: system-architecture
last_reviewed: 2026-08-09
---

# Architecture

Chronicles is a Next.js application with route-level role surfaces, domain modules, service boundaries, Prisma persistence, and a typed presentation layer. `src/app` owns routing; `src/chronicle`, `src/platform`, `src/wayfarer`, `src/community`, `src/private-content`, and `src/tideglass` represent major domains; `prisma` defines SQLite and MySQL schema paths.

Player, Captain, and Studio routes consume domain services rather than treating
UI state as authorization. True North provides the persistent role-aware
navigation shell; Wayfarer owns personal history, consent, artifacts, and
achievements; Harborlight owns community exchange and Phase 3 social/discovery
projections. Publishing creates immutable versions for stable play.

Tideglass reads two exact immutable published editions through a server-authorized repository port, verifies their stored-byte checksums, normalizes supported snapshot schemas into one comparison-only semantic model, and emits deterministic redacted Change Sets and receipts. It has no business persistence and does not mutate publication, Voyage, personal-history, or Community state. Phase 1 exposes only a trusted local diagnostic seam; route and user-interface activation belong to later governed phases.

Private-content workflows retain separate authorization, scanning, storage,
recovery, protected-media, grant, derivative, and withdrawal concerns. Local
and integration tests establish repository behavior, while live providers,
production MySQL, and deployment remain external validation. See [domain
ownership](domain-ownership.md), [database](database-and-migrations.md), and
[security architecture](security-architecture.md).
