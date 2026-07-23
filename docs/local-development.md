# Local development

## Phase 2 MySQL proof

The normal local application remains SQLite. The Phase 2 MySQL rehearsal owns
an isolated local MySQL data directory and never targets the development or
production database.

## Wayfarer profile configuration

Set `PROFILE_MEDIA_ROOT` to a local non-repository directory when exercising
avatar/banner uploads. `WAYFARER_PROVIDER_TOKEN_KEY` is required to complete a
provider link. Real Discord linking additionally requires `DISCORD_CLIENT_ID`,
`DISCORD_CLIENT_SECRET`, and `DISCORD_REDIRECT_URI`; use the simulator only in
non-production validation.

## One-command Windows startup

Double-click `Start Forever Treasure Dev.cmd` or run `npm run dev:full`. The idempotent launcher:

1. Finds Node/npm and explains what is missing when neither a normal installation nor the bundled Codex runtime is available.
2. Creates `.env` only when absent; existing local configuration is preserved and validated.
3. Mirrors network-share checkouts to `%LOCALAPPDATA%\ForeverTreasureCompanion\development` while keeping dependencies, databases, logs, and generated artifacts out of Git.
4. Runs `npm ci` only when `package-lock.json` changed or dependencies are missing.
5. Generates Prisma, applies the versioned SQLite migrations, and ensures the development fixture exists without replacing an existing campaign. Local access hashes are refreshed from `.env`, while voyage progress, history, staging, and audit state remain intact.
6. Refuses to take an occupied port, starts the server as a hidden recorded process, and waits for an HTTP health response.
7. Prints the player and GM URLs, disposable credentials, and stop command.

Run `npm run dev:stop` before switching branches or replacing the runtime. Shutdown verifies the recorded PID is the expected Next.js development process before stopping it.

## URLs and credentials

- Unified role gateway: `http://127.0.0.1:3000/`
- Player URL: `http://127.0.0.1:3000/tale/development-forever-treasure`
- Player identity/library: `http://127.0.0.1:3000/player`
- Invitation phrase: `development-moonwake`
- Returning Player username: `sera`; password is `PLAYER_PASSWORD`, falling back to `PLAYER_ACCESS_CODE` in an isolated development database
- GM URL: `http://127.0.0.1:3000/quartermaster`
- GM username/password: `kato` / `development-captain-only`
- Animation showcase: `http://127.0.0.1:3000/dev/animations` (development only)
- Chronicle catalog: `http://127.0.0.1:3000/tales`
- Creator Studio: `http://127.0.0.1:3000/studio/library`
- Captain command/library: `http://127.0.0.1:3000/captain/library`

The launcher-generated `.env` is ignored. Change these values for any shared environment. Never reuse them for deployment.

## LAN opt-in

`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-dev.ps1 -Lan` binds Next.js to `0.0.0.0` and prints the best detected IPv4 URLs. LAN mode is intentionally not the one-click default because it exposes a development server and disposable credentials to the local network. If another device cannot connect, allow the selected TCP port through Windows Firewall and confirm that corporate Wi-Fi/client-isolation policy permits peer traffic.

## Portable fallback

On macOS/Linux or when automation is unavailable:

```bash
npm ci
cp .env.example .env
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Use Node 24 and npm 11.9.0; `.nvmrc`, `.node-version`, `packageManager`, and `package-lock.json` define the reproducible toolchain.

## Animation development

Open `/dev/animations` or use the development-only `TEST ANIMATIONS` button. The lab contains all registered scenes, a no-API trailer, transport/scrub/speed/mode controls, StPageFlip book, live Rive input proof, Lottie controls, fallback states, and local FPS/long-task/runtime metrics. The route intentionally returns 404 from a production server.

Use `npm run assets:validate` after any asset-contract change. Keep all runtime files and fallbacks under `public`, add provenance to `docs/asset-licenses.md`, and never use a remote CDN placeholder. See `docs/animation/showcase.md` for the manual pass and `docs/animation/` for scene/asset extension contracts.

## Chronicle Studio development

The seed creates `development-studio-voyage`, its editable draft, and published version 1.0 without replacing the original campaign seed. Sign in through Quartermaster and use Studio to edit it. Asset originals and generated derivatives live under ignored `.data/chronicle-assets` by default. Override that location with an absolute `CHRONICLE_ASSET_ROOT`; set the upload ceiling with `CHRONICLE_MAX_UPLOAD_MB`.

Draft preview sessions are explicitly marked and may read draft assets only through an authenticated Creator session. Real Player playthroughs normally begin with a Captain invitation. The development catalog compatibility route remains available, but `/player/*`, `/captain/*`, and `/studio/*` are the canonical role workspaces. Every real playthrough pins itself to an immutable published version. Normal `--ensure` startup also adds missing platform roles/Player credentials and backfills memberships/reveal history for legacy Chronicle sessions without resetting progress.

## Clean-clone continuation

An authorized session on another computer needs only Git, Node/npm, and this repository. Clone `main`, copy `.env.example` or use the Windows launcher, then run `npm run validate`. No database, generated Prisma client, Playwright browser state, artifact, or machine path is required from the originating computer.

## Troubleshooting

- **Port 3000 is occupied:** stop that process or run `scripts/start-dev.ps1 -Port 3001`. The launcher never kills an unknown listener.
- **Existing `.env` is incomplete:** the launcher preserves it and identifies each missing key. Add the key; it will not overwrite local secrets.
- **Startup fails:** inspect `%LOCALAPPDATA%\ForeverTreasureCompanion\development\.forever\logs`.
- **Resetting disposable data is explicit:** `npm run db:preset -- awaiting-first-release` intentionally replaces the development fixture. Normal `npm run dev:stop` / `npm run dev:full` cycles preserve it. For validation, `npm run validate` always rebuilds `validation.db` from migrations.
- **Browser binaries are missing:** `npm run validate` installs pinned Chromium and WebKit builds automatically.
- **UNC/network checkout is slow:** the first mirror/install is expected to take longer; subsequent runs retain the dependency cache and only synchronize project files.

## Wayfarer Phase 2 isolated browser run

Use repository Playwright Chromium against an owned loopback server, never an
embedded or personal browser. Give every run a new SQLite file and a new
`WAYFARER_PROFILE_MEDIA_ROOT`; set `NO_PROXY` for `localhost`, `127.0.0.1`, and
`::1`. Provider simulators are test-only. Production browser harnesses must
explicitly set `WAYFARER_PROVIDER_SIMULATORS=1`; this does not supply or imply
live OAuth credentials. Keep live provider and MySQL proof for staging or
deployment environments.
