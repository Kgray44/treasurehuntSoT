# Journal system

Chapters use `LOCKED`, `TEASER`, `READY`, `REVEALING`, `ACTIVE`, `SOLVED`, and `COMPLETE`. Locked/ready chapters serialize only ordinal, state, and an explicitly safe teaser. Narrative, objective, clue, released hints, annotations, and cross-links serialize only for readable states.

Hints are ordered records with a nullable release time. The server omits unreleased hints. Viewed state uses the player access identity and stable content keys, so it reconciles across devices that share the invitation identity. Annotations are released `JournalEntry` records and never include GM audit metadata.
