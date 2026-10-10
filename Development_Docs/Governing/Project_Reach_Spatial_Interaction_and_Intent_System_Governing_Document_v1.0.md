---
title: Project Reach Spatial Interaction and Intent System
audience: product-engineering
status: governing-baseline-not-implemented
canonical_for: project-reach-governing-v1.0
last_reviewed: 2026-10-09
version: 1.0
document_id: VW-REACH-001
---

# Project Reach

## Spatial Interaction and Intent System — Governing Document v1.0

**Governing principle:** Reach interprets deliberate user intent toward eligible digital objects. It never turns uncertain tracking into authoritative action. Pointing, highlighting, selecting, manipulating, activating, and transferring are distinct operations.

This document establishes the complete initial product and engineering constitution for Reach. It governs future implementation; it does not claim shipped hand tracking, qualified pointing accuracy, an operating laboratory, or completed integrations. The effective spatial architecture is the preserved v1.0 baseline plus its [v1.1 Reach amendment](Voyagewright_Spatial_Experience_Architecture_Governing_Amendment_v1.1_Reach_and_Browser_First_Interaction.md). Repository-wide verification remains Sounding Line.

## 1. Vision and scope

Voyagewright should let a Player point at a chart, see it highlight, deliberately select it, rotate or inspect it, and optionally carry its presentation to another paired surface. The same system must serve ordinary interface objects, Chronicle artifacts, Journal pages, map views, and Parallax entities. It is not a transfer-specific gesture recognizer or a substitute for accessible controls.

Reach answers **“What is the user trying to interact with, and which interaction intent can we responsibly emit?”** Its baseline is browser-first, foreground, permission-based camera interaction inside Voyagewright. Native providers are optional enhancements. A companion may supply better tracking or OS integration; it must use the same versioned observation and intent contracts.

Reach owns calibration, screen-space pointing, relative pointing, uncertainty, target acquisition, highlight state, selection, gesture grammar, manipulation intent, cancellation, recovery, interaction registration, and input arbitration. It does not own hardware permission truth, camera acquisition, visual landmark inference, Worldspaces, AR anchors, domain persistence, narrative completion, account authorization, or surface-transfer transactions.

The initial mandatory interaction set is point-to-highlight, deliberate pinch selection, constrained one-hand translation and rotation, grab/release intent, safe interruption, and complete conventional alternatives. Scale, two-hand manipulation, dwell selection, scrolling, page turning, and contextual menus are governed extensions with independent qualification. Push/pull and unrestricted six-degree-of-freedom manipulation are not baseline promises.

## 2. Authority and requirement vocabulary

MUST and MUST NOT are acceptance requirements. SHOULD requires a recorded reason when an implementation chooses otherwise. MAY identifies optional behavior, never an implicit completion gate. A future phase may narrow an unsupported modality without weakening the browser baseline or concealing the limitation.

Reach follows the spatial ownership treaty, Sextant, Watchglass, Parallax, Crossdeck, Storytide, Drydock, Sealed Hold, Harborlight, One Voyage, and Sounding Line inside their respective domains. This document supersedes earlier suggestions that Crossdeck should independently interpret raw hand observations into general interaction intent. It does not supersede Crossdeck's transfer state machine.

Every implementation decision must retain traceability to a Reach requirement, contract version, scenario, and evidence class. Proposed tuning values are not measured achievements. Qualification reports must separate specification targets, configured values, and observed results.

## 3. Ownership treaty

| Owner         | Owns                                                                    | Reach relationship                                                       |
| ------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Sextant       | Hardware capability, permission, camera lease/lifecycle, device motion  | Supplies capability state and camera access to observation providers     |
| Watchglass    | Visual observations, hand landmarks, pose/class evidence, abstention    | Supplies observations; does not select interface targets                 |
| Reach         | Calibrated pointing, eligible target selection, interaction intent      | Converts observations into bounded commands                              |
| Landfall      | Worldspace/navigation truth and journey state                           | Map adapter applies Reach intent to a view through Landfall APIs         |
| Parallax      | Spatial entities, transforms, constraints, anchors and scene authority  | Applies approved manipulation without surrendering spatial truth         |
| Crossdeck     | Pairing, receiving surface eligibility, custody and handoff transaction | Consumes Reach selection/grab/release intent                             |
| Storytide     | Authored narrative meaning and completion proposals                     | Interprets accepted domain outcomes                                      |
| One Voyage    | Canonical Chronicle progression                                         | Remains the only progression authority                                   |
| Lanternwake   | Material feedback, cinematic motion, accessibility-aware effects        | Presents state; never invents successful interaction                     |
| Drydock       | Chronicle validation, simulation and publication requirements           | Validates authored interaction contracts and alternatives                |
| Sounding Line | Software verification and Device Lab execution authority                | Qualifies implementation without mistaking simulation for physical proof |

Reach MAY host a thin Watchglass-governed browser hand adapter before general Watchglass implementation exists. Its model, coordinate semantics, limitations, and observation tests must be explicit. That does not declare the whole Watchglass project complete. A dedicated companion application remains a separate future implementation objective.

## 4. Product journeys

**Discover:** Enable hand interaction, receive a plain-language camera explanation, grant access, test visibility, choose absolute or relative pointing, calibrate if needed, and point at eligible objects. Highlighting never activates an object. A contextual guide explains supported operations without exposing implementation internals.

