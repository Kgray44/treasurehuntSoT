# Game Master controls

The Phase 3 Command Center uses select → server projection → consequence confirmation → atomic command → persistence receipt → separate delivery observation. It exposes Command Deck, Chapters, Hints, Voyage, Artifacts, Side Quests, Journal, Event Staging, Player View, Recovery, Audit, and Diagnostics.

No control sets arbitrary state. Chapter commands follow the seven-state machine, hints remain ordered, awards are unique, pause blocks progression, and undo emits a compensating event. Preview is watermarked and nonmutating. Critical finale/reset controls are absent. See [information architecture](command-center-information-architecture.md), [risk model](action-risk-model.md), and [recovery](recovery-and-reversal.md).
