---
title: Project Sounding Line Phase 3 Evidence Freshness and Invalidation
audience: engineering
status: current
---

# Evidence freshness and invalidation

Freshness compares exact source watermark/change and contract sets, policy version/digest, suite/test/executor/fixture versions, environment/browser/provider/database-baseline, migration/dependency/generated-artifact/build identities, and cleanup status. Results are `FRESH_EXACT`, `FRESH_BY_PROVEN_INDEPENDENCE`, `STALE_SOURCE`, `STALE_CONTRACT`, `STALE_POLICY`, `STALE_FIXTURE`, `STALE_ENVIRONMENT`, `STALE_CLEANUP`, or `STALE_UNKNOWN`.

Evidence is reusable only for the first two results and only after integrity and retention checks. Repairs always rerun failed roots; repaired dependencies, blocked descendants, changed tests/fixtures, and affected infrastructure invalidate appropriately. Unknown repair impact broadens. Release gates remain complete. The prototype's fail-closed comparison is illustrative only; it reads no real evidence.
