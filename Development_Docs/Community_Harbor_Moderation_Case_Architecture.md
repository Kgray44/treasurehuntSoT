# Community Harbor Moderation Case Architecture

`CommunityModerationCase` is the durable aggregate. Subjects, report links, evidence, assignments, events, actions, sanctions, appeals, appeal events, and restoration receipts are separate relational records. JSON is limited to bounded, versioned safe snapshots.

Moderator actions require a governed reason, expected revision, canonical role, correlation ID, and idempotency key. Actions against a moderator's own listing or release are denied. High-impact operations can require administrator approval through deployment policy. Reporter privacy is enforced by returning only a minimal receipt.

Evidence does not store private Chronicle prose, invitation material, exact location, private source media, object keys, credentials, or moderator notes in ordinary projections.
