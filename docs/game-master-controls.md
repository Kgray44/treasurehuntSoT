# Game Master controls

## Phase 2 controls

Authenticated progression supports map/route reveal, artifact award/silhouette/connection, side-quest discover/update/complete, journal annotation, player-facing log entry, finale tease, and generic finale requirement update. Each call requires session authentication, CSRF, explicit confirmation, a transaction, a domain event, a campaign snapshot, and an audit row. Development presets are CLI-only and never appear in the player or production UI.

Prepare, release, solve, artifact award, map reveal, pause, resume, and undo all use select → impact preview → confirmation → atomic execution → event receipt. The release transaction activates the chapter and reveals its intentionally imprecise map marker. Undo restores the latest save-state and emits `STATE_REVERTED` so players reconcile. Preview Reveal and Replay Reveal Locally are represented by the safe player replay control in this slice; a dedicated isolated GM preview timeline is future work.
