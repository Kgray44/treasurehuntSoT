# ADR 0003: Event-driven story state

Date: 2026-07-16 · Status: accepted

Context: refresh, duplicate delivery, close actions, replay, and undo must be safe. Decision: transactional domain state plus immutable sequenced events, snapshots, audit records, and save states. Alternatives: chapter-number mutation and client-only state. Consequences: reliable reconciliation and history at the cost of more explicit transaction code.