**Inspect:** Highlight an artifact, pinch deliberately, acquire a selection session, rotate through the artifact's declared constraints, release to finish the inspection transform, and use Reset if desired. A view transform does not alter ownership or completion.

**Navigate:** Highlight a chart or marker and use its permitted select/pan/zoom operations. Landfall retains route and Worldspace authority. Gesture motion changes presentation only unless an explicit domain command is separately authorized.

**Handoff:** Select a registered transferable object, grab after a stable target is visible, choose or acquire a paired receiver through Crossdeck, carry within the supported mode, intentionally release, and wait for transaction outcome. Source presentation departs only after the appropriate Crossdeck acknowledgment. Tracking loss is never a release.

**Recover:** On occlusion, suspend manipulation and show a recoverable status. If identity, permissions, layout, or calibration changes, cancel safely. Offer conventional controls and recalibration without trapping the Player in repeated setup.

## 5. Interaction states

The interaction state is separate from capability availability, visual observation quality, domain operation state, and Crossdeck transfer state.

| State          | Entry condition                                      | Permitted output               | Exit or interruption                |
| -------------- | ---------------------------------------------------- | ------------------------------ | ----------------------------------- |
| DISABLED       | User has not enabled Reach                           | None                           | Explicit enable                     |
| READY          | Foreground, supported provider, usable observations  | Point estimate                 | Point posture or disable            |
| POINTING       | Stable eligible pointing evidence                    | Reticle/target candidates      | Candidate, invalid evidence, cancel |
| HIGHLIGHTED    | Unambiguous candidate meets confidence and dwell     | Highlight and contextual guide | Select, target change, loss         |
| SELECTED       | Deliberate fresh selection edge accepted             | Selection intent and session   | Manipulation, activate, cancel      |
| MANIPULATING   | Explicit supported manipulation mode                 | Bounded preview deltas         | Deliberate end, loss, cancel        |
| SUSPENDED      | Tracking unavailable or quality below hold threshold | Freeze/hold indicator          | Reacquire or timeout/cancel         |
| COMMIT_PENDING | Domain accepts an end/activation proposal            | Pending feedback               | Owner accepted/rejected             |
| COMPLETED      | Owning subsystem confirms accepted operation         | Success feedback               | Neutral/rearm                       |
| CANCELLED      | Cancel or invalid session                            | Return/reset feedback          | Neutral/rearm                       |

There is no transition from HIGHLIGHTED to COMPLETED merely because a hand disappears. There is no transition from SUSPENDED to COMMIT_PENDING based on a timeout. A timeout cancels or expires; it never assumes success. Failure to classify a hand produces unknown evidence, not an open-palm event.

Transitions MUST be edge-triggered, idempotent, timestamped, and tied to one interaction session. A held fist observed in repeated frames cannot create repeated grabs. A reappearing hand cannot resume a prior operation until fresh identity and intent are confirmed. Recovery requires neutral posture or an explicit resume action, depending on the operation's declared policy.

## 6. Availability and lifecycle

Reach exposes supported, available, permission, provider readiness, calibration, tracking quality, foreground, and active mode independently. Permission granted does not guarantee a camera can be opened or a hand can be tracked. A supported model does not establish accurate pointing.

Capability outcomes include READY, DEGRADED, CALIBRATION_REQUIRED, NO_USABLE_HAND, AMBIGUOUS, PERMISSION_DENIED, CAMERA_BUSY, UNSUPPORTED, SUSPENDED, and ERROR. They must have recoverable guidance and a conventional fallback. No ordinary navigation or mandatory Chronicle progress may depend solely on Reach.

On tab hide, page freeze, lock, navigation, permission revocation, provider restart, camera track end, or lease loss: stop accepting new gestures; suspend or cancel current intent; release owned resources according to Sextant policy; invalidate stale results. Resuming restores capability discovery, not an old gesture edge. Hidden/background processing is never assumed reliable.

Only one authority owns each camera lease. Camera sharing with Watchglass or Parallax requires an explicit compatible lease policy; consumers must not open competing streams silently. Switching cameras increments provider generation and invalidates camera-dependent calibration. Cleanup stops tracks, workers, frame callbacks, model resources, subscriptions, and pending timers owned by the session.

## 7. Observation contract

The Watchglass hand provider supplies a versioned `HandObservation` envelope. Required fields are observationVersion, providerId/version, modelId/version/digest, providerGeneration, observationId, sequence, monotonicCaptureTime, monotonicInferenceTime, cameraLeaseId, cameraFrameVersion, frameWidth/height, orientation, mirrorTransform, hands, quality, and failure/abstention reason.

Each hand includes local trackId, trackGeneration, handedness estimate/confidence, normalized landmarks with validity masks, coordinate-frame declaration, optional world-landmark coordinates and their declared scale/reference limits, pose/class evidence, tracking/presence scores, occlusion indicators, and uncertainty where available. Confidence fields retain provider-specific meaning; they must not be treated as a calibrated probability unless validated as such.

Reach MUST reject nonfinite values, wrong schemas, incompatible frames, missing required metadata, sequence regressions, stale samples, excessive future timestamp offsets, and expired provider generations. It must distinguish missing measurements from zeros. Malformed data cannot create activation or release.

