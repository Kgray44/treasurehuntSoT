# Journal system

Chapters use `LOCKED`, `TEASER`, `READY`, `REVEALING`, `ACTIVE`, `SOLVED`, and `COMPLETE`. Locked/ready chapters serialize only ordinal, state, and an explicitly safe teaser. Narrative, objective, clue, released hints, annotations, and cross-links serialize only for readable states.

Hints are ordered records with a nullable release time. The server omits unreleased hints. Viewed state uses the player access identity and stable content keys, so it reconciles across devices that share the invitation identity. Annotations are released `JournalEntry` records and never include GM audit metadata.

`buildJournalPages` converts only the sanitized public snapshot into stable physical page IDs: hard covers, endpapers, title/dedication, chapter dividers, readable narrative/objective/riddle leaves, sealed locked leaves, and back matter. StPageFlip receives selectable semantic HTML, updates its existing instance with `updateFromHtml`, preserves safe current indices, emits orientation/page events, and is destroyed on unmount. Keyboard buttons and Arrow/Page keys turn pages. Reduced motion renders the same page model without page curl.

To add a page type, extend the discriminated page model and its secret-filtering/index-stability tests, render one semantic copy in `JournalWorkspace`, and keep its ID based on stable public keys. See `docs/animation/architecture.md`.
