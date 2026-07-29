---
title: Architecture
audience: developer
status: current
canonical_for: system-architecture
last_reviewed: 2026-07-29
---

# Architecture

Chronicles is a Next.js application with route-level role surfaces, domain modules, service boundaries, Prisma persistence, and a typed presentation layer. `src/app` owns routing; `src/chronicle`, `src/platform`, `src/wayfarer`, `src/community`, and `src/private-content` represent major domains; `prisma` defines SQLite and MySQL schema paths.

Player, Captain, and Studio routes consume domain services rather than treating
UI state as authorization. True North provides the persistent role-aware
navigation shell; Wayfarer owns personal history, consent, artifacts, and
achievements; Harborlight owns community exchange and Phase 3 social/discovery
projections. Publishing creates immutable versions for stable play.

Private-content workflows retain separate authorization, scanning, storage,
recovery, protected-media, grant, derivative, and withdrawal concerns. Local
and integration tests establish repository behavior, while live providers,
production MySQL, and deployment remain external validation. See [domain
ownership](domain-ownership.md), [database](database-and-migrations.md), and
[security architecture](security-architecture.md).