Hand world landmarks inferred from an ordinary RGB image are not automatically a metric pose in calibrated camera coordinates. A provider MUST NOT label them as display-relative depth, global coordinates, or verified six-degree-of-freedom tracking without additional calibration and evidence.

Track IDs are ephemeral session identifiers, not biometric identity. Handedness is a hint rather than proof of continuity. Cross-camera matching is not assumed; Crossdeck uses its transaction/session context and authorized receiver confirmation, not a universal hand identity.

## 8. Coordinate systems

Every vector or transform declares its frame, units, handedness, origin, and timestamp. The required frames are CAMERA_IMAGE_NORMALIZED, CAMERA_IMAGE_PIXELS, PROVIDER_HAND_LOCAL, CALIBRATED_CAMERA when available, DISPLAY_PLANE when calibrated, VIEWPORT_CSS_PIXELS, TARGET_LOCAL, and PARALLAX_SCENE only through a scene adapter.

Camera image coordinates use unmirrored normalized x/y from the actual frame. Preview mirroring is a presentation transform. Mirroring MUST be applied exactly once when converting preview expectations to interaction coordinates. The viewport uses CSS pixels and its current visual viewport offset/scale; device pixels are a rendering detail. Canvas/WebGL target pick rays require an explicit projection transform from CSS space to scene space.

Browser zoom, devicePixelRatio, scrolling, viewport resize, CSS transforms, camera rotation/cropping, camera movement, display movement, and layout changes must update or invalidate the relevant transform epoch. An old target rectangle cannot be reused after its version changes. DOM adapters must account for visibility, clipping, stacking, and modal exclusion rather than relying only on bounding boxes.

Multiple displays are separate calibration domains. Browser screen coordinates and window placement do not establish physical display geometry. Baseline absolute pointing applies to the calibrated active Voyagewright viewport. Cross-display pointing requires explicit calibration and qualification per configuration; OS desktop control is outside the baseline.

## 9. Pointing estimation

Absolute pointing estimates the location the Player physically intends to indicate on the visible display. Relative pointing maps hand movement to a virtual cursor. They are named modes with distinct instructions and qualification results. Relative pointing must not be marketed as physically accurate absolute pointing.

For geometrically calibrated pointing, a ray `p(t) = o + t d` intersects a display plane `n · (p - q) = 0`, giving `t = n · (q - o) / (n · d)`. Reject nearly parallel rays, intersections behind the hand, implausible origins, and measurements whose propagated uncertainty exceeds the acquisition bound. The selected finger segment or fused pointing axis must be declared and validated. A raw index fingertip x/y projection is not sufficient proof of where the Player points.

An empirical mapping may use stable joint/axis features with user-sampled targets to learn systematic bias. Fit with regularization and held-out validation. Do not fit an unnecessarily flexible model that passes its own training dots and fails adjacent targets. A hybrid estimator may combine a declared geometric prior with empirical corrections only when coordinate and uncertainty assumptions are compatible.

Point estimates contain position, mode, calibrationId/version, transformEpoch, uncertainty shape or bounded radius, confidence state, sample age, and supported region. Outside calibrated coverage, abstain or explicitly switch to relative mode; do not extrapolate with a confident reticle.

## 10. Calibration procedure

Calibration starts with camera placement and usable-hand checks, then approximately nine distributed reference targets, repeated stable samples, and a separate validation set. The exact sampling layout is versioned. Calibration records must cover central and edge regions; one central success cannot qualify the screen.

For each reference, explain how to point naturally. Accept samples only after stable posture, adequate visibility, and bounded motion. Retain enough repetition to estimate variance; reject obvious outliers with a declared rule. Avoid accepting a selection gesture as the pointing sample if that changes finger geometry. Clicking a calibration dot may indicate its known label but does not validate camera-based pointing.

The calibration output includes provider/camera/viewport bindings, mode, feature mapping version, validity region, residual distribution, validation errors, uncertainty model, creation/expiry, and coarse setup metadata. Report quality honestly and offer retry or relative mode if validation fails. Never hide a failed absolute fit behind strong target snapping.

Invalidate camera-dependent calibration after camera/device change, significant camera pose movement, mapping/model version change, mirror/orientation mismatch, or incompatible display geometry. Resize/zoom may be remappable only if the recorded normalized display mapping supports it and validation proves the transform. Otherwise require revalidation. Pose drift may be detected, but undetectable camera movement remains a limitation the Player can correct through a visible recalibration control.

Persist calibration only with explicit preference, minimal metadata, expiry, and per-account/device isolation. Reuse requires a quick independent validation. Do not upload raw video or share calibration between crew members automatically. Deletion resets calibration and derived personalization. No covert adaptation may change a completion-relevant interaction's semantics mid-session.

## 11. Uncertainty and filtering

Filtering must trade jitter against latency explicitly. A velocity-adaptive low-pass filter, One Euro-style filter, or equivalent may be selected after comparison. Record configured cutoff/gain and measured settling/lag. Outlier rejection precedes smoothing; smoothing cannot turn invalid samples into valid evidence.

Use bounded prediction only for visual interpolation, with a maximum horizon and uncertainty growth. Activation and release use observed evidence, never prediction alone. On abrupt reversal, reduce overshoot; on a stationary hand, stabilize without excessive delay. When sample age exceeds the configured freshness limit, stop motion and abstain.

