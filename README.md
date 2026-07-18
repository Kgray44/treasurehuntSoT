# The Forever Treasure Companion

Production-oriented foundation and fully automated local demo for a private nautical-fantasy date-night Tall Tale. All committed story material is generic development seed content; no final surprise content belongs in this public repository.

## Current phase

The application is now a unified Tall Tale platform. The cinematic gateway opens distinct Player, Captain, and Creator workspaces without treating role choice as authorization. Phase B-1 adds persisted, immutable-versioned Vision Waypoints, a strict protocol, platform adapters, an installable PWA shell, and a restricted Electron Windows shell without creating separate Player, Captain, or Studio applications. The authorized B-1 verifier is explicitly deterministic development-only: it does not capture a camera, inspect the game, or perform real vision inference.

The original companion and expanded Game Master Command Center remain integrated compatibility surfaces. A shared animation director coordinates the harbor, journal, chart, artifact, gateway, and finale experiences without allowing presentation timing to outrun server truth. All committed content remains fictional development seed material.

## Stack

- Next.js 16 App Router, React 19, strict TypeScript
- Prisma 6.19.3 with SQLite for local/test and an equivalent MySQL production schema
- GSAP 3.15 for orchestrated scenes and SVG/text work; Motion 12 for React interaction and presence
- StPageFlip for the journal; local Rive and Lottie runtimes with explicit static fallbacks
- bcrypt password/access-code hashing, server-side database sessions, CSRF tokens, and rate limiting
- Vitest and Playwright

## Reproducible setup

Requirements: Windows PowerShell 5.1+, Node.js 24, npm 11, and Git. MySQL 8 is only required for production parity; the supported local/demo/test strategy is SQLite.

### Fastest Windows demo

After cloning, double-click `Start Forever Treasure Dev.cmd`, or run:

```powershell
npm run dev:full
```

The launcher creates an ignored `.env` when absent, installs the exact lockfile, generates Prisma, applies migrations, creates generic development data only when the voyage is missing, starts the app, checks health, and prints the URLs and credentials. Existing campaign progress is preserved across normal stop/start cycles. Network/UNC workspaces are mirrored to an ignored local runtime under `%LOCALAPPDATA%` because Node and SQLite are unreliable on network shares. Stop it with `npm run dev:stop`.

- Role gateway: `http://127.0.0.1:3000/`
- Player: `http://127.0.0.1:3000/tale/development-forever-treasure`
- Player library: `http://127.0.0.1:3000/player`
- Tall Tale catalog: `http://127.0.0.1:3000/tales`
- Player phrase: `development-moonwake`
- Returning Player development login: `sera` / the configured `PLAYER_PASSWORD` (or `PLAYER_ACCESS_CODE` fallback)
- GM: `http://127.0.0.1:3000/quartermaster`
- Studio: `http://127.0.0.1:3000/studio`
- Vision Waypoint Studio: `http://127.0.0.1:3000/studio/vision-waypoints`
- Captain: `http://127.0.0.1:3000/captain`
- GM development login: `kato` / `development-captain-only`

These values are disposable local defaults, never production credentials. To opt into LAN access, run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-dev.ps1 -Lan`; Windows Firewall and network policy still determine whether another device can connect.

### Portable manual setup

```bash
git clone https://github.com/Kgray44/treasurehuntSoT.git
cd treasurehuntSoT
npm ci
cp .env.example .env
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Set unique local values in `.env`; the seed’s fallback values are development-only and must never be used outside an isolated development database. Player path: `/tale/development-forever-treasure`. GM path: `/quartermaster`.

## Commands

| Command                                   | Purpose                                                               |
| ----------------------------------------- | --------------------------------------------------------------------- |
| `npm run dev:full`                        | Idempotent setup, migration, progress-safe seed check, and server     |
| `npm run dev:stop`                        | Safely stop only the recorded development process                     |
| `npm run validate`                        | Fresh DB, format/lint/types/unit/E2E/a11y/build/restart proof         |
| `npm run dev`                             | Next.js only; assumes setup is already complete                       |
| `npm run build`                           | Production build                                                      |
| `npm start`                               | Start production build                                                |
| `npm test`                                | Domain, command-center, Studio, animation, and component unit tests   |
| `npm run assets:validate`                 | Validate local Lottie/Rive contracts and fallback paths               |
| `npm run test:e2e`                        | Cross-browser player, Command Center, Studio, and animation workflows |
| `npm run db:migrate`                      | Apply local SQLite migrations                                         |
| `npm run db:seed`                         | Load replaceable development content                                  |
| `npm run db:preset -- mid-voyage`         | Reset to a repeatable development-only companion preset               |
| `npm run db:generate:mysql`               | Generate production MySQL client                                      |
| `npm run db:migrate:mysql:command-center` | Apply the Phase 3 production MySQL migration                          |
| `npm run db:migrate:mysql:studio`         | Apply the production-parity Tall Tale Studio migration                |
| `npm run db:migrate:mysql:platform`       | Apply the unified Tall Tale Platform migration                        |
| `npm run db:migrate:mysql:vision`         | Apply the additive Phase B-1 MySQL migration                          |
| `npm run desktop:dev`                     | Start the shared Next.js UI in the restricted Electron shell          |
| `npm run desktop:test`                    | Test the desktop command allowlist and input validation               |
| `npm run desktop:build`                   | Build Next standalone and a Windows NSIS installer                    |

Full setup, validation stages, output locations, clean-clone instructions, and troubleshooting are in [local development](docs/local-development.md) and [testing](docs/testing.md). Phase B-1 architecture, flags, desktop, PWA, protocol, API, security, test, and demonstration instructions are indexed from [the B-1 architecture](Development_Docs/AR/Phase_B1/B1_Architecture.md). Unified identity, invitations, libraries, authorization, history, and migration are in [Tall Tale Platform](docs/tall-tale-platform.md); Studio architecture and operations are in [Tall Tale Studio](docs/tall-tale-studio.md).

## Repository workflow

`main` is canonical. At task start: fetch, inspect status/remotes, and pull with rebase when clean. At task end: validate, review the complete diff, commit intentionally, fetch/rebase if needed, push without force, and verify local `HEAD` equals `origin/main`. See [Codex handoff](docs/codex-handoff.md).

## Important limitations

The full story, final Rive artwork/audio, horizontal scale-out for SSE, and production deployment are later work. The current sound is restrained and procedural. The sole third-party visual sample is MIT-licensed, local, documented, and development-only; production uses original SVG/CSS fallbacks. The repository is public, so only generic development content is permitted. See [known limitations](docs/known-limitations.md).

## Next steps

Add CI for the complete validation gate, exercise the parallel MySQL schema in an integration environment, and replace process-local SSE fan-out before multi-instance deployment. Real surprise content remains blocked until repository visibility is verified private.
