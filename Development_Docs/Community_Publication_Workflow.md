# Community Publication Workflow

Creator preflight verifies the account capability, active Community status, supported listing/item type, immutable source projection where required, ownership acknowledgement, active licence, attribution closure, accessibility, package structure, dependency graph, and safety/scan readiness. It returns typed failures and does not mutate a release.

Publication creates the immutable release and package record, item records, dependency edges, attribution snapshot, ownership declaration, audit event and outbox event transactionally. It never changes `PublishedTaleVersion` or a live session. The existing publication state machine remains the gate for visibility; no public route exposes raw manifests, storage keys, private Chronicle data, or packages.