Maintain separate raw, filtered, and snapped estimates in the laboratory. Product users see a comprehensible target response; diagnostics can reveal the three estimates with consent. A highlight should be steadier than the raw pointer, but the laboratory must still measure unsnapped pointing error.

Thresholds use hysteresis: acquire requires stronger evidence than retain, while minimum freshness and identity remain mandatory. All thresholds and dwell windows are versioned, bounded, and included in qualification evidence. Accessibility adjustments must not remove intentional confirmation for sensitive actions.

## 12. Eligible target registration

Components register an `InteractionTarget` with targetId, targetVersion, owner, surfaceId, semanticObjectRef/version, visibilityScope, geometryProvider, geometryEpoch, supportedOperations, constraints, feedbackPolicy, permissionEvaluator, fallbackActions, and lifecycle disposer.

Registration is explicit. Arbitrary pixels, private hidden content, browser chrome, another application, and unregistered DOM elements are not targets. A target registration cannot grant permission. The owning domain must check access and target version when selection begins and when a command is applied.

Supported operations may include HIGHLIGHT, SELECT, INSPECT, ACTIVATE, TRANSLATE_VIEW, ROTATE_VIEW, SCALE_VIEW, PAN_VIEW, SCROLL, PAGE_TURN, CONTEXT_MENU, and HANDOFF. Each operation names its owner callback, constraints, confirmation policy, interruption behavior, and conventional equivalent. A sign-out or delete control must never become a rotatable object merely because its registration exposes selection.

Destroying/unmounting a target removes its hit geometry and cancels attached sessions. Target identity is stable across rerenders but targetVersion changes when semantic identity or permissions change. A modal or focused text input may exclude background targets. Target registration must not leak unauthorized object titles into overlays or telemetry.

## 13. Acquisition and disambiguation

Candidate ranking considers uncertainty overlap, distance to eligible geometry, current visibility, declared priority, recent stable hover, and operation compatibility. Snapping is bounded by a documented region and uncertainty. A large target cannot steal a smaller intended target solely through priority.

A target becomes HIGHLIGHTED only after confidence and temporal stability pass the acquisition policy. Target switching requires leaving the retention region or sustained evidence for another target. If adjacent targets are indistinguishable within uncertainty, show ambiguity and request a deliberate choice, enlarge the selection surface, or use conventional input. Do not choose a target silently.

Selection locks targetId/version, operation, hand track generation, calibration version, surfaceId, geometryEpoch, and sessionId. Motion while holding does not retarget. A disappearing target cancels; it does not select whichever object now occupies the same pixels. Intent filters MUST NOT use secret clues, progression state, or unauthorized content to reveal hidden targets.

## 14. Gesture grammar

| Gesture      | Meaning                       | Conditions                                                   | Forbidden shortcut                         |
| ------------ | ----------------------------- | ------------------------------------------------------------ | ------------------------------------------ |
| Point        | Estimate and highlight        | Enabled mode, usable hand, eligible geometry                 | Automatic activation                       |
| Pinch        | Deliberate select or hold     | Visible target, normalized closure edge, stable confirmation | Repeated clicks from held pinch            |
| Fist/grab    | Grab intent                   | Selected/armed transferable or manipulable target            | Grab every visible object                  |
| Open/release | End deliberate hold           | Fresh observed edge from the same valid session              | Treat missing hand as release              |
| Twist        | Relative rotation delta       | Explicit rotation mode and supported target                  | Rotate arbitrary controls                  |
| Spread       | Scale delta                   | Explicit scale mode and valid one/two-hand geometry          | Infer metric depth from screen size        |
| Swipe        | Page/scroll intent            | Opt-in target and bounded direction/speed                    | Global navigation while gesturing casually |
| Dwell        | Optional deliberate selection | Enabled accessibility preference and visible countdown       | Destructive dwell-only command             |
| Cancel       | Abort intent                  | Escape, visible cancel, or qualified cancel gesture          | Commit on cancel timeout                   |

Pinch distances are normalized to a declared palm/hand scale, not fixed image pixels. Acquire/release use separate thresholds and duration windows. A classifier's canned pointing-up label is evidence of posture, not screen pointing direction. Gesture recognition must combine observation quality, explicit operation context, timing, and state.

The default grammar minimizes memorization. Contextual guidance appears on unfamiliar eligible targets and can be recalled. One physical gesture may serve different declared operations, but the active mode must be visible. Conflicting gestures abstain. Mode changes require explicit input, not an arbitrary classifier label fluctuation.

## 15. Selection versus activation

SELECT obtains an interaction session or opens an inspection preview according to the registered operation. ACTIVATE proposes an owner-domain action. These are separate intents even when a conventional click ordinarily performs both.

Non-destructive navigation may use a deliberate pinch activation when the target advertises it and the UI communicates the result. Purchase, deletion, sign-out, publication, account changes, and irreversible actions require the existing domain confirmation and authorization. Reach must not synthesize privileged browser user activation or promise to bypass platform permission prompts.

A selection receipt is ephemeral and contains no account authority. The owner revalidates target version, actor/session permissions, current state, and operation policy at application time. Replayed or late intents cannot operate on a new object version.

## 16. Translation and rotation

Manipulation begins with a reference hand pose and target transform. Subsequent movement yields relative deltas in declared target coordinates. Continuous deltas are previews unless the owner explicitly accepts live persistence. Use bounded gains, translation regions, quaternion normalization, and declared constraints.

