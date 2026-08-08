# The Forever Treasure Companion

## Consolidated mainline

The private **Chronicle Passport** is available at `/passport`; a safe public
**Profile** is resolved by optional canonical handle at `/profile/[handle]`.
Wayfarer also provides private Chronicle history and an Artifact Cabinet;
identity, consent, providers, typed preferences, and privacy remain
Wayfarer-owned. Google and GitHub application OAuth is available on main and
requires server-only provider configuration. Its local simulator is
test-only and is never live-provider proof.

Production-oriented foundation and fully automated local demo for a private nautical-fantasy date-night Chronicle. All committed story material is generic development seed content; no final surprise content belongs in this public repository.

## Current phase

The application is now a unified Chronicle platform. The cinematic gateway and
True North navigation open distinct Player, Captain, and Creator workspaces
without treating role choice as authorization. Players have durable identities,
invitation acceptance, a multi-voyage library, live waiting/runtime state,
exact-version archives, personal history, and artifact custody projections.
Captains can create version-pinned crew voyages, deliver individually hashed
link/QR/code/PIN invitations, manage invitation lifecycle, preview the
Player-safe surface, and launch accepted crews. Creator Studio retains
immutable publishing and structured version comparison, restore-to-draft, and
fork provenance.

The original companion and expanded Game Master Command Center remain integrated compatibility surfaces. A shared animation director coordinates the harbor, journal, chart, artifact, gateway, and finale experiences without allowing presentation timing to outrun server truth. All committed content remains fictional development seed material.

Project Homeport Phases 1-7 are now on main and bind the complete page
surface to a permission-aware reachability graph, complete its critical/high
states and responsive presentation, and prove A-through-O integrated journeys
against one immutable synthetic fixture family. The final owner walkthrough
package and owned local runtime remain available. Owner Decision remains
`PENDING_OWNER_DECISION`; mainline integration is not deployment, owner
acceptance, or product acceptance. Live-provider evidence includes the
disposable Resend registration-verification path and the owner-observed OAuth
development checks described below; neither is production deployment proof.

Mainline Google and GitHub OAuth adds sign-up, sign-in, and explicit linking
through the same canonical Homeport account and session lifecycle. Isolated
automated validation is complete. The owner reports that
both real providers work in a development browser, and a redacted inspection
independently confirmed the real Google identity/account/session persistence
boundary. Protected PR #10 integrated the source without deploying it or
changing production configuration.

Correction Round 3 Patch A stabilizes the mainline registration, ordinary
sign-in, and page-switching paths that blocked continued owner review. Pending
registration is atomic, duplicate fields have truthful recovery, unverified
accounts can sign in without an email code, and generation-owned 280 ms route
crossfades suppress stale pages and delayed loading after readiness. Postmark
is dormant compatibility; Resend is the selected real provider. Live
registration verification passed on a disposable database: Resend accepted the
message, the owner received the code, the application consumed it, the account
became `ACTIVE`, and its primary email became `VERIFIED`.

## Stack

- Next.js 16 App Router, React 19, strict TypeScript
- Prisma 6.19.3 with SQLite for local/test and an equivalent MySQL production schema
- GSAP 3.15 for orchestrated scenes and SVG/text work; Motion 12 for React interaction and presence
- StPageFlip for the journal; local Rive and Lottie runtimes with explicit static fallbacks
- bcrypt password/access-code hashing, server-side database sessions, CSRF tokens, and rate limiting
- Vitest and Playwright

## Reproducible setup

Requirements: Windows PowerShell 5.1+, Node.js 22 or newer, npm 11, and Git.
MySQL 8 is only required for production parity; the supported local/demo/test
strategy is SQLite.

### Fastest Windows demo

After cloning, double-click `Start Forever Treasure Dev.cmd`, or run:

```powershell
npm run dev:full
```

The launcher creates an ignored `.env` when absent, installs the exact lockfile, generates Prisma, applies migrations, creates generic development data only when the voyage is missing, starts the app, checks health, and prints the URLs and credentials. Existing campaign progress is preserved across normal stop/start cycles. Network/UNC workspaces are mirrored to an ignored local runtime under `%LOCALAPPDATA%` because Node and SQLite are unreliable on network shares. Stop it with `npm run dev:stop`.

