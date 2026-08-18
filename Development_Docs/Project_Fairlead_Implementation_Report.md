---
title: Project Fairlead Implementation Report
audience: engineering
status: in-progress
canonical_for: project-fairlead-implementation-report
last_reviewed: 2026-08-18
---

# Project Fairlead Implementation Report

## Current implementation scope

Project Fairlead introduces `scripts/github-interaction/` as the one local
GitHub interaction control plane. It provides Git-first transport helpers,
repository-namespaced shared rate state, independent credential pools,
percentage-based `NORMAL`/`CONSERVATION`/`CRITICAL`/`EXHAUSTED` modes,
conditional cache records, ETags, safe `304` reuse, file-lock coalescing,
GraphQL and REST clients, adaptive polling calculations, serialized mutation
requests, App JWT/installation-token support with repository/permission
validation, shared secondary-limit backoff, authorization-scoped read fallback,
bounded privacy-safe telemetry, redaction, body-bounded webhook signature
verification, safe CLI diagnostics, and static policy validation.

Bridgewatch delegates its GitHub transport to this client, preserves its
sanitized local cache and fallback behavior, accepts optional App
configuration, and batches open-PR check state through GraphQL before falling
back to bounded conditional REST. If its App key is unavailable it makes one
equivalent read through its already-configured user pool and reports that
source. Sounding Line record-only authority lookup
now delegates API-only reads to the client while retaining all existing
fail-closed binding rules. Hosted Sounding Line workflows retain their separate
`${{ github.token }}` pool and explicit policy exceptions.

Webhook invalidation is deliberately `POLLING_RECONCILIATION_ONLY` in this
increment: the verifier is available but no listener or public endpoint is
deployed. This preserves Bridgewatch's private boundary while leaving a
fail-closed, owner-approved path for later delivery deduplication and targeted
cache invalidation.

## Deepwater capability-realization impact declaration

```json
{
  "disposition": "NO_REALIZATION_IMPACT",
  "affectedCapabilityIds": [],
  "affectedFeatureCatalogIds": [],
  "potentialLayerImpact": [],
  "affectedSurfaces": { "routes": [], "screens": [], "journeys": [], "apis": [] },
  "expectedTerminalRungEffect": "NONE",
  "evidenceRequiringRefresh": [
    "Bridgewatch unit tests",
    "Sounding Line static policy",
    "Project Fairlead validation record"
  ],
  "rationale": "Fairlead changes internal repository automation transport and observation efficiency only. It does not change a product capability, user route, screen, journey, API contract, accessibility behavior, or capability-realization rung."
}
```

The final report will add the frozen candidate, qualified and landed identities,
measured concurrency simulation, and authoritative integration evidence.
