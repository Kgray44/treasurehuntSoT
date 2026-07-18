# ADR 0001: Shared web, PWA, and desktop application

Status: accepted for Phase B-1

## Context

Player, Captain, and Studio already share one Next.js App Router application, domain model, design system, API, and story engine. Phase B requires browser, PWA, and Windows delivery without divergent products.

## Decision

Keep the current Next.js application as the canonical product. The PWA registers against it, and the desktop shell packages and launches its production standalone output. No Player, Captain, Studio, authentication, or story implementation is copied into a second frontend.

## Alternatives considered

- Split the repository into several applications immediately: rejected because it would move stable code without improving the B-1 vertical slice.
- Build a separate desktop React application: rejected because it would drift and violate the governing shared-product rule.

## Consequences

All surfaces inherit the same routes and UI changes. Desktop packaging includes the application server runtime as well as frontend assets.

## Migration implications

Shared Vision modules are added under `src/vision`; a future monorepo extraction may preserve these boundaries without changing contracts.

## Security implications

Desktop content remains local, while authentication, authorization, CSRF, and server validation remain unchanged.

## Compatibility implications

Existing browser routes and deployments continue to work. Desktop-specific behavior is available only through the adapter and allowlisted preload bridge.
