# Local development

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

- Player URL: `http://127.0.0.1:3000/tale/development-forever-treasure`
- Invitation phrase: `development-moonwake`
- GM URL: `http://127.0.0.1:3000/quartermaster`
- GM username/password: `kato` / `development-captain-only`

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

## Clean-clone continuation

An authorized session on another computer needs only Git, Node/npm, and this repository. Clone `main`, copy `.env.example` or use the Windows launcher, then run `npm run validate`. No database, generated Prisma client, Playwright browser state, artifact, or machine path is required from the originating computer.

## Troubleshooting

- **Port 3000 is occupied:** stop that process or run `scripts/start-dev.ps1 -Port 3001`. The launcher never kills an unknown listener.
- **Existing `.env` is incomplete:** the launcher preserves it and identifies each missing key. Add the key; it will not overwrite local secrets.
- **Startup fails:** inspect `%LOCALAPPDATA%\ForeverTreasureCompanion\development\.forever\logs`.
- **Resetting disposable data is explicit:** `npm run db:preset -- awaiting-first-release` intentionally replaces the development fixture. Normal `npm run dev:stop` / `npm run dev:full` cycles preserve it. For validation, `npm run validate` always rebuilds `validation.db` from migrations.
- **Browser binaries are missing:** `npm run validate` installs pinned Chromium and WebKit builds automatically.
- **UNC/network checkout is slow:** the first mirror/install is expected to take longer; subsequent runs retain the dependency cache and only synchronize project files.