Rotation uses relative orientation changes, not raw Euler angles that jump at wraparound. Constrain axes where the interaction calls for them; unwrap roll consistently; include a deadband for small tremor; cap angular velocity and discard implausible discontinuities. One-hand wrist-roll or palm orientation is an approximate control signal. It is not a claim of accurate full wrist pose under occlusion.

Reanchoring after occlusion preserves the displayed transform without jumping by establishing a new relative reference after explicit resume. Release may settle visual inertia only within owner constraints. Inertial motion cannot independently complete a puzzle or send content. Reset restores an owner-defined view transform.

For Parallax, Reach supplies requested deltas; Parallax performs anchor conversion, collisions, allowed degrees of freedom, shared-scene conflict resolution, and persisted scene updates. Reach must not detach a world anchor to make a gesture feel smooth.

## 17. Scale and two-hand interaction

Two-hand scale uses a reference separation and a bounded ratio; two-hand rotation uses a declared relative basis. Reject near-zero separation and degenerate axes. Maintain both track generations, neutral rearm, and continuity checks. Hand crossing, identity swaps, or loss of one required hand suspends or cancels; it does not collapse scale toward zero.

Targets declare min/max scale, rotation axes, and translation limits. Switching from one-hand to two-hand mode must preserve visual continuity and be deliberate. At most one active manipulation authority owns an object at a time. Two detected hands are not automatically one user's hands, so a bystander entering frame cannot seize an object.

Two-hand operations remain optional until real-device evidence demonstrates camera coverage and usable ergonomics. A mouse wheel, touch pinch, keyboard step control, or accessible slider must provide the same essential function. Extended arm holds and precision steadiness are not mandatory progress requirements.

## 18. Crossdeck handoff contract

Reach emits selection, grab, carry-preview, release, cancel, and interruption intent. Crossdeck owns the pending Handoff Intent, receiver authorization, ranking, claim, expiry, conflict handling, commit, and acknowledgment. Neither Reach nor Lanternwake may report transfer success from a visual animation.

Every handoff intent binds actor/session, source surface, object identity/version, Reach interactionId, operation mode, expiration, and Crossdeck transactionId. A release is accepted only in an appropriate transaction state with fresh intentional evidence or explicit conventional confirmation. Ambiguous destination choice requires user input. Moving the hand toward a phone visible to one camera does not prove physical device location.

The sender may keep custody through commit acknowledgment; strict moves retain a recoverable source until Crossdeck confirms the receiver. Duplicate and out-of-order release/ack messages are idempotent. Receiver failure returns or retains the source according to Crossdeck's contract. Tracking loss, tab suspension, camera restart, timeout, and network interruption never synthesize success.

Manual transfer remains independent of Reach, Watchglass, and camera permission. Crossdeck Phase 3 consumes Reach's qualified target acquisition and grip grammar. Crossdeck Phases 1–2 need not wait for Reach implementation.

## 19. Browser runtime

The baseline operates in supported secure-context browsers without installation. Camera access requires permission and real capability checks. Model/worker startup failure, unsupported execution backends, or constrained devices produce truthful unavailable/degraded outcomes and conventional alternatives.

Run inference away from the interaction/render thread where the chosen provider permits it. Maintain a bounded latest-frame queue: discard superseded frames instead of processing an increasing backlog. Timestamps must refer to capture/observation time rather than delivery time. Each result carries provider generation so late worker messages cannot revive an old session.

Rendering may interpolate feedback at display refresh while inference runs at an adaptive rate. Do not equate animation frames with fresh observations. Backend selection is provider-specific; WebGPU is not assumed universally available or supported by a chosen model. A tested GPU/WebGL/WASM path is accepted only when that provider actually implements it.

Quality reduction may lower frame size or sampling rate, but must preserve confidence/freshness gates. If throughput falls below safe interaction requirements, degrade to highlighting or conventional controls instead of accepting stale grabs. Model assets should be pinned and delivered through approved hosting with size, integrity, license, and caching records. Offline support requires assets already available; it is not guaranteed merely because inference is local.

The baseline cannot control other apps, inspect arbitrary desktop objects, guarantee uninterrupted background tracking, silently monitor games, or silently capture screens. User-selected browser screen sharing is a separate permission and provider route. Native monitoring/capture belongs to a future companion/provider objective, not Reach's browser baseline.

## 20. Intent envelope and dispatch

`ReachIntent` includes schemaVersion, intentId, interactionId, sequence, kind, actorSessionRef, surfaceId, targetId/version, operation, observationRefs, providerGeneration, calibrationRef/version, transformEpoch, generatedAtMonotonic, maxAgeMs, confidenceState, coordinateFrame, optional bounded delta, and cancellation/recovery reason.

No raw frames, biometric identifiers, private calibration vectors, or universal account credentials belong in this envelope. Validate all enum/units/frame values and finite numeric fields. The owner rejects unknown operation, stale intent, wrong surface, incompatible target version, invalid authorization, and out-of-order commands.

High-frequency previews are ephemeral and may be coalesced. Operation begin/end/cancel/owner acknowledgment must be ordered and idempotent. Delivery semantics are not exactly-once magic: use deduplication and explicit owner receipts for durable commands. Cancellation cannot be overtaken by a late preview or completion proposal from the same closed session.

