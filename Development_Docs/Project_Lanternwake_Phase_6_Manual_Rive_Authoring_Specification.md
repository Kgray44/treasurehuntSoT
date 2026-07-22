# Project Lanternwake Phase 6 — Manual Rive Authoring Specification

Status: **MANUAL EDITOR AUTHORING SPECIFICATION AND EXPORT RECORD — Phase 6 program acceptance remains pending**

This document is the source-of-truth authoring plan for the four project-owned Rive files. It supplements, and does not replace, the frozen runtime contract in `src/animation/assets/rive-contracts.ts`. Native Rive timelines, state machines, inputs, transitions, and exported binaries remain required. Do not substitute the development-only `rating-animation.riv`, a third-party binary, or a scripted runtime replica.

## Manual-first authoring policy

The Rive Agent is not an implementation dependency for this project. Codex writes and maintains this specification, then uses the native Rive editor to create the imported hierarchy, timelines, state nodes, inputs, transition conditions, interruption paths, and exports. Rive Luau is permitted only for a narrow editor-native calculation that cannot be represented clearly in a state machine; it must not replace the frozen public input contract or application runtime. A mechanical local label-preservation step is permitted only where the editor export has retained a manually authored legacy input or state-machine type but omitted its user-facing contract label; it must preserve the binary record type, be documented, and be validated with the paired source/export artifacts. No Rive Agent request is made unless manual editor work and Codex-authored scripting have both been shown insufficient for the specific operation.

## Shared authoring rules

- One transparent artboard per file, with these dimensions: 512 × 512 for Invitation Seal, Journal Clasp, and Voyage Compass; 640 × 640 for Finale Mechanism.
- Preserve the canonical imported artboard names, use exactly one canonical state machine per file, and preserve the frozen public interface. Invitation Seal, Journal Clasp, and Voyage Compass expose that interface through the editor-authored `ViewModel1` data-binding instance; Finale Mechanism exposes it through native state-machine inputs. Inputs start at the defaults listed below; `reducedMotion` is a runtime command and starts `false`.
- Timelines are native Rive timelines. State transitions use a short ease-out blend (0.12–0.24 seconds) unless a one-shot needs its own exit time. A transition caused by `reset` always interrupts and returns to its stable reset/idle state.
- `reducedMotion=true` immediately selects the semantic static pose represented by the numeric or Boolean state. It must not play fractures, ring travel, overshoot, oscillation, debris, or repeated loops.
- Full mode may run the authored physical response. Gentle mode uses the same target states with 40–60% shorter travel and no decorative secondary loop. Meaning, status, and fallback text remain outside the artboard.
- A Rive Luau script is permitted only for bounded helper calculations (for example, compass shortest-angle normalization) when the state machine cannot represent them clearly. It must not replace the public state-machine contract or encode application truth.

## 1. Invitation Seal

### File contract

- Source/export: `lanternwake-invitation-seal-v1.svg` → `lanternwake-invitation-seal-v1.rev` and `invitation-seal-v1.riv`.
- Artboard/state machine: `InvitationSeal` / `InvitationSealSM`.
- Runtime interface: Rive data binding, `ViewModel1`, bound to the `InvitationSeal` artboard and `InvitationSealInputs` property group.
- Inputs: Boolean `isHovering=false`, `isFocused=false`, `isPressed=false`, `isListening=false`, `reducedMotion=false`; Number `pinProgress=0`, `status=0`; Trigger `accept`, `reject`, `expire`, `revoke`, `open`, `reset`.

### Required hierarchy

`InvitationSealArt`

- `WaxBase`
- `WaxEdge`
- `WaxSurface`
- `Crest`
- `EngravedRing`
- `NauticalMarks`
- `Highlight`
- `ContactShadow`
- `HeatGlow`
- `Cracks`
- `Fragments` (`FragmentNorth`, `FragmentEast`, `FragmentSouth`, `FragmentWest`, `Debris`)
- `RibbonContact`

### Timelines, states, and transitions

