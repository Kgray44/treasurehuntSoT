# Protected Media Purpose and Consent Model

Supported purposes are `MEMORY_PRIVATE`, `KEEPSAKE_PRIVATE`, `KEEPSAKE_CREW`, `ARTIFACT_CABINET_PRIVATE`, `DISPLAY_CASE_UNLISTED`, `DISPLAY_CASE_PUBLIC`, `VOYAGE_LOG_DRAFT`, `VOYAGE_LOG_CREW`, `VOYAGE_LOG_UNLISTED`, `VOYAGE_LOG_COMMUNITY`, and `CREATOR_PREVIEW`.

The registry maps each purpose to one authority, allowed audience, media kinds, consent scope, derivative requirement, and cache behavior. A consent assertion must match the exact source checksum, consuming aggregate, purpose, authority revision, required scopes, and final derivative checksum before a public/unlisted grant becomes active. A changed source, derivative, revision, expiration, or revocation invalidates delivery.