- Role gateway: `http://127.0.0.1:3000/`
- Player: `http://127.0.0.1:3000/tale/development-forever-treasure`
- Player library: `http://127.0.0.1:3000/player`
- Chronicle catalog: `http://127.0.0.1:3000/tales`
- Player phrase: `development-moonwake`
- Returning Player development login: `sera` / the configured `PLAYER_PASSWORD` (or `PLAYER_ACCESS_CODE` fallback)
- GM: `http://127.0.0.1:3000/quartermaster`
- Studio: `http://127.0.0.1:3000/studio`
- Captain: `http://127.0.0.1:3000/captain`
- GM development login: `kato` / `development-captain-only`

These values are disposable local defaults, never production credentials. To opt into LAN access, run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-dev.ps1 -Lan`; Windows Firewall and network policy still determine whether another device can connect.

## Private Chronicle packages

Creator-authorized private packages are encrypted `.ftprivate` files. Configure
`PRIVATE_CONTENT_ROOT` and `PRIVATE_CONTENT_STAGING_ROOT` as distinct absolute
paths outside the repository and public/build directories. Inspect before an
explicit import; imports remain unpublished and never create sessions or
invitations. Use `npm run private-content:inspect`, `private-content:verify`,
and the repository/build scanners for operational checks. Never pass a
passphrase as a command-line argument or commit an export.

Phase 3 operational controls are available to an authenticated Administrator at
`/studio/private-content/operations`. They report sanitized provider readiness,
backup, restore-drill, and repair-plan status only. Use
`npm run private-content:providers:check` and
`npm run private-content:migrations:status` for server-side operational checks;
these commands never accept credentials or passphrases as command-line values.

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
| `npm run db:migrate:mysql:studio`         | Apply the production-parity Chronicle Studio migration                |
| `npm run db:migrate:mysql:platform`       | Apply the unified Chronicle Platform migration                        |

Full setup, validation stages, output locations, clean-clone instructions, and troubleshooting are in [local development](docs/developer/local-development.md) and [testing](docs/developer/testing.md). Unified identity, invitations, libraries, authorization, history, and migration are documented in the [architecture guide](docs/developer/architecture.md); product and Studio context are in the [product overview](docs/product/overview.md). The future roadmap and recognition boundary are in the [product roadmap](docs/product/roadmap.md). Animation ownership, scene contracts, assets, performance, and the development lab are indexed from [animation architecture](docs/developer/animation/architecture.md).

Wayfarer Phases 3 and 4, Sealed Hold Phases 3 and 4, Harborlight Phase 3, True
North, Ledgerlight, and the Feature Catalog are consolidated on main. Focused
and integration evidence is retained in `Development_Docs`; live provider
authorization, production MySQL, deployment, and hosted storage/scanning proof
remain external validation.

## Repository workflow

`main` is canonical. At task start: fetch, inspect status/remotes, and pull with rebase when clean. At task end: validate, review the complete diff, commit intentionally, fetch/rebase if needed, push without force, and verify local `HEAD` equals `origin/main`. See the [automation workspace](.agents/README.md).

## Important limitations

Project One Voyage Phase 2 passed an isolated MySQL 8.0.46 cutover, canonical
compatibility, backup/restore, and restart rehearsal. Legacy persistence is
retained pending its one-release compatibility-observation gate. The former
P34-BME-20260729 browser-matrix exception is historical: Sounding Line's
complete hosted release-candidate proof on 2026-07-31 executed all 16 required
browser families (325/325 passing) and retained P34 as unselectable archival
history. See `Development_Docs/Programs/Sounding_Line/Project_Sounding_Line_Program_Completion_Receipt.md`.

The full story, final Rive artwork/audio, horizontal scale-out for SSE, and production deployment are later work. The current sound is restrained and procedural. The sole third-party visual sample is MIT-licensed, local, documented, and development-only; production uses original SVG/CSS fallbacks. The repository is public, so only generic development content is permitted. See the [product roadmap](docs/product/roadmap.md).

## Next steps

Project Sounding Line, Harborlight Phase 4, Project Drydock, Project Landfall,
and Project Watchglass are planned or governed work, not implemented product
claims. Add CI for the complete validation gate, exercise the parallel MySQL
schema in an integration environment, and replace process-local SSE fan-out
before multi-instance deployment. Real surprise content remains blocked until
repository visibility is verified private.
