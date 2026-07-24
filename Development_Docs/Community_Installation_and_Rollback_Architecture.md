# Community Installation and Rollback Architecture

Installation modes are linked reference, editable copy, tracked fork, and current-draft insertion. Planning is side-effect free and returns conflicts, dependency and licence obligations, deterministic ID mappings, proposed asset reuse, and a destination revision token. Commit rejects stale plans, duplicate/in-progress requests, invalid packages and locally modified linked installations.

The operation persists an install record with an idempotency key before database mutations. A successful transaction persists receipt, mappings, attribution/lineage and update tracking. If external finalization fails, the record becomes `FINALIZATION_RETRY_REQUIRED`; retries reuse the same operation and cannot duplicate the logical install. No completion signal is emitted until both database and finalization are coherent.