Events include REACH_TARGET_HIGHLIGHTED, REACH_SELECTION_CONFIRMED, REACH_MANIPULATION_STARTED, REACH_MANIPULATION_UPDATED, REACH_MANIPULATION_ENDED, REACH_ACTIVATION_REQUESTED, REACH_GRAB_CONFIRMED, REACH_RELEASE_CONFIRMED, REACH_INTERACTION_CANCELLED, REACH_TRACKING_INTERRUPTED, and REACH_CALIBRATION_CHANGED. All are non-progression events. Storytide can turn an accepted domain outcome into a completion proposal; One Voyage decides progression.

## 21. Input arbitration

Mouse, touch, keyboard, assistive controls, and Reach can coexist. An explicit conventional action takes priority over speculative hover. Each target advertises input custody; a user changing modality cancels or hands off the active manipulation through a declared rule.

Reach MUST NOT move keyboard focus solely because of pointing hover. Focus and assistive announcements remain meaningful. A small contextual toolbar may expose the same operations to conventional controls. Avoid duplicate operations when a user pinches while also clicking. Session-level deduplication and modality ownership resolve conflicts.

Typing, scrolling another panel, opening a modal, or disabling camera interaction must suspend relevant target acquisition. Reach does not become a global cursor unless the Player explicitly chooses the supported relative pointing mode. Conventional inputs remain usable during provider failure and calibration.

## 22. Feedback and material behavior

Highlight feedback should be restrained, stable, high contrast, and consistent with object material. Acquisition confidence may affect a reticle or guide, but should not expose an unexplained probability score in ordinary play. Distinguish ambiguous, selected, holding, pending, accepted, and cancelled states visibly.

The lift/rotation/settle ceremony must follow accepted interaction state. It may smooth the visual transition but cannot hide failure or delay accessible confirmation. Sound and haptics are optional; every meaningful state has a visual/text alternative. Reduced motion removes unnecessary travel, inertia, and dramatic lifting while preserving state clarity.

Lanternwake owns cinematic styling and presentation timing. Reach owns state and bounded feedback requests; consuming components own semantic copy. Feedback must not imply the object has left the source before Crossdeck permits it. The visual illusion should be convincing because the transaction is coherent, not because uncertainty is concealed.

## 23. Accessibility and ergonomics

All essential tasks have keyboard, pointer, touch where supported, or assistive alternatives with equivalent outcomes. Physical pointing is optional. Offer relative mode, sensitivity adjustment, dwell selection with countdown/cancel, enlarged targets, alternate confirmation, hand choice, and guides that do not depend on color alone.

No required action demands sustained raised arms, fast repetition, two hands, standing, or precise wrist motion. Test seated posture, limited reach, tremor, left/right hands, different hand sizes, and accessible input transitions with consent. Accessibility options may change comfort parameters but cannot remove required domain authorization or irreversible-action confirmation.

Avoid claiming that disability-specific options have been validated without user evidence. Report which alternatives were exercised. Fatigue and user confidence are acceptance observations alongside accuracy; a numerically precise system that is exhausting does not pass final owner acceptance.

## 24. Privacy and security

Enable camera tracking only after an explicit explanation and user action. Request only needed camera access; no microphone by default. Camera processing is local by default. Network model loading is separate from frame upload. Raw frames and landmarks are not ordinary analytics.

Evidence recording is a separate opt-in, with purpose, retention, export/delete control, and bystander handling. Sealed Hold governs protected evidence storage. Calibration parameters remain private device/user context; Harborlight may distribute interaction definitions and public model assets, never private calibration or camera footage.

Reach is not identity verification, anti-cheat, liveness authentication, or proof that a particular person performed an action. Recordings, injected provider samples, and multiple hands can spoof observations. Domain permission remains mandatory. Restrict untrusted content from supplying executable gesture handlers, overriding confidence gates, or registering invisible privileged targets.

Constrain cross-origin messages and provider/plugin boundaries through explicit schemas, origin checks, leases, and session binding. Reject replayed intents. Logs use bounded reason codes and non-sensitive IDs; they must not expose secret clue text, unauthorized target names, raw calibration, or footage. Delete/disable stops future collection and follows existing owner retention policy for already accepted protected evidence.

## 25. Authoring and compatibility

An authored interaction definition declares version, target semantic reference, allowed operations, degrees of freedom/limits, preferred modality, fallback operation, confirmation/cancellation rules, visibility/access scope, domain outcome, and evidence requirements. Creators compose approved operations; they do not tune raw model confidence or install arbitrary camera code.

Definitions are immutable per published edition. Semantic changes require versioning and Drydock compatibility analysis. Improved tracking may not silently reinterpret an old puzzle's required gesture sequence. Calibration and personal tuning are runtime data, not shared Chronicle content.

Drydock rejects missing essential alternatives, unknown operations, invalid constraints, mismatched target kinds, hidden privileged activation, and progression claimed directly by Reach events. Warnings distinguish optional unsupported polish from blocked required mechanics. A fallback has the same essential narrative result without pretending to be the same physical evidence.

## 26. Laboratory requirements

Phase 1 delivers a real browser laboratory: permission/camera status, live observation quality, coordinate/mirror diagnostics, calibration, independent validation targets, raw/filtered/snapped overlays, session logs, bounded synthetic replay, and explicit export consent. Synthetic mode must be visibly distinct from live camera mode.

