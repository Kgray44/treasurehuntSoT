# ADR 0002: Electron desktop shell

Status: accepted for Phase B-1

## Context

Tauri 2 is preferred when a frontend can be bundled as static assets or paired with a justified sidecar. This repository uses dynamic Next.js server components, route handlers, Prisma, database-backed sessions, and filesystem-backed assets. The audited Windows host has Node but no Rust toolchain. Tauri would still require a bundled Node server sidecar.

## Decision

Use Electron as a narrow Windows shell. It launches the packaged Next standalone server on loopback, renders that local application, uses one-instance locking, disables renderer Node integration, enables context isolation and sandboxing, and exposes only fixed IPC commands through a preload bridge.

## Alternatives considered

- Tauri 2 plus Node sidecar: rejected for B-1 because it adds Rust and Node native packaging while retaining the same server requirement.
- Remote production URL wrapper: prohibited because it is not a local production bundle.
- Static export: rejected because it cannot preserve the existing authenticated dynamic application.

## Consequences

The artifact is larger than Tauri but uses one existing runtime family and packages the actual application. Electron-builder becomes a development dependency.

## Migration implications

The `VisionPlatformAdapter` contract permits a future shell substitution. No domain or UI type depends on Electron.

## Security implications

No generic shell, filesystem, process, or arbitrary IPC command is exposed. Navigation and window creation are restricted, and production loads only the owned loopback server.

## Compatibility implications

The development shell uses the normal Next development URL; production uses bundled standalone output and does not require a separately installed development server.