Create `idle`, `hover`, `focus`, `pressed`, `listening`, `validating`, `pin-progress`, `accepted`, `rejected`, `expired`, `revoked`, `opening`, `open`, and `resetting`. `idle` owns the stable poured-wax silhouette. `hover`/`focus` add restrained edge warmth only. `pressed` compresses `WaxSurface` and deepens `ContactShadow`; `listening`/`validating` add a contained crest pulse. `pin-progress` maps 0–1 to the ring fill without starting fracture travel. `accepted`, `rejected`, `expired`, and `revoked` are materially distinct held poses.

`opening` is a 0.70–0.95 second one-shot: pressure bulges the wax, hairline cracks appear, the crest gives, four asymmetric fragments translate/rotate apart, and debris settles. It must finish in `open`; it may not be opacity-to-zero or scale-to-zero. `resetting` returns fragments, cracks, and all material values to `idle`.

- Entry → `idle`.
- `idle` ↔ `hover` on `isHovering`; `idle` ↔ `focus` on `isFocused`; either returns to `idle` when false.
- Any stable state → `pressed` when `isPressed=true`, then back to the active semantic state when false.
- Any non-terminal state → `listening` when `isListening=true`; otherwise restore the current `status` pose.
- `status=1` selects `validating`; `status=2` / `accept` selects `accepted`; `status=3` / `reject` selects `rejected`; `status=4` / `expire` selects `expired`; `status=5` / `revoke` selects `revoked`; `status=6` or `open` selects `opening`; `status=7` selects `open`.
- `reset` interrupts every state, plays `resetting`, then `idle`.
- Reduced pose: set `reducedMotion=true`, then select status and pin progress directly; `opening` resolves immediately to `open` with no fragment flight.

## 2. Journal Clasp

### File contract

- Source/export: `lanternwake-journal-clasp-v1.svg` → `lanternwake-journal-clasp-v1.rev` and `journal-clasp-v1.riv`.
- Artboard/state machine: `JournalClasp` / `JournalClaspSM`.
- Runtime interface: Rive data binding, `ViewModel1`, bound to the `JournalClasp` artboard and `JournalClaspInputs` property group.
- Inputs: Boolean `isHovering=false`, `isFocused=false`, `reducedMotion=false`; Number `openingPhase=0`, `pressure=0`; Trigger `wake`, `release`, `open`, `interrupt`, `reset`.

### Required hierarchy

`JournalClaspArt`

- `LeatherAnchor`
- `LeatherTension`
- `ClaspBody`
- `Hinge`
- `LockingPin`
- `LatchTongue`
- `Rivets`
- `Engraving`
- `Patina`
- `MetalHighlight`
- `ContactShadow`

### Timelines, states, and transitions

Create `locked`, `idle`, `hover`, `focus`, `awake`, `pressure`, `releasing`, `opening`, `open`, `interrupted`, and `resetting`. `locked` shows closed alignment. `awake` lights the engraving. `pressure` takes 0–1 as shallow leather tension and pin preload. `releasing` retracts `LockingPin`; `opening` raises `ClaspBody`, rotates `Hinge`, releases leather tension, and ends in `open`. `interrupted` is a safe, fully seated locked pose or the stable open pose according to the incoming `openingPhase`; it may never leave the clasp suspended midway.

- Entry → `locked`.
- `locked` ↔ `hover`/`focus` on the matching Booleans.
- `wake` or `openingPhase=1` → `awake`; `pressure>0` or `openingPhase=2` → `pressure`; `release` or `openingPhase=2` → `releasing`; `open` or `openingPhase=3` → `opening`; `openingPhase=4` → `open`.
- `interrupt` or `openingPhase=5` interrupts current travel and selects `interrupted`; the next semantic phase chooses either `locked` or `open` without a floating intermediate.
- `reset` or `openingPhase=6` → `resetting` → `locked`.
- Reduced pose: `openingPhase` immediately chooses locked/awake/open/interrupted pose without pin, hinge, or leather oscillation.

