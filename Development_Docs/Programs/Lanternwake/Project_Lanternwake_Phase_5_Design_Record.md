# Project Lanternwake Phase 5 Design Record

Status: **CONTRACTS FROZEN; PRODUCTION RIVE ASSET AUTHORING BLOCKED**

## 1. Scope and inherited boundary

Project Lanternwake · Phase 5: Awaken the Relics covers production Rive, contained Lottie, physical PageFlip, and their accessibility/lifecycle behavior. It begins from committed Phase 4 baseline `497c50ed9a16291ecb3171c5351dbb5e19f84b8f`. Phase 4 implementation is frozen; its final integrated validation remains inherited work in progress and is not a Phase 5 pass.

Phase 5 preserves the existing SceneHost, Director, target ownership, event ordering, navigation, semantic text, fallback labels, and Phase 4 presentation structure. Universal Language remains the authority for terminology and visible copy. Phase 5 may only make structural animation changes to shared components.

## 2. Frozen production Rive contract

| Asset ID          | Export                                           | Artboard          | State machine       | Timeout | Reduced pose owner                                                                                 |
| ----------------- | ------------------------------------------------ | ----------------- | ------------------- | ------- | -------------------------------------------------------------------------------------------------- |
| `invitationSeal`  | `public/animations/rive/invitation-seal-v1.riv`  | `InvitationSeal`  | `InvitationSealSM`  | 5000 ms | `status`, `pinProgress`, `reducedMotion`                                                           |
| `journalClasp`    | `public/animations/rive/journal-clasp-v1.riv`    | `JournalClasp`    | `JournalClaspSM`    | 5000 ms | `openingPhase`, `pressure`, `reducedMotion`                                                        |
| `voyageCompass`   | `public/animations/rive/voyage-compass-v1.riv`   | `VoyageCompass`   | `VoyageCompassSM`   | 5000 ms | `bearingDegrees`, `courseProgress`, `connectionStatus`, `hasCourse`, `reducedMotion`               |
| `finaleMechanism` | `public/animations/rive/finale-mechanism-v1.riv` | `FinaleMechanism` | `FinaleMechanismSM` | 6000 ms | `stage`, `overallProgress`, `activeRequirement`, `requirementProgress`, `isReady`, `reducedMotion` |

The complete input schemas, documented numeric enums, states, fallbacks, version, and availability are source-controlled in `src/animation/assets/rive-contracts.ts`. Numeric state values are exported constants, never implicit array indexes. The Rive authoring specification is the required handoff for the genuine assets.

Rive owns only internal vector deformation and internal object state. Motion owns layout/presence, GSAP owns external narrative timing and container choreography, and CSS owns material/fallback presentation. No other runtime may animate an internal Rive vector or share its container transform.

## 3. Runtime lifecycle and accessibility

`RiveRuntime` has a bounded per-asset load timer, latest-authoritative signal-set application, visibility pause, runtime failure fallback, and mounted-runtime metric accounting. Signals arriving before a runtime is usable collapse to the latest authoritative snapshot; transient hover/validation history is not replayed. A timeout reports `timed-out`, selects the maintained fallback, and never leaves a blank canvas.

Rive canvas content is decorative (`aria-hidden`); semantic state remains in existing text/status surfaces. Pointer-only meaning is prohibited. Reduced motion uses the declared stable pose then permits only semantic input updates. The fallback carries the same object label and no visual object controls navigation or application state.

## 4. Lottie controller policy

Each Lottie contract declares an intentional representative reduced frame: Moonlit Waves 120, Rolling Fog 150, and Ink Bloom 72. Mode changes update speed/pause/frame in place; the effect initialization identity excludes motion mode. Ambient effects play only while the document and element are visible. Commanded one-shots do not autoplay or resume merely because visibility/mode changes.

`inkBloom` is controlled from the `ink-story` semantic label with the approved named segment. Other declared labels use the same asset segment only after a visible target has been preflighted. Lottie never controls map truth, form state, navigation, or server progress.

## 5. PageFlip lifecycle contract

StPageFlip exclusively owns curl geometry, drag/pointer/touch/keyboard/programmatic turns, page identity, orientation, and runtime page index. Consumers receive one semantic lifecycle: request intent, `turn-start`, `turn-commit`, `turn-settle`, `turn-cancel`, or `turn-failed`; the browser event includes mount, runtime generation, source, from/to page, outcome, and fallback mode.

Full and gentle modes retain the logical book and preserve page/focus through any necessary recreation. Reduced mode renders one accessible static page surface, preserves controls/page identity, and never mounts an accessible duplicate physical book. Hidden React sources, stale clones, temporary clones, and unproven clones are inert, inaccessible, and ineligible SceneHost targets. Page-turn audio is consumer-owned and may fire only after a commit.

## 6. Asset provenance and validation

`public/animations/manifest.json` is the asset ledger. A runtime-ready asset must exist locally, match its SHA-256, stay free of remote dependencies, and have a local fallback. A production Rive record lacking a project-owned export is `blocked_external_asset`, has a null hash, and carries an explicit reason. `npm run assets:validate` intentionally exits NO-GO while any such blocker remains; it does not confuse the development `rating-animation.riv` sample with production artwork.

## 7. Compatibility, cleanup, and integration

Phase 5 changes likely to overlap Universal Language: `InvitationCeremony.tsx`, `PlayerVoyageRoom.tsx`, `JournalWorkspace.tsx`, and possibly text-bearing tests. Final integration must use `development/lanternwake-phase-5-language-integration`, preserving Phase 5 structure and language-branch wording.

At unmount every Rive/Lottie/PageFlip runtime must release listeners, timers, cloned pages, and metrics. Production integration remains blocked until the four genuine Rive exports pass the manifest/contract gate; fallback behavior continues to be maintained and testable in the interim.
