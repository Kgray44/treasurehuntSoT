# Game Master controls

The Phase 3 Command Center uses select → server projection → consequence confirmation → atomic command → persistence receipt → separate delivery observation. It exposes Command Deck, Chapters, Hints, Voyage, Artifacts, Side Quests, Journal, Event Staging, Player View, Recovery, Audit, and Diagnostics.

## Cinematic controls

## Phase 3 cinematic controls

No control sets arbitrary state. Chapter commands follow the seven-state machine, hints remain ordered, awards are unique, pause blocks progression, and undo emits a compensating event. Preview is watermarked and nonmutating. Critical finale/reset controls are absent. See [information architecture](command-center-information-architecture.md), [risk model](action-risk-model.md), and [recovery](recovery-and-reversal.md).

The Phase 2 Player Companion consumes the same sanitized snapshot and immutable event stream. Its expanded voyage chart, relic altar, side-quest ledger, journal, Ship’s Log, and finale shell remain player-owned surfaces; Command Center changes must preserve their visibility filtering.
Prepare, release, solve, artifact award, map reveal, pause, resume, and undo all use select → impact preview → confirmation → atomic execution → event receipt. The release transaction activates the chapter and reveals its intentionally imprecise map marker. Undo restores the latest save-state and emits `STATE_REVERTED` so players reconcile. Preview Reveal and Replay Reveal Locally are represented by the safe player replay control in this slice; a dedicated isolated GM preview timeline is future work.

Quartermaster login is a physical key/bolt/cabin-door scene synchronized to the real session request. Every confirmed action maps to a distinct registered scene (ready ink, seal release, solved stamp, artifact light, map route, quest note/stamp, log entry, finale mechanism, pause/resume instruments, or undo absorption) rather than a generic overlay. The command begins only after the explicit confirmation sheet; animation failure never substitutes for the API receipt or audit record.
