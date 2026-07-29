# Community Harbor Rate Limit and Abuse Model

The existing process-local limiter remains suitable only for isolated development. Phase 4 adds a durable bucket model for a deployment-selected database provider. Keys must be derived from privacy-safe stable identities; raw emails, tokens, IP addresses, user agents, prose, and storage keys are forbidden.

Publication, reports, appeals, and moderation actions are high-risk writes and must fail closed when their required production rate-limit authority is unavailable. Results include bounded retry information and no identity-bearing diagnostic labels.
