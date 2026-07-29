# Community Harbor Phase 3 Test Plan

Focused tests cover query normalization/cursors/filters/sorts/facets/trending; public projection redaction; aggregate reconciliation; follows, blocks, saves, collections and accessible ordering; review eligibility/spoilers/votes/comments/reports; completed-session Keepsake generation; consent, EXIF/location sanitization, Voyage Log projection; guide/recommendation safety; server-success Lanternwake trigger guards; and invalid/forged IDOR cases.

Integration tests use an owned migrated SQLite copy and owned storage root. They prove only published Community records are discoverable, quarantined/removed delivery is denied, unlisted does not enter search, retries stay idempotent, rate limits use the shared policy, and active sessions stay byte-for-byte unchanged by Keepsake work.

Representative browser tests cover visitor discovery, public listing/profile navigation, Player follow/save/collection/review, completed Keepsake to consented Voyage Log, reduced-motion semantics, keyboard flow, mobile layout, and axe serious/critical findings. Production scanner, object storage, durable worker, distributed rate limit, MySQL execution, monitoring, and incident tooling remain external-unconfigured unless a real owned provider is supplied.

## Acceptance closure evidence

The final isolated Playwright suite is `tests/e2e/harborlight-phase3.spec.ts`. It creates synthetic owner, crew, foreign, listing, Guide, source, media and four-visibility Voyage Log fixtures only inside the nonce-bound disposable SQLite runtime. It validates discovery/history, Guide safety, keyboard/motion/mobile/Axe, opaque owner media, private/crew/unlisted/Community authorization and robots, spoiler/metadata redaction, collection mutation, foreign IDOR denial and CSRF rejection. The full unit suite supplies the deeper lifecycle, consent, provenance, checksum, search/deindexing, recommendation, interaction, Lanternwake and no-source-mutation matrix. The runner records canonical-family invariance, expected isolated mutations, two production restarts and released ports.