Test target size/spacing, density, overlap, edges, CSS transforms, scrolling, viewport scale, clutter, dim/backlit scenes, motion blur, camera placement, distance, left/right hand, hand crossing, partial occlusion, and provider restart. Record setup conditions without unnecessary private environment imagery.

Independent human trials use targets not included in fit training. Randomize target order and include no-action intervals, natural conversation/scratching movements, and distractor hands to measure false activation. Report failures and excluded samples; do not quietly delete difficult sessions. Every result identifies model, calibration, settings, browser/device, mode, and evidence tier.

## 27. Metrics and initial qualification targets

These are initial engineering targets, not claims of current achievement. Phase 1 freezes the exact reference hardware/browser matrix and reproducible measurement protocol before qualification. Changes need a versioned decision and owner acceptance; thresholds cannot be relaxed merely to close a phase.

| Metric                             | Initial gate                                                                         | Measurement                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Absolute unsnapped pointing error  | p95 at most 3% of calibrated viewport diagonal                                       | Held-out targets, valid live-camera trials; report edge regions separately                           |
| Target acquisition                 | At least 95% correct within 1.5 s on qualified targets                               | Minimum 48 CSS-pixel targets and 24-pixel edge gap on reference desktop; disclose angular size/setup |
| Adjacent/ambiguous targets         | Zero silent activation of unresolved ambiguity                                       | Deterministic cases plus physical dense-target trials                                                |
| Camera-to-visible feedback latency | p95 at most 120 ms on reference hardware                                             | Capture/observation to displayed response; report instrumentation uncertainty                        |
| Stationary reticle jitter          | p95 radius at most 1% of viewport diagonal                                           | Fixed intention intervals, unsnapped filtered output                                                 |
| Deliberate selection success       | At least 95%                                                                         | Live-camera selection trials with fresh neutral rearm                                                |
| False activation                   | Zero in deterministic adversarial fixtures; physical upper confidence bound reported | At least 600 no-action opportunities across the qualification cohort                                 |
| Tracking loss safety               | Zero loss-induced commit/activation                                                  | Occlusion, hide, permission revoke, stale data, restart and network fault scenarios                  |
| Manipulation continuity            | No identity-swap or recovery jump outside declared bounds                            | Scripted transforms and physical rotation/recovery trials                                            |
| Cleanup                            | No owned live tracks/workers/timers after teardown                                   | Repeated start/stop, navigation, failure and lease loss                                              |

With zero false activations in 600 approximately independent opportunities, the one-sided 95% binomial upper bound is approximately 0.5%; report sampling limitations rather than claim a universal zero error rate. Include per-participant results and mode-specific distributions, not only pooled averages. Failed tracking trials count toward usability outcomes even if pointing error is undefined.

Target snapping accuracy and raw pointing accuracy are reported separately. Relative mode gets its own acquisition/jitter results; it does not satisfy the absolute pointing gate. Subminimum dense targets must abstain or use disambiguation; passing oversized targets does not qualify arbitrary interface elements.

## 28. Evidence and scenario classes

D0 establishes deterministic contract/state/fault behavior; D1 establishes browser integration under emulation. Neither proves natural human pointing. D4 supplies controlled physical camera/hand evidence; D5 supplies field usability and environmental variation. D2/D3 are used only when the tested provider/runtime genuinely runs on those platforms.

Required scenario families are permission denial/revocation, camera busy, worker/model failure, calibration train-versus-validation separation, mirror/frame mismatch, zoom/resize, drift, stale/out-of-order samples, precision/dense targets, false gestures, track identity change, one/two-hand recovery, modality arbitration, privacy cleanup, and handoff release/ack faults.

The [Reach interaction registry](../Spatial_Experience/reach-interaction-registry.json) declares Reach-owned scenarios separately from the accepted 27-entry Device Lab baseline. They are not executable registrations or passing receipts. The later implementation must extend the shared loader's owner vocabulary and scenario catalog atomically with tests before registering the Reach pack. Existing Landfall and Device Lab evidence stays unchanged.

Evidence must bind exact source candidate, scenario/version, target/gesture definition versions, provider/model digest, configuration, calibration class, tier, setup, observed metrics, assertions, cleanup, and disposition. Physical runs need explicit provenance and consent; simulation must never be relabeled physical. Sounding Line retains verification authority and Drydock retains publication-validation authority.

## 29. Failure taxonomy

Failures include provider unavailable, permission denied/revoked, camera busy/ended, model unavailable, incompatible frame, calibration invalid/drifted, low quality, no hand, ambiguous target, hand identity changed, stale sequence, target changed/removed, unauthorized operation, unsupported constraint, modal conflict, domain rejected, receiver unavailable, transaction expired, and cleanup failure.

Each failure has an owner, safe state, reason code, user recovery, and evidence obligation. A generic ERROR that hides whether an operation committed is unacceptable. Reach cancels its intent; Crossdeck or another owner determines durable transaction state. When a durable result is uncertain, query the owner's receipt instead of retrying blindly.

Failures should preserve the user's place and provide a clear conventional continuation. No repeated camera prompt loops, automatic downgrade into weaker authorization, or silent continuation after identity loss. Reconnect and resume are new confirmation boundaries.

## 30. Phase 1 — Find the Hand

