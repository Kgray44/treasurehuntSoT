# Community Harbor Search and Discovery Architecture

Search indexes only `CommunitySearchDocument` records built transactionally from a published public listing, its immutable permitted release metadata, and its current public Creator projection. The document never serializes Chronicle source snapshots, session identifiers, private routes, answer material, Captain notes, hidden spoilers, raw storage keys, participant identities, or location precision.

Search is a bounded relational provider. The service normalizes input once, applies public-eligibility first, validates filters against enumerations, uses indexed predicates, then orders by the selected tuple plus listing ID. Cursor decoding rejects malformed/version-mismatched values. Facets and counts are computed from that already-eligible relation, so hidden records cannot affect counts. Unlisted content may be reached only by its direct public route and is never searchable.

The landing composes persisted featured records, recent public releases, safe trending, guides, Creator spotlights, and public Voyage Logs. It has no generic infinite feed. Recommendation rules are same category, same creator, compatible installed content, accessible alternatives, saved-together items, and recently updated dependencies; every result includes one safe human-readable reason.

Trending is a derived 14-day bucketed score: unique-actor installs weight 4, verified completions weight 5, saves weight 2, and eligible helpful votes weight 1; each contribution is capped once per actor/day/listing and decays by age. A reconciliation command recomputes aggregate counters and trends from authoritative relationship records.
