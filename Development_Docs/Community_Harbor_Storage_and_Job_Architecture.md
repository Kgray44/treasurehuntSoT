# Community Harbor storage and job architecture

The local adapter isolates `staging`, immutable `releases`, and `quarantine`, with path safety and immutable-write protection. It is a development adapter only. CommunityOutboxEvent is the transactional dispatch record with sanitized payload, idempotency, availability, claim, attempts, processed time, and terminal failure. No production object store or worker is enabled.
