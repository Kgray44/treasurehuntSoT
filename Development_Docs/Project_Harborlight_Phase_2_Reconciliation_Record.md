# Harborlight Phase 2 reconciliation record

Base: `origin/main` `4a84b9fd2dfa439127c35b8ce865ff8b7a5742b7`.

The historical `beed2794974c6d0f16c03d13696b3dcab5601754` implementation is
preserved and was not merged or force-updated. Its design contracts, additive
migration plan, package verifier, pure install-plan logic, ports, and focused
tests are candidates for selective reuse after current-baseline reconciliation.

Rejected as stale: its move of the repaired public Community route back to
`/api/community/listings/[slug]/public`. Harborlight Phase 2 must retain
`/api/community/listings/public/[slug]` alongside the ID-based owner routes.

No historical schema, identity, storage, or release claim is authoritative
until it is revalidated against UserAccount-rooted identity, current One Voyage
and Sealed Hold boundaries, and the corrected route tree.
