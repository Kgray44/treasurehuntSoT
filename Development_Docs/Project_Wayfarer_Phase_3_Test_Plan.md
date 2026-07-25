# Phase 3 Test Plan

Focused service tests cover version pinning, snapshot stability, safe event
summaries, unavailable timing, idempotency, reflection/Memory preservation,
owner IDOR denial, and consent membership enforcement. Migration rehearsal
uses isolated SQLite and MySQL environments. Browser acceptance covers empty,
reconciled, and responsive Passport history. Full validation remains separate;
an unavailable external MySQL service is not a pass.
