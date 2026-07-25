# Community Harbor Social Interaction Model

Follows, blocks, saves, favorites, helpful votes, and collection membership are unique, idempotent actor-to-resource relationships. Self-follow and self-vote are rejected. Blocks are symmetric for interaction enforcement while retaining a directional audit record; either direction prevents social actions, comments, Creator response visibility, and public collection inclusion involving the blocked account.

Collections have `PRIVATE`, `UNLISTED`, and `COMMUNITY` visibility. Item ordering uses a unique integer position and a transactional reorder request; keyboard reordering uses the same request path. A collection may reference only eligible public projections, cannot contain itself directly or indirectly, and excludes hidden or blocked content from its public projection.

Reviews are one per profile/listing and carry an overall score plus type-aware dimensions. Verified installation is derived from an installation record; verified completion is derived from canonical completed-session evidence only. Spoiler-free and spoiler text are stored separately. Comments use sanitized bounded plain text/markdown, governed subjects, depth two, edit markers, tombstones, reports, and centralized limits. Creator responses are one current response per review and require listing ownership.
