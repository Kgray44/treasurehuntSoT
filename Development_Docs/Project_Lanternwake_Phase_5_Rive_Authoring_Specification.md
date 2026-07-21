# Project Lanternwake Phase 5 Rive Authoring Specification

Status: **EXTERNAL AUTHORING HANDOFF — no production `.riv` binary is present or claimed**

## Intake rules

The Rive author must create four original project-owned sources and exports in Rive editor. Do not derive them from `rating-animation.riv`; it is a development-only MIT sample. Do not rename an SVG/JSON/screenshot to `.riv`. Before intake, supply the editable source, exported `.riv`, tool/version, author, creation date, license/assignment, artboard and state-machine inspection evidence, SHA-256, and the matching manifest record.

Exports use the paths and names frozen in `src/animation/assets/rive-contracts.ts`, with one artboard and one state machine per file. Artboard internal vector transforms belong only to Rive. Artboards are 512 × 512 except the Finale at 640 × 640, transparent, contain-fit, with no embedded network assets, text required for accessibility, microphone input, or autoplay-only semantic behavior.

## Invitation Seal — `invitation-seal-v1.riv`

- Artboard/state machine: `InvitationSeal` / `InvitationSealSM`.
- States: `idle`, `hover`, `focus`, `pressed`, `listening`, `validating`, `pin-progress`, `accepted`, `rejected`, `expired`, `revoked`, `opening`, `open`, `resetting`.
- Inputs: `isHovering`, `isFocused`, `isPressed`, `isListening` (boolean); `pinProgress` (0–1); `status` enum (`idle=0`, `validating=1`, `accepted=2`, `rejected=3`, `expired=4`, `revoked=5`, `opening=6`, `open=7`); `accept`, `reject`, `expire`, `revoke`, `open`, `reset` (trigger); `reducedMotion` (boolean).
- Layer plan: wax body; pressed deformation; notched PIN ring; fracture lines; two bounded fragments; ribbon; stable open core. Hover/focus use only edge warmth; accepted must not imply opening before status changes. Expired and revoked must be distinct terminal materials.
- Reduced pose: no fragment travel; immediately settle to the status state and keep text outside the artboard authoritative.

## Journal Clasp — `journal-clasp-v1.riv`

- Artboard/state machine: `JournalClasp` / `JournalClaspSM`.
- States: `locked`, `idle`, `hover`, `focus`, `awake`, `pressure`, `releasing`, `opening`, `open`, `interrupted`, `resetting`.
- Inputs: `isHovering`, `isFocused`, `reducedMotion` (boolean); `openingPhase` enum (`locked=0`, `awake=1`, `releasing=2`, `opening=3`, `open=4`, `interrupted=5`, `resetting=6`); `pressure` (0–1); `wake`, `release`, `open`, `interrupt`, `reset` (trigger).
- Layer plan: brass plate; hinge; latch tongue; tension spring; leather shadow; short material settle. `openingPhase` is visual only: the application Journal phase machine remains authoritative.
- Required handoff mapping: closed→locked, entry activated→awake, latch releasing→releasing, cover opening→opening, book settling→open, skip/abort→interrupted or immediate open, replay reset→resetting→locked.
- Reduced pose: immediately locked/open, no repeated oscillation.

## Voyage Compass — `voyage-compass-v1.riv`

- Artboard/state machine: `VoyageCompass` / `VoyageCompassSM`.
- States: `idle`, `seeking`, `bearing`, `course-set`, `arrived`, `disconnected`, `adrift`, `locked`, `resetting`.
- Inputs: `bearingDegrees` (0–360); `courseProgress` (0–1); `connectionStatus` enum (`idle=0`, `seeking=1`, `bearing=2`, `courseSet=3`, `arrived=4`, `disconnected=5`, `adrift=6`, `locked=7`, `resetting=8`); `hasCourse`, `reducedMotion` (boolean); `seeking`, `setCourse`, `arrive`, `disconnect`, `reset` (trigger).
- Layer plan: aged-brass case; cardinal ring; needle; course ring; bounded wake accent. Bearing chooses the shortest safe path; seeking is bounded and never claims an authoritative heading; adrift is non-looping/budgeted.
- Reduced pose: set the exact bearing without travel and leave connection/course status distinguishable.

## Finale Mechanism — `finale-mechanism-v1.riv`

- Artboard/state machine: `FinaleMechanism` / `FinaleMechanismSM`.
- States: `dormant`, `teased`, `sealed`, `partial`, `ready`, `unlocking`, `unlocked`, `complete`, `historical`, `resetting`.
- Inputs: `stage` enum (`dormant=0`, `teased=1`, `sealed=2`, `partial=3`, `ready=4`, `unlocking=5`, `unlocked=6`, `complete=7`, `historical=8`, `resetting=9`); `overallProgress` (0–1); `activeRequirement` (-1 means none); `requirementProgress` (0–1); `isReady`, `reducedMotion` (boolean); `tease`, `activateRequirement`, `unlock`, `complete`, `showHistorical`, `reset` (trigger).
- Layer plan: chamber plate; outer ring; inner ring; requirement-socket group; central seal; bounded fracture group; chamber-light aperture. Ring inertia is internal Rive behavior, never a container transform. Requirement socket strategy: all rendered sockets are supplied by the artboard's named dynamic group; `activeRequirement` identifies the changed socket, never an arbitrary hard-coded product maximum.
- The author must implement OA-175–OA-188 within the stated ownership split. Sound-reactive accents are optional bounded internal accents driven only by approved app-provided amplitude in a later additive schema; silence, blocked audio, and reduced motion are functionally equivalent. Do not use microphone input.
- Reduced pose: show every semantic progression state and no ring travel/inertia; historical is a stable archive-safe pose.

## Authoring acceptance

For each exported binary, record Rive editor inspection proving all named artboards/state machines/inputs and capture the production screen in full, gentle, and reduced mode. Run `npm run assets:validate`, focused Rive runtime/component tests, the owning surface test, an unmount/rapid-replacement test, and the twenty-cycle resource baseline. Do not mark a binary ready until its manifest hash, fallback, source provenance, and on-screen authoritative state integration all pass.
