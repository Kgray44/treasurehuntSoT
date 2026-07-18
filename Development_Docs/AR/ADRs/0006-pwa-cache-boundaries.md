# ADR 0006: PWA cache boundaries

Status: accepted for Phase B-1

## Context

An installable offline shell is required, but stale authenticated or mutable data would misrepresent story truth and leak sensitive state.

## Decision

Use a versioned service-worker cache with an explicit static allowlist. Cache the offline document, manifest, icons, same-origin hashed `/_next/static/*` assets, and approved public assets. Treat `/api/*`, authentication, Player/Captain/Studio data, attempts, pairing, and mutable navigation as network-only. Navigations use network-first with offline fallback.

## Alternatives considered

- Cache-first for all GET requests: rejected as unsafe.
- No service worker: rejected because it cannot satisfy installability and offline-shell requirements.

## Consequences

The shell can open offline while protected live content truthfully reports unavailable. Cache version and update state are exposed in diagnostics.

## Migration implications

Later downloaded story packages require a separate versioned cache and explicit user action.

## Security implications

Sensitive mutable responses never enter Cache Storage. Logout does not rely on cache eviction for secrecy.

## Compatibility implications

Unsupported browsers continue as normal web applications without false install status.