## 3. Voyage Compass

### File contract

- Source/export: `lanternwake-voyage-compass-v1.svg` → `lanternwake-voyage-compass-v1.rev` and `voyage-compass-v1.riv`.
- Artboard/state machine: `VoyageCompass` / `VoyageCompassSM`.
- Runtime interface: Rive data binding, `ViewModel1`, bound to the `VoyageCompass` artboard and `VoyageCompassInputs` property group.
- Inputs: Number `bearingDegrees=0`, `courseProgress=0`, `connectionStatus=0`; Boolean `hasCourse=false`, `reducedMotion=false`; Trigger `seeking`, `setCourse`, `arrive`, `disconnect`, `reset`.

### Required hierarchy

`VoyageCompassArt`

- `OuterHousing`
- `Lens`
- `BearingRing`
- `CompassRose`
- `CardinalMarks`
- `PrimaryNeedle`
- `CenterPivot`
- `ProgressArc`
- `StatusLight`
- `Engravings`
- `GlassHighlight`
- `ConnectionAccent`

### Timelines, states, and transitions

Create `idle`, `seeking`, `bearing`, `course-set`, `arrived`, `disconnected`, `adrift`, `locked`, and `resetting`. `bearing` uses a normalized shortest-angle response for the needle: updates at 0°, 45°, 90°, 180°, 225°, and 315° must not cross a full revolution. If a native state machine cannot normalize shortest-angle travel, write a tiny Luau helper that maps the target heading to the nearest equivalent angle and only exposes the frozen `bearingDegrees` input to the runtime.

`seeking` is a bounded 0.6-second sweep and differs visibly from `disconnected` (dim status light, no heading claim). `course-set` uses `courseProgress` to fill `ProgressArc`. `arrived` emits one short contained light response and then rests. `adrift` is a non-looping low-energy held response; `locked` makes the heading mechanically fixed.

- Entry → `idle`.
- `connectionStatus` maps 0 idle, 1 seeking, 2 bearing, 3 course-set, 4 arrived, 5 disconnected, 6 adrift, 7 locked, 8 resetting.
- `seeking`, `setCourse`, `arrive`, `disconnect`, and `reset` trigger their matching semantic state and may be used before the numeric status update.
- `hasCourse=true` permits `course-set`; false returns to bearing/idle without erasing an authoritative current heading.
- `reset` → `resetting` → `idle`.
- Reduced pose: instantly place `PrimaryNeedle` at `bearingDegrees`, show the `connectionStatus` material, and do not sweep or overshoot.

## 4. Finale Mechanism

### File contract

- Source/export: `lanternwake-finale-mechanism-v1.svg` → `lanternwake-finale-mechanism-v1.rev` and `finale-mechanism-v1.riv`.
- Artboard/state machine: `FinaleMechanism` / `FinaleMechanismSM`.
- Runtime interface: native Rive state-machine inputs. The 13 contract labels are narrowly preserved after editor export by `scripts/repair-rive-contract-names.mjs`; the script does not change component, artboard, animation, transition, or input-type records.
- Inputs: Number `stage=0`, `overallProgress=0`, `activeRequirement=-1`, `requirementProgress=0`; Boolean `isReady=false`, `reducedMotion=false`; Trigger `tease`, `activateRequirement`, `unlock`, `complete`, `showHistorical`, `reset`.

### Required hierarchy

`FinaleMechanismArt`

- `RearFrame`
- `OuterRing`
- `MiddleRing`
- `InnerRing`
- `LockingPins`
- `RequirementSockets`
- `LightPaths`
- `CentralAperture`
- `LanternCore`
- `Engravings`
- `GlassAndGlow`
- `ForegroundFrame`

### Timelines, states, and transitions

Create `dormant`, `teased`, `sealed`, `partial`, `ready`, `unlocking`, `unlocked`, `complete`, `historical`, and `resetting`. `partial` has distinct visible checks at 0%, 25%, 50%, 75%, and 100% of `overallProgress`; `activeRequirement` identifies the changing socket and `requirementProgress` advances only that socket. `ready` visibly aligns the device but must not unlock automatically.

