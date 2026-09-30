---
title: Project Landfall Phase 1 Test Plan
audience: product-engineering
status: current
canonical_for: project-landfall-phase-1-test-plan
last_reviewed: 2026-09-30
---

# Phase 1 Test Plan

## Focused qualification

Run `npx vitest run src/landfall src/drydock/landfall-adapter.test.ts src/drydock/adapters.test.ts src/chronicle/snapshot.test.ts src/chronicle/published-snapshot-security.test.ts src/app/api/studio/tales/'[taleId]'/landfall/route.test.ts` after coherent changes. The Landfall tests cover strict Worldspace and coordinate validation, geometry and routes, physical qualification and confidence, virtual semantic and position paths, permission lifecycle, privacy projection, offline reconciliation, published snapshot compatibility, MapLibre/virtual DOM rendering, and the Studio authorization boundary. Drydock tests cover physical and virtual match, non-match, uncertainty, and unavailable provider.

`npm run landfall:migrations` applies the SQLite history to isolated in-memory databases, including an upgrade from the previous mainline schema with existing rows, and checks MySQL migration shape. Validate both Prisma schemas with `npx prisma validate --schema prisma/schema.sqlite.prisma` and `npx prisma validate --schema prisma/schema.prisma`. A supported MySQL server is needed for a true MySQL deployment rehearsal; static SQL parity alone does not prove that deployment.

## Candidate gates

Run TypeScript, affected ESLint, production build, `npm run docs:index`, `npm run docs:validate`, `npm run features:sync`, and `npm run features:validate`. Then run the repository's ordinary Sounding Line once on the frozen candidate. Use a second run only to verify a specific repaired defect. Inspect the protected PR checks before integration.

## Browser and privacy proof

The focused tests cover pinned Player projection, membership and no-store API behavior, foreground geolocation qualification, weak/stale fixes, MapLibre marker data, virtual rendering, and degraded fallback. Run `tests/e2e/landfall-phase1-live-position.spec.ts` under its dedicated Sounding Line browser profile. Its four production-browser journeys cover explicit grant/stop/close and no canonical visit, denial, virtual navigation without GPS, and unauthorized/hidden-geometry protection. Fixtures use synthetic geography and a fictional chart; they do not collect a physical trail. A real handset field test is optional owner evidence, not a local correctness gate.

## Acceptance distinction

Passing the focused tests proves deterministic code behavior. It does not prove live GPS hardware, real-world arrival accuracy, map tile service availability, deployment MySQL behavior, or owner acceptance. The [Validation Record](Project_Landfall_Phase_1_Validation_Record.md) records exactly which of those gates ran.
