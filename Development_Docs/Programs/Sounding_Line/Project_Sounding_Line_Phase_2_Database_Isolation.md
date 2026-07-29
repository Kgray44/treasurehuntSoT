---
title: Project Sounding Line Phase 2 Database Isolation
audience: engineering
status: current
---

# Database Isolation

Fixture baselines are immutable, run-owned SQLite files whose hashes are checked
before cloning. Harborlight lanes use the existing harness to fingerprint a
trusted baseline, create a marker-owned mirror and unique mutable SQLite copy,
and verify the canonical family remains unchanged.

No lane points `DATABASE_URL` at a canonical database. MySQL/provider proof is
an explicit external gate, not an inference from SQLite success.