`unlocking` is a 0.9–1.3 second one-shot: completed `LightPaths` illuminate, pins retract, outer/middle/inner rings counter-rotate with different speeds and bounded inertia, engravings align, sockets synchronize, the aperture opens, and `LanternCore` expands. It ends in the stable `unlocked` pose. `complete` remains visually distinct from `unlocked` by retaining aligned rings and increasing the core/engraving completion material rather than replaying unlocking.

- Entry → `dormant`.
- `stage` maps exactly 0 dormant, 1 teased, 2 sealed, 3 partial, 4 ready, 5 unlocking, 6 unlocked, 7 complete, 8 historical, 9 resetting.
- `tease` → `teased`; `activateRequirement` updates `partial`; `isReady=true` allows `ready` but never starts `unlocking`; `unlock` or `stage=5` starts `unlocking`; `complete` or `stage=7` selects `complete`; `showHistorical` or `stage=8` selects `historical`.
- `reset` or `stage=9` interrupts all travel → `resetting` → `dormant`.
- Reduced pose: stage changes select the exact dormant, sealed, partial, ready, unlocked, complete, or historical static composition. No rings travel; sockets and core change only to the authoritative semantic pose.

## Native-editor and validation sequence

For each completed file: verify artboard bounds, semantic hierarchy, all inputs/types/defaults, all named timelines, graph states, transition conditions, reset, rapid interruption, and reduced pose. Save cloud state, export the `.riv` runtime file and `.rev` backup from the same revision, verify file size/timestamp, calculate SHA-256 for SVG/REV/RIV, and place the files in governed repository locations. Only then update the manifest, contracts/availability, provenance, tests, screenshots, and production screen evidence.

## Exported artifact record — 2026-07-22

The project-owned cloud files were manually edited and exported without a Rive Agent request. `npm run assets:validate` parses the runtime exports with the Rive WebGL runtime: it verifies the artboard, canonical state machine, bound `ViewModel1` where required, and every frozen property/input name and type. It also verifies each governed `.rev` source-pair hash and interface text.

| Relic            | SVG (bytes / SHA-256)                                                      | `.rev` source (bytes / SHA-256)                                             | `.riv` runtime (bytes / SHA-256)                                           |
| ---------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Invitation Seal  | 3,775 / `f6ae54ecc01ae5afad18d29d70059dfc82faf264283ef6a3bcf47b91e2adf7b7` | 22,116 / `259df9da1ed0d72d447a58224ff29de8bf739c30e0240809d0b9136bb5b027a8` | 7,148 / `3432c0fd2a06192ecde97c9e931045eaa8aab37025ab81f60234b75e2684c2f5` |
| Journal Clasp    | 2,980 / `226ce6d87efbd4b847627c40492582f454be56be438f658d6fa14f5362af29ff` | 17,431 / `57c9e198e167c945f5a412c8a0c8d37fbf137e4ceb5d30f885624163611f7c5a` | 5,138 / `0673ce171281bd63513eb3ade2e29a37d400577c300b2c89ce771fc25f3b0af2` |
| Voyage Compass   | 2,988 / `3305f71cf6e29419d6b766915771eb7b4ab8e97c9dae11c3046e103286b00b90` | 14,824 / `e51522c647bdd862f9ed2e046cc0129f5593c701061985d9bcbf1d8c30c49627` | 4,196 / `7dbbaa18d6487334bba5f77dff85f674a1f9294f7b43b8b96d4f165a3fe43f49` |
| Finale Mechanism | 3,723 / `eb2a8653d0b4ea094464e75b613787bd51037fbce02ee035535963cf1f64912d` | 23,947 / `022ef282c30abba40c3e3e8ce4fc6609a4b81f1e3bd7175df95c0064428e8341` | 7,387 / `6465b2540d031a64ef449d9c3ecac4cb8889534e8c821877b0f0f636dc5da6a1` |
