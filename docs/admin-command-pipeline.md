# Administrative command pipeline

```mermaid
flowchart LR
  A[Authenticated GM] --> B[CSRF + schema validation]
  B --> C[Authoritative state]
  C --> D[Expected sequence]
  D --> E[Idempotency record]
  E --> F[Domain transaction]
  F --> G[(State + event + snapshot + audit)]
  G --> H[Commit]
  H --> I[SSE publication]
  I --> J[Persistence and delivery reported separately]
```

The client supplies intent, not current state. `expectedSequence` protects stale tabs; `(campaignId,idempotencyKey)` is unique; domain uniqueness protects repeat awards and releases. Completed duplicates replay their stored result. Failures retain correlation and sanitized code.

Preview follows validation → projected clone → player visibility → consequence summary. It creates no idempotency record, sequence, audit/event row, or SSE publication.
