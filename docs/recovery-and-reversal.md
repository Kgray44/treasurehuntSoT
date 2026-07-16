# Recovery and reversal

```mermaid
flowchart TD
  A[Select latest save point] --> B{Later dependent event?}
  B -->|yes| C[Block and explain dependency]
  B -->|no| D[Restore state in transaction]
  D --> E[Append STATE_REVERTED]
  E --> F[Publish reconciliation]
  F --> G[Player fetches snapshot]
```

Phase 3 surfaces save points, labels only the latest as directly reversible, and preserves history through a compensating event. It never deletes the reversed event. Multi-event rollback and arbitrary restoration remain unavailable. Pause preserves released content; resume requires stale staged actions to be previewed again.
