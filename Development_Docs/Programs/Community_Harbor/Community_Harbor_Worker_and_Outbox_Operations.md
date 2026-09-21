# Community Harbor Worker and Outbox Operations

`CommunityOutboxEvent` remains the only durable queue. The worker atomically claims eligible rows, honors lease expiry, retries failures with bounded backoff, and records terminal failures. Unknown work is never silently discarded. Operational schedules enqueue work; they do not perform destructive cleanup directly.

Supported commands are `community:worker`, `community:providers:check`, `community:ops:status`, and `community:reconcile`. They emit safe summaries, not payloads or provider secrets.
