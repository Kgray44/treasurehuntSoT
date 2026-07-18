# Phase B-1 Windows Desktop Development

## Choice and boundary

Electron 41 packages the existing Next.js standalone application. This choice is recorded in ADR 0002. No route, React component, story engine, or domain model is forked for desktop.

Install dependencies and run:

```powershell
npm ci
npm run db:generate
npm run db:migrate
npx tsx prisma/seed.ts --ensure
npm run desktop:dev
```

The development command runs Next at `http://127.0.0.1:3000`, waits for it, and opens Electron. The Navigate menu opens the same `/player`, `/captain`, and `/studio` routes used by browsers.

## Restricted native bridge

`contextIsolation`, renderer sandboxing, `nodeIntegration: false`, `webSecurity`, external-window denial, and same-origin navigation are enabled. `preload.cjs` exposes only one frozen method. `commands.cjs` allows exactly:

- `vision.getCapabilities`
- `vision.prepareMockScan`
- `app.getDiagnostics`

The bridge has no generic shell, process, filesystem, registry, network-proxy, or arbitrary IPC command. Identifiers and mock scenarios are allowlisted. The Desktop adapter uses this bridge only for governed desktop capability/preparation, then uses the same authenticated server attempt APIs as web/PWA.

Run boundary tests with `npm run desktop:test`.

## Production package

```powershell
npm run desktop:build
```

The command runs `next build` with `output: standalone`, stages the standalone server, its traced runtime dependencies, static assets, and public assets under `.desktop-bundle`, and invokes Electron Builder for an NSIS installer. The packaged main process starts that bundled server in an Electron utility process on loopback port 32178 and loads it after a bounded health wait. `npm run desktop:smoke` launches the unpacked package with hidden smoke instrumentation and proves the shared app title/origin/shell version. `.desktop-bundle` and installer output are generated artifacts and must not be committed.

B-1 disables executable signing/editing in the local Electron Builder pipeline so Windows packaging does not depend on privileged symbolic-link creation in the signing-tool cache. The generated installer is therefore intentionally unsigned and uses Electron's default application icon; both must be replaced before a public distribution. B-1 does not access a camera, register global hotkeys, add a tray agent, or install a localhost Companion. Those capabilities remain false and belong to later phases.
