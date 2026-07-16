# Ship's Log

The Ship's Log is derived from ordered `ProgressEvent` records by `src/domain/ships-log.ts`. The transformation owns player-facing title, summary, symbol, importance, destination section, and safe target key. Unknown/internal events return no entry and never crash rendering.

```mermaid
flowchart LR
  G[Authenticated GM action] --> E[Domain event]
  E --> S[Campaign snapshot]
  E --> A[Audit record]
  E --> T[Player log transformer]
  T --> L[Atmospheric log entry]
  E --> SSE[Ordered SSE]
  SSE --> L
```

Raw payloads, actor IDs, audit records, credentials, and internal notes are never log fields. The snapshot caps the initial log projection at 250 entries; later phases may add cursor pagination beyond that boundary.
