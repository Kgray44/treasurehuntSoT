---
title: Project Fairlead GitHub Interaction Architecture
audience: engineering
status: current
canonical_for: project-fairlead-github-interaction-architecture
last_reviewed: 2026-08-18
---

# Project Fairlead GitHub Interaction Architecture

`scripts/github-interaction/` is the canonical local control plane. It has no
persisted secrets and does not create a service process. Its shared state lives
in the operating-system user state directory, namespaced by a non-secret hash
of the repository identity; `VOYAGEWRIGHT_GITHUB_STATE_DIR` can override the
parent location for isolated validation.

```text
Git-native fact ──> GitTransport ───────────────────────────────> answer
API-only read ──> shared fresh cache ──> GraphQL / conditional REST ─> answer
                                    │                  │
                                    └── file lock ──────┘
                                      (one live call)

response headers / GraphQL rateLimit ─> per-pool rate state ─> routing and polling mode
```

Each cache identity includes API base, credential pool, request identity,
accept/version fields or GraphQL query fingerprint and variables. It cannot be
reused across credential pools. REST ETags are retained with the sanitized
body and sent as `If-None-Match`; a `304` reuses the cached body. Atomic file
locks have a bounded wait and stale-lock recovery for process death on Windows.

Rate state separates REST and GraphQL resources for each non-secret
`credentialPoolId`. Response headers are runtime truth. The state captures
limit, remaining, used, reset time, resource, observation time, and source;
metrics count Git operations, requests by transport/resource/non-secret pool,
cache hits and misses, 304s, coalescing, live calls avoided, polling cadence,
failures, primary exhaustion, secondary limits, retry-after duration, GraphQL
cost, and rate deferrals without recording request bodies or credentials.

Rate observations persist their computed mode and, when applicable,
`retryAfterUntil` plus a classified secondary-limit or retry-after condition.
Every process honors that shared backoff before making another matching request;
repeated secondary events use bounded exponential backoff. A stale observation
whose reset window has elapsed triggers a safe fresh observation rather than
permanently suppressing work.
GraphQL responses that include `rateLimit` supply the authoritative point
limit, remaining, used, reset, and cost even when an HTTP header is absent.
Conditional REST falls back to `If-Modified-Since` when an ETag is unavailable.

`GitHubAppAuth` creates short-lived RS256 JWTs only in memory, exchanges them
for installation tokens, validates token expiry plus repository installation
and the minimum read permissions, and refreshes them two minutes before expiry.
It validates HTTPS API bases, rejects unavailable key material without exposing
the path or content, does not persist an installation token, and exposes only
safe configuration/expiry health. The App is a high-volume read plane;
interactive and release mutations remain on their existing governed user or
workflow credentials. A read may make one exact, authorization-scoped fallback
to a healthy independent App or configured user pool; mutations never do.

Bridgewatch remains standalone and read-only. Its adapter preserves the
sanitized SQLite observation cache and stale fallback, but delegates transport,
shared cache, locking, rate observation, and App credentials to Fairlead. It
uses one GraphQL query for open-PR check summaries and falls back to its prior
bounded conditional REST check collection if GraphQL cannot supply the result.
When its preferred App read credential is unavailable, it makes one equivalent
read through its already-configured user pool and records the active source.
Its source profile reports REST and GraphQL remaining percentages, pool-safe
telemetry counters, credential source, App health, reset time, and rate mode;
conservation and rate-degraded states are visible instead of live-green data.

Sounding Line uses Git for refs, ancestry, trees, and changed paths. Its
record-only adapter uses the shared client for API-only prior-authority reads.
Hosted workflows retain `${{ github.token }}`: hosted state is a separate
credential pool and no local state is used to alter protected binding logic.

## Webhook invalidation disposition

`verifyWebhook` is available for a future receiver and fails closed on a body
over one MiB or a missing, malformed, or mismatched `X-Hub-Signature-256`
value. Fairlead does
not deploy a listener or expose a new endpoint: `POLLING_RECONCILIATION_ONLY`.
That keeps the current loopback-only Bridgewatch boundary intact. A future
owner-approved receiver must cap bodies, deduplicate delivery IDs, verify the
signature before parsing, invalidate only the named repository cache entries,
and retain polling as reconciliation after missed deliveries.
