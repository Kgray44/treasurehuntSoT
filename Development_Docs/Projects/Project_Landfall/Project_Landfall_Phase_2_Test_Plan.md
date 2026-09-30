---
title: Project Landfall Phase 2 test plan
audience: product-engineering
status: current
canonical_for: project-landfall-phase-2-test-plan
last_reviewed: 2026-09-30
---

# Phase 2 test plan

## Local qualification

Run focused Landfall, Chronicle/One Voyage, Studio, Captain/Helm, Lanternwake, Drydock, media, and offline tests; the full unit suite; SQLite fresh/upgrade migration rehearsal; SQLite and MySQL Prisma schema validation; TypeScript; affected ESLint; Drydock validation; docs index/validation; feature sync/validation; and a production build. Use a task-owned SQLite browser database and production server for the dedicated Creator, Player, Captain, virtual, replay, and offline/reconnect Playwright scenarios. Review the changed-file diff for private content and whitespace errors.

The Creator browser scenario must save both Worldspace kinds, a placed waypoint and drawn route, perform a field test, and detect receipt staleness after a draft edit. Player scenarios must distinguish local confidence from canonical visit, show safe route and history projections, reject hidden geometry, and replay without extra events. Captain controls must not reveal exact coordinates. Offline evidence must remain visibly unconfirmed and reconcile once after reconnect.

## Protected integration

Freeze one coherent candidate, open one PR, and run ordinary hosted Sounding Line on the exact head. Record the selected run/job, candidate SHA, protected merge SHA, and landed-tree smoke in the [validation record](Project_Landfall_Phase_2_Validation_Record.md). External GPS, tile, live MySQL, deployment, and owner acceptance stay separate from synthetic checks.