Deliver the browser runtime/provider boundary, lifecycle cleanup, versioned observation envelope, coordinate foundations, camera/hand quality diagnostics, calibration and held-out validation, and live/synthetic laboratory. A limited Watchglass-governed hand adapter may be implemented without waiting for unrelated Watchglass features.

Acceptance requires focused schema/fault tests, real webcam trials beginning here, honest raw pointing results, independent validation, permission/lease recovery, privacy controls, and conventional access to the laboratory. Freeze supported configurations and measurement protocol. Phase 1 does not claim qualified site-wide pointing, manipulation, or handoff.

## 31. Phase 2 — Take Aim

Deliver eligible target registration, geometry epochs, absolute and relative modes, bounded snapping, stable highlighting, disambiguation, selection grammar, and input arbitration. Qualify real target acquisition rather than calibration dot completion.

Acceptance requires the Phase 2 pointing/acquisition/selection gates in Section 27, dense/overlapping/edge targets, layout/zoom/mirror tests, no accidental activation, real left/right-hand trials, and accessible alternatives. Failed absolute pointing must remain honestly unavailable or limited. Do not close Phase 2 by renaming relative cursor control.

## 32. Phase 3 — Get a Grip

Deliver deliberate hold/grab/release, translation, constrained rotation, optional scale/two-hand modes, cancellation, reference reanchoring, target locks, and owner receipts. Freeze operation constraints and active modality rules.

Acceptance requires wraparound/degeneracy tests, physical wrist/occlusion/hand-crossing trials, no loss-induced completion, predictable bounded transforms, reset and conventional alternatives, and no stale session resurrection. Unqualified optional modes remain disabled and explicitly recorded, not counted as completed capabilities.

## 33. Phase 4 — Bring It to Life

Integrate eligible Voyagewright UI surfaces and the available owner adapters. Storytide consumes intent/outcome through its narrative contract; Parallax applies spatial deltas; Crossdeck Phase 3 consumes selection/grip intent and preserves transactional acknowledgment. Landfall view integration does not reopen its accepted program.

Integration depends on the respective owner implementation being available. Synthetic adapters can prove contracts but cannot close a live integration gate. Record blocked prerequisites explicitly. No blanket completion claim is allowed while a required owner integration is only mocked. Each integration needs domain permission checks, fault tests, user guidance, conventional alternatives, and end-to-end evidence.

## 34. Phase 5 — Make It Feel Natural

Complete the real-browser/camera matrix, environmental and ergonomic trials, performance and cleanup qualification, calibration persistence/deletion, privacy audit, accessibility review, feedback polish, and owner acceptance. Field qualification must include awkward camera placements and realistic mixed-input use, not only a curated demo.

Final acceptance requires every mandatory contract and scenario, physical evidence for all accuracy/ergonomic claims, available required integrations, documented optional exclusions, no unresolved unsafe transition, ordinary Sounding Line acceptance, and explicit owner review of the experience. A visually impressive demo cannot waive targeting or transaction failures.

## 35. Implementation and publication discipline

Each phase must leave a coherent mainline-safe state. Use focused validation during development and one ordinary Sounding Line final check for the frozen PR candidate. Never create a parallel release authority, bypass required checks, or use exhaustive certification as a development loop.

This governing publication includes the ownership amendments, registries, project home, launch dependencies, and documentation indexes. It authorizes documentation integration only in this task. Implementation remains a subsequent owner-directed objective. Documentation acceptance does not declare Reach Phases 1–5 complete.

## 36. Final acceptance checklist

- Browser baseline runs without a companion on explicitly qualified configurations.
- Camera acquisition, visual observations, intent, owner-domain action, and progression have separate authorities.
- Absolute pointing, relative pointing, target snapping, approximate rotation, and metric spatial tracking are truthfully distinguished.
- Target registration and authorization exclude arbitrary pixels and unauthorized content.
- Highlight, selection, activation, manipulation, and handoff have explicit confirmation boundaries.
- Tracking loss, stale frames, identity swaps, provider restart, hidden tabs, and timeout cannot commit actions.
- Conventional and accessible alternatives deliver every essential outcome.
- Real-webcam evidence qualifies pointing, latency, false activations, and ergonomics.
- Crossdeck success follows transaction acknowledgment; Reach events never advance One Voyage directly.
- Calibration and footage remain private; public content never contains private runtime evidence.
- Registries, scenario packs, indexes, and implementation status agree.
- Sounding Line verifies the exact candidate, and the landed tree receives a focused smoke check.

## 37. References and technical basis

The browser feasibility basis is the official [Google hand-landmark Web guide](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js), [Google gesture-recognizer Web guide](https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer/web_js), [Google hand-landmarker worker sample](https://github.com/google-ai-edge/mediapipe-samples-web/blob/main/src/workers/hand-landmarker.worker.ts), [W3C Media Capture and Streams](https://www.w3.org/TR/mediacapture-streams/), and [W3C Screen Capture](https://www.w3.org/TR/screen-capture/), reviewed October 9, 2026. These establish available building blocks and permission constraints; they do not establish Voyagewright pointing accuracy or universal backend support.

The algorithms, initial numerical gates, and interaction architecture above are Voyagewright engineering requirements. They require implementation and empirical qualification. Model choice and exact versions remain a Phase 1 design decision, with licensing/integrity review and reproducible evidence. No third-party documentation is treated as proof that Reach already works.
