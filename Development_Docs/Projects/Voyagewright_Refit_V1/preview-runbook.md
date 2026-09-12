---
title: Voyagewright Refit V1 Preview Runbook
audience: engineering
status: current
canonical_for: voyagewright-refit-v1-preview-runbook
last_reviewed: 2026-09-11
---

# Voyagewright Refit V1 preview runbook

Use this loop only in a dedicated Refit area worktree. It keeps visual iteration fast while preserving the later, authoritative validation gate.

## One-time worktree preparation

Create the area from refreshed protected main, using `refit-v1/<area-slug>`. Install dependencies and prepare only the worktree's ignored local development configuration and SQLite data before the first preview. The repository's documented setup is `npm ci`, local `.env` preparation, Prisma generation, migration, and seed. Never point this worktree at shared, production, or private data.

The regular `npm run dev:full` launcher manages shared `%LOCALAPPDATA%\ForeverTreasureCompanion` runtime state and is useful for its documented full demo setup, not for every Refit visual turn. Do not use it as an iteration restart loop.

## Persistent Refit preview

Reserve a port before starting. The recommended Refit port is **3128**, which was available when this runbook was created:

```powershell
Get-NetTCPConnection -State Listen -LocalPort 3128 -ErrorAction SilentlyContinue
npm run dev -- --hostname 127.0.0.1 --port 3128
```

Keep that terminal open for the current owner-review session. The preview URL is `http://127.0.0.1:3128/`; open the packet's route from that origin. If the port is occupied, choose an unused port for that area, record it in the packet's implementation notes, and never stop a process owned by another worktree.

Codex confirms readiness by waiting for the initial route compilation, requesting the intended local URL, and checking the terminal for a successful response with no compile error. A route that requires an authenticated or representative state also needs the packet's declared task-owned fixture or local setup; a generic page response does not prove that state.

## Iteration loop

1. Keep the approved design packet and latest accepted iteration visible.
2. Make one narrow implementation delta in the area worktree.
3. Let the persistent Next development server hot reload; refresh the owner’s target route.
4. Confirm the edited route recompiles without error and run a focused sanity check appropriate to the change, such as the changed component's test or changed-file formatting.
5. Record the preview result and new iteration number in the iteration delta, then wait for explicit owner feedback.

Normal component, CSS, and route presentation changes use hot reload. Restart only when a dependency, environment variable, Next configuration, generated client, schema/migration, or unrecoverable development-server error requires it. Restarting does not substitute for a focused check.

## Collision and isolation rules

- Bind to `127.0.0.1`; do not expose a Refit preview on the LAN unless the owner explicitly asks.
- Use a unique local port, branch, worktree, browser profile/state, and database/fixture path for the area.
- Do not modify the shared runtime state or use another worktree’s server, port, database, browser state, or local credentials.
- Do not put private Chronicle content, secrets, or production configuration in a packet, fixture, screenshot, or preview URL.

## Iteration checks versus final validation

Iteration validation is intentionally lightweight: hot-reload/compile proof, route sanity, and the smallest relevant test or formatting check. It does **not** require Sounding Line, a production build, a browser matrix, or full screenshot-corpus regeneration after every visual change.

After explicit owner acceptance, set the area to `FINAL_VALIDATION`. Then perform the packet's applicable desktop, materially distinct tablet, mobile, Dark/Light, overflow, populated/empty/loading/error, keyboard/focus, accessibility, reduced-motion, representative-data, navigation, screenshot, and focused-regression checks. Sounding Line remains the verification and protected-merge authority; final validation never creates owner acceptance retroactively.
