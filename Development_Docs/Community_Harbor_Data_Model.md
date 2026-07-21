# Community Harbor data model

The eight additive models are catalog/profile, release, attribution/license/declaration, asset, and outbox foundations. `CommunityRelease` points to the immutable `PublishedTaleVersion` by ID and never to a mutable draft. JSON columns hold only versioned snapshots or bounded arrays; item taxonomy and release manifests are Zod-validated TypeScript contracts rather than an unbounded type-specific payload.
