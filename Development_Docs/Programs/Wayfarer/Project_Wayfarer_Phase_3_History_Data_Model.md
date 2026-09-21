# Phase 3 History Data Model

`PlayerChronicleRecord` is unique by Player and source Voyage, references the
pinned published version, and stores immutable title/cover/Creator/participant
snapshots plus derived lifecycle and timing fields. `ChronicleReflection` and
`ChronicleMemory` are separate owner annotations. `VoyageKeepsake` is private
and `VoyageKeepsakeConsent` is participant-controlled. No table models artifact
ownership, achievements, public sharing, or analytics.
