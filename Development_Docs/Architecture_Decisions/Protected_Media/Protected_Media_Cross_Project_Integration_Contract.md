# Protected Media Cross-Project Integration Contract

Wayfarer consumes the `WayfarerProtectedMediaPort` using server-validated owner/subject assertions and opaque media identifiers. Harborlight consumes `SealedHoldPublicDerivativePort`; it supplies an opaque source reference, purpose-bound consent assertion, visibility, publication revision, and idempotency key. Sealed Hold reads originals and stores derivatives internally.

At convergence, Harborlight's provisional `writePublicDerivative` implementation must be replaced or adapted so Harborlight does not receive raw source bytes. It retains Voyage Log lifecycle, publication, search, and projection invalidation. Wayfarer retains Memory, Keepsake, Artifact Cabinet, display-case, profile, and consent authority. No direct business-row mutation occurs in this branch.
