---
title: Native Chronicle Lens Series Program Charter v1.0
audience: product-engineering
status: proposed-governing-charter-awaiting-protected-review
canonical_for: native-chronicle-lens-series-program-charter
last_reviewed: 2026-10-22
version: 1.0
document_id: VW-PARALLAX-NCL-CHARTER-1.0
repository_baseline: e0056ff3bdc4cb8b69fb6aa66a6dba831e25cdab
integration_reference: aaff919428ef9ab421579415ce3409949724760d
qualification_baseline: 90bff6ec281d79a6788c8270a8a3d67fd8257010
---

# Native Chronicle Lens Series Program Charter v1.0

> A native Chronicle Lens must faithfully realize the same immutable authored Scene on supported physical devices, preserve the intended spatial and interaction semantics, recover honestly from hardware and lifecycle failures, and never create independent Chronicle progression authority.

## 1. Document control and adoption

| Field                           | Control                                                                                                                                                  |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Program                         | Project Parallax — Native Chronicle Lens (NCL) series                                                                                                    |
| Parent authority                | Spatial Experience Architecture v1.0 with its additive Reach v1.1 amendment; Project Parallax v1.0 with its accepted amendments                          |
| Version and identity            | 1.0 / `VW-PARALLAX-NCL-CHARTER-1.0`                                                                                                                      |
| Purpose                         | Native implementation and qualification governance, increment boundaries, and evidence requirements                                                      |
| Status                          | Review candidate; effective as subordinate program governance only after applicable protected-main acceptance                                            |
| Implementation status authority | [NCL-01 implementation and acceptance status](../../Projects/Project_Parallax/NCL01_Implementation_and_Acceptance_Status.md), bound to inspected sources |
| Future assignments              | NCL-02 and NCL-03 below are **PROPOSED / AWAITING OWNER RATIFICATION**; publication alone does not ratify their scope or authorize execution             |
| Software acceptance             | Current Sounding Line authority and the protected `Sounding Line / Mainline Decision`                                                                    |
| Human acceptance                | Product owner walkthrough of the exact declared experience/build; independent physical evidence remains separately identified                            |
| Snapshot                        | Protected `origin/main` at `e0056ff3bdc4cb8b69fb6aa66a6dba831e25cdab`, fetched October 20, 2026, America/New_York                                        |

This charter establishes one discoverable program beneath existing owners. It does not replace a governing constitution, reopen a closed project, authorize an implementation phase, or accept an unmerged candidate. Requirements describe the intended native experience; the linked status record describes what was actually implemented and demonstrated. A requirement written here is not an implementation claim.

**October 22 qualification refresh:** this governance candidate adopts accepted main `90bff6ec281d79a6788c8270a8a3d67fd8257010`, including the accepted #790 unrelated-expired-R26 routing repair. The original #781 failed run remains failed; the repair preserves the registry, fixed execution deadline and every related-campaign gate. #790's protected merge exception applied only to #790 and supplies no exception or finite grant to this charter. NCL governance requires its own exact-source review and normal protected qualification; actual merge also requires current authorization, head/base freshness and the user's Studio-next product merge order. The [status record](../../Projects/Project_Parallax/NCL01_Implementation_and_Acceptance_Status.md) records current PR observations and the accepted dependency chain. This charter's original source/subset snapshot below remains dated October 20; no native product acceptance or future-increment ratification follows from this documentation source adoption.

MUST and MUST NOT are mandatory within the accepted increment's scope. SHOULD requires an explained disposition. MAY describes an optional supported capability. Future increment proposals and proposed numerical qualification profiles remain inactive until their stated owner decisions are recorded. Existing higher-authority gates remain effective throughout.

### 1.1 Authority and precedence

Read the [effective spatial authority index](../../Governing/Voyagewright_Spatial_Experience_Effective_Authority.md) additively. The operative hierarchy is:

1. [Global Product Governance](../../Governance/Voyagewright_Global_Product_Governance_Standard.md) for one coherent product, identity, discoverability, accessibility, visual quality and human completion.
2. [Spatial Experience Architecture v1.0](../../Governing/Voyagewright_Spatial_Experience_Architecture_Governing_Document_v1.0.md) plus [Reach and Browser-First Interaction v1.1](../../Governing/Voyagewright_Spatial_Experience_Architecture_Governing_Amendment_v1.1_Reach_and_Browser_First_Interaction.md) for cross-project boundaries.
3. [Parallax v1.0](../../Governing/Project_Parallax_Spatial_Chronicle_and_Augmented_Reality_System_Governing_Document_v1.0.md), the [Reach manipulation amendment](../../Governing/Project_Parallax_Governing_Amendment_v1.1_Reach_Manipulation_Intent.md), and the [A1 Spatial Assistant amendment](../../Governing/Project_Parallax_A1_Spatial_Assistant_Governing_Amendment.md) within their respective scopes.
4. Accepted adjacent-owner constitutions and amendments for their domains. The index resolves Sextant, Landfall, Reach, Crossdeck, Storytide, Watchglass, Drydock, Harborlight and Sealed Hold chains; none is absorbed into NCL.
5. This charter for native implementation increments under those boundaries. Conflicts are recorded and reconciled with the governing owner before implementation.
6. Current protected source for integrated implementation facts; immutable branch/source records for unmerged facts. An unmerged feature does not become mainline truth because this charter references it.
7. Exact increment plans, technical decisions and task contracts for bounded execution. They cannot weaken the authorities above.

[Sounding Line Effective Authority](../../Governing/Sounding_Line_Effective_Authority.md), its machine source `testing/sounding-line-authority.json`, and the [Device Lab annex](../../Governing/Project_Sounding_Line_Voyagewright_Device_Lab_Governing_Annex_v1.0.md) govern verification across this hierarchy. Sounding Line is a cross-cutting software acceptance authority, not a subordinate native release mechanism. The [Reach qualification annex](../../Governing/Project_Sounding_Line_Voyagewright_Device_Lab_Governing_Annex_v1.1_Reach_Qualification.md) adds applicable interaction proof without changing progression or protected-main authority.

### 1.2 Ownership and required interfaces

| Owner                        | Authority retained                                                                                               | NCL integration obligation                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Parallax                     | Scene/entity/version/instance, authored spatial content, Environment relationship, anchor and presentation truth | Realize the accepted semantic plan through platform adapters; propose spatial outcomes through Parallax         |
| Landfall                     | Physical/virtual Worldspaces, place, geographic context, routes and navigation                                   | Consume explicit world/context references; never infer geographic truth from an AR origin                       |
| Sextant                      | Generic hardware capability, permission, provider lease, lifecycle, sensor and power/thermal context             | Negotiate support and lifecycle; preserve existing Landfall compatibility seams until an authorized migration   |
| Crossdeck                    | Pairing, surface participation/roles, session synchronization, custody, handoff and reconnect                    | Reuse the same account and Voyage; do not invent a native pairing or second Player identity                     |
| Reach                        | Calibrated target acquisition, selection/manipulation intent and supported interaction capabilities              | Convert intent through Parallax constraints; preserve conventional touch/keyboard alternatives                  |
| Watchglass                   | Visual perception, recognition and evidence intelligence                                                         | Consume qualified observations with provenance and abstention; rendering a camera frame is not recognition      |
| Storytide                    | Narrative meaning, Chronicle experience and presentation integration                                             | Preserve narrative semantics and completion proposals; respect its scope-limited integration authority          |
| One Voyage                   | Authoritative Chronicle progression                                                                              | Native loading, picking, moving and rendering never directly advance the Chronicle                              |
| Drydock                      | Authoring verification, simulation, compatibility and publication validation                                     | Expose capability/fallback and content requirements for validation; native playback is not publication approval |
| Sounding Line / Device Lab   | Software qualification / shared platform execution and fidelity-labelled evidence                                | Register owner scenarios and use current qualification policy; create no NCL-only release authority             |
| Harborlight / Sealed Hold    | Immutable distribution / protected private content and calibration media                                         | Preserve package identity, access policy, consent, retention and privacy                                        |
| Figurehead / Wakebook / Helm | Character presence / private memories / Captain and crew authority                                               | Integrate only through accepted contracts; native display creates no character, archive or crew authority       |

ARKit/ARCore camera pose and anchors remain internal spatial-adapter inputs. Their use does not transfer generic sensor ownership from Sextant. Reach's browser-first rule remains binding for core Reach mechanics; native enhancements do not make the supported browser baseline depend on a companion.

## 2. Identity, purpose and product experience

The **Native Chronicle Lens series** implements Voyagewright's canonical spatial Chronicle experience through the existing iOS and Android companions. NCL is a delivery and qualification program within Parallax, not another Chronicle engine, Scene definition authority, account system or mobile product with independent story state.

The Creator authors one spatial intent and publishes immutable content. A Player opens that content through the active Voyage, understands why the device can or cannot support it, places or registers the Scene, discovers its objects, interacts, and returns to the Journal with canonical state intact. A supported browser remains a valid surface with an honest capability tier and a meaningful Guided alternative. Native presentation may be richer without changing object identity or the intended outcome.

### 2.1 Required human journeys

- **Open and understand:** from a published Chronicle or contextual companion entry, identify the active Scene and obtain a clear permission/capability decision. A black or empty camera without actionable status is not an accepted opening experience.
- **Place and discover:** follow bounded placement guidance; see objects at credible scale/orientation; understand tracking uncertainty; find required content without indefinite search.
- **Inspect and act:** select the visible intended geometry, identify the correct entity, perform an allowed action, see its result, and return without duplicate receipt or progression.
- **Leave and resume:** close Lens, background or interrupt the app, revoke permission or lose connectivity, then recover through an explicit supported path. The camera and owned resources release when the session ends.
- **Continue across surfaces:** when the accepted Crossdeck integration is available, preserve account, Voyage, edition, Scene and authorized participation through connect, handoff, reconnect and safe return.
- **Use a fallback:** decline camera permission, use unsupported hardware or need a non-AR mode, and still reach the authored accessible outcome with its evidence class honestly labelled.

Product acceptance covers these connected journeys. A standalone sample renderer, an internal TestFlight listing or a successful API request is evidence for its declared component only.

### 2.2 Scope and exclusions

In scope are canonical native Scene delivery, model/media realization for declared capabilities, local tracking and anchors, registration, selection and interaction, lifecycle and asset cleanup, deployment provenance, capability negotiation, fallback, physical qualification and integration through existing owners.

NCL does not authorize changing progression rules, duplicating authoring models, replacing Landfall or Sextant, inventing a Crossdeck protocol, silently rewriting Parallax Phases 1–6, publishing private room imagery, or treating all platform features as available. Room scanning, persistent/shared anchors, rich effects, hand interaction and advanced occlusion require their own supported scope and evidence. Their architectural home remains with the existing owner even if a future NCL increment supplies its native adapter.

### 2.3 Terminology

| Term                 | Meaning in this program                                                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Scene                | Canonical authored spatial definition/version and its immutable published content, consumed by a runtime instance                       |
| Environment          | Versioned authoring/context representation referenced by a Scene; not automatically a measured physical room map                        |
| Edition              | The immutable released Chronicle content identity selected by the active Voyage; native adapters cannot silently select another release |
| Scene instance       | Runtime materialization of an exact Scene within its authorized Voyage/session context                                                  |
| Delivery revision    | Version of the transport envelope; it does not rewrite the authored Scene checksum format                                               |
| Registration         | Explicit mapping from authored coordinates to the physical/native session frame, with provenance and uncertainty                        |
| Anchor               | Parallax-owned spatial reference whose provider representation may be session-local, persistent or shared                               |
| Tracking quality     | Current provider state and confidence/freshness, distinct from anchor identity and registration accuracy                                |
| Capability parity    | Equivalent supported meaning and fallback across surfaces; not a claim of identical APIs, graphics or physical accuracy                 |
| Owner observation    | A human report preserved with its provenance and limitations; not independent instrumented qualification                                |
| Increment acceptance | Acceptance of a bounded declared capability and coherent plateau, not automatic closure of Parallax or all native AR                    |

## 3. Canonical delivery and runtime architecture

The governing flow is authored content → immutable release/Scene plan → capability negotiation → Parallax resolution/registration → native realization → typed interaction outcome → canonical narrative/progression path. Sextant supplies device truth, Landfall world context, Crossdeck participation, and optional Watchglass/Reach inputs remain separately owned.

### 3.1 Immutable Scene, Environment, edition and asset identity

Each delivered Scene MUST bind the exact authorized Chronicle release/passage, Scene definition/version/checksum, instance and optional Environment revision. The authorization context must resolve the active Voyage, membership and current session; the renderer must not accept a content identity supplied solely by an unauthenticated client. Environment publication changes do not mutate an already released Scene pin.

An asset reference MUST bind asset/version, expected bytes or equivalent integrity metadata, digest, format, dimensions/units and permitted origin. Derived native representations must retain the source identity and any deterministic conversion provenance. Replacing a model with a visually similar native substitute does not prove authored asset fidelity. A runtime placement adjustment changes a resolved instance transform through owner policy; it does not edit the published definition.

Failures are explicit: unknown revision, stale checksum, unavailable asset, access denial, expired session and unsupported semantics each prevent invalid activation. A partial download or last-known cache must not silently materialize another revision. Public built-in catalog bytes remain public where already distributed; an authenticated association endpoint does not retroactively make those originals confidential.

### 3.2 Transport and staged activation

Keep small bridge messages bounded. Deliver large GLB/media bytes through authorized integrity-verified asset paths. Negotiate delivery versions and capability requirements before activation; preserve legacy transfer behavior for companions that support only v1. Unsupported newer content returns the authored Guided fallback rather than dropping meaningful entities or effects.

Activation is transactional at the session level: validate identities and structure, stage required assets, construct the graph, then acknowledge the exact committed generation. Cancellation, timeout, permission loss or a superseding generation invalidates pending callbacks. A late network or GPU callback cannot revive a closed Scene. Old transaction aborts cannot tear down a newer authorized Scene.

Update rules must distinguish immutable definitions from elapsed time, visibility, resolved transforms and permitted interaction state. State reconciliation must avoid duplicate application, hierarchy drift and animations restarting differently on each surface. An acknowledgement must describe actual activation, not only JSON decoding or a queued render request.

### 3.3 Native Scene graph and supported semantics

The native graph realizes stable entity IDs, parent relationships, anchor references, authored and resolved transforms, visibility/selectability and supported declarative behaviors. Graph roots, imported model nodes and collision/pick geometry must remain traceable to the canonical entity. Mesh names from an imported file are not Player entity identity.

Capabilities are evaluated against every enabled semantic requirement. An envelope carrying audio, timeline or effect descriptors does not establish native playback support. A renderer may implement a deliberately small subset only if negotiation rejects or truthfully falls back for the rest. Essential content cannot be silently approximated in ways that change the Chronicle's intended interaction or clue meaning.

### 3.4 NCL-01 implemented subset versus target

The [status record](../../Projects/Project_Parallax/NCL01_Implementation_and_Acceptance_Status.md) supplies exact sources and receipts. At this snapshot, unmerged NCL-01 source implements negotiated v2 delivery, original chest/compass GLBs, hierarchy and resolved transforms, native graph picking, staged activation and foreground asset/session cleanup. The advertised initial native capability set is `WORLD_TRACKING`, `PLANE_PLACEMENT`, `MODEL_GLB`.

The v2 envelope uses `RESOLVED_LOCAL_V1`, `LOCAL_Y_UP_NEGATIVE_Z`, meters, at most 32 entities and 16 anchors, within existing transport limits. It carries Scene and optional Environment identity and presentation descriptors. Unsupported requirements include richer enabled element classes, imported media, articulation, element playback and HIGHLIGHT where not advertised. Do not infer complete Scene semantics from schema coverage.

Protected main retains the accepted earlier companion and v1 transfer foundation. The v2/model work is on PR #741 and its TestFlight descendants, not accepted into protected main. NCL-01 does not establish automatic room registration, shared persistent anchors, rich Scene effects, all-device material fidelity or a complete native Player product.

## 4. Coordinates, transforms and registration

### 4.1 Frame composition

Every transform MUST identify source and destination frames, units, orientation convention and applicable version. For a local Scene, a useful conceptual composition is:

```text
native-world-from-model =
  native-world-from-anchor
  * anchor-from-scene
  * scene-from-entity-resolved
  * entity-from-model-source
```

This is a semantic description, not a new wire schema. An adapter must document which factors are already folded into the delivered resolved transform. It MUST NOT apply the authored parent transform twice. A single declared axis/pivot conversion normalizes model-source convention into Scene convention; platform-specific camera/view/projection matrices then map the same world geometry to display coordinates.

Current catalog originals use meters, +Y up, +Z front and bottom-center pivots; current delivery declares a local negative-Z frame. These facts must be reconciled by the actual adapter transforms, not by assuming the conventions are identical. Native hit-test and screenshot coordinates also need explicit origin/orientation/scale conversion. A Simulator readback Y correction does not prove physical touch-coordinate correctness.

### 4.2 Scale and orientation calibration

Authored physical size and source model size must remain distinct. NCL-01 applies resolved scale with authored width divided by source width, retaining embedded model transforms and glTF material intent. Later adapters must preserve this meaning or carry a reviewed conversion. Arbitrary bounding-box recentering, camera-distance sizing or unit guessing is unacceptable for a metric claim.

Registration records must identify origin, axes/yaw, scale policy, calibration revision, observation source, timestamp/freshness and uncertainty. A measured reference length or landmark set must include its independent measurement accuracy. Estimated reconstruction scale remains estimated. If the evidence does not distinguish absolute heading or scale, the product must not describe the Scene as aligned to the room with those properties.

### 4.3 Manual and automatic placement

Manual placement is a supported mode when declared by the authored policy. The Player selects or confirms a suitable surface and orientation, can inspect the result, and can retry without corrupting authored offsets. The product must explain whether moving the origin moves one entity, a group or the entire layout. Rotation/nudge/calibration controls are required only when the accepted mode promises them; their absence must remain visible in its limitation record.

Automatic registration is a separate capability. It needs a qualified correspondence between physical observations and authored Environment features, validated scale/orientation, confidence and rejection conditions. A plane hit, an Environment pin or successful camera opening is insufficient. Visual recognition belongs to Watchglass; Parallax decides spatial registration using authorized evidence. Unavailable or ambiguous correspondence requires abstention, explicit manual alignment or Guided fallback.

### 4.4 Floor, tabletop and environment mismatch

A horizontal plane detector does not prove that the plane is the floor. Placement guidance and confirmation must distinguish intended floor/tabletop use, object scale, reachable height and physical safety. A tabletop result cannot be silently accepted for a room-scale floor-authored Scene. Vertical surfaces require their own orientation and semantic checks.

Test mismatch deliberately: the wrong room, missing table, cluttered surface, reflective or low-texture floor, insufficient space and changed lighting. The native runtime must explain what cannot be resolved and offer an authored alternative. It must not shrink, scatter or relocate content merely to make the camera show something when that would alter the Scene's intended meaning.

### 4.5 Anchor confidence, lifetime and recovery

Anchor existence, tracking quality and registration accuracy are distinct. A valid provider handle can still have poor tracking or an incorrect room origin. Operations requiring stable geometry must be suppressed while quality is insufficient; the Player needs actionable guidance and a bounded recovery/fallback path.

Session-local anchors end with the declared session. Persistence across closing/relaunch requires explicit provider support, retained reference policy, reauthorization and relocalization proof. A disk cache or matching UUID does not establish a recovered physical pose. Re-anchoring must preserve Scene identity and apply only through the permitted instance/owner policy, with a new registration generation and clear user feedback.

Tracking loss must invalidate stale picks and manipulation references. Recovery must either re-establish the same accepted frame within its declared tolerance or obtain explicit re-placement; it must not invisibly jump the Scene and describe continuity as successful. Unknown confidence remains unknown, and an interrupted measurement is not a passing sample.

### 4.6 Shared-crew spatial consistency

Shared spatial truth remains Parallax Phase 4. One shared Scene/Voyage has one authoritative shared anchor identity/version; each device resolves that truth into its local provider frame. Crossdeck authenticates participation and transport/custody. Matching model files or two independently placed scenes do not establish shared registration.

Late join, reconnect, concurrent manipulation, platform differences and authorized re-anchor need explicit conflict/freshness rules. Shared-anchor provider outages must preserve privacy and safe fallback. NCL-01 local placement and proposed NCL-02 registration do not claim those multi-device capabilities.

## 5. Models, lighting, materials and visual fidelity

Native loading MUST preserve the original asset's geometry, hierarchy, pivot, orientation, scale, textures and supported material intent. Import/conversion must reject malformed or excessive resources and unauthorized external dependencies. Material compatibility includes color-space handling, alpha mode, metallic/roughness interpretation, culling and texture orientation. A successful decoder invocation does not prove rendered geometry.

Rendered acceptance must compare declared views of the exact original asset with authored reference intent, under controlled camera and lighting. Platform shader differences may be accepted through a bounded visual contract; an object losing a clue-bearing marking, transparency or silhouette is a semantic failure. Review actual packaged/loaded resources and native output rather than a separately generated preview.

Native lighting/environment estimation may improve integration when supported. Capability detection must distinguish light estimates, environment texturing, depth and occlusion. Occlusion must be tested with physical foreground geometry and a supported device before claiming that virtual content correctly passes behind real objects. Depth acquisition alone does not prove an occlusion compositor. NCL-01 Android explicitly reports depth occlusion false and disables depth mode; iOS lighting configuration does not establish LiDAR or full scene reconstruction.

Performance tiers may reduce optional visual cost while preserving required clue meaning, identity and interaction affordances. Unsupported essential visual semantics must select the authored fallback. Any removal of a meaningful capability or change in availability requires owner review and appropriate product/catalog governance at implementation time.

## 6. Interaction and canonical Chronicle handling

### 6.1 Geometry and entity identity

Selection must hit eligible visible geometry and resolve its nearest valid canonical entity association. Empty space, hidden objects, removed graphs, stale generations and ineligible interactions must not pick an arbitrary first object. Tests must distinguish at least two authored entities, misses, occlusion/depth ordering where supported, projection mapping and a graph removed after selection.

The interaction contract binds Scene/version/instance, entity, operation, surface/session generation and current authorization. Native touch and Reach-derived intent converge on the same Parallax domain validation. Reach does not write anchors or mutate shared transforms; Parallax applies constraints and returns the approved outcome.

### 6.2 Inspect, place and later semantics

NCL-01's bounded milestone includes real native Inspect of a selected authored object and return to the same Voyage. A camera-free mesh pick is supporting proof for selection only. Guided Inspect receipts do not independently prove the native touch → entity → authenticated outcome journey.

Place must respect authored constraints and preserve the relationship between anchor frame and entity offsets. Pickup/carry, articulation, complex manipulation, effects, audio and story-sensitive timelines require separate capability and outcome contracts. Preview, commit and cancel are distinct. Hand loss, tracking loss or backgrounding cannot synthesize commit or completion.

### 6.3 Runtime and progression separation

The native companion sends typed observations/outcomes through the existing Parallax/Player path. Current account, released content, membership, freshness and idempotency are revalidated. Storytide interprets accepted outcomes through the governed narrative path; One Voyage alone commits progression. Native renderer state is never an independent source of passage completion.

Network retry must not replay stale interactions into a new Scene or Voyage. Offline behavior must state whether an operation is display-only, queued under a governed policy, or unavailable. Where no accepted offline action contract exists, preserve the last safe canonical state and explain the unavailable action. Progression remains unchanged by model load, camera activation and fallback selection alone.

## 7. Platform requirements and capability negotiation

### 7.1 Common contract

Each provider must expose support, runtime availability, permission state, active generation and specific enabled capabilities. Installed app, signed binary, declared entitlement, available camera and working world tracking are different states. A device model name cannot substitute for runtime capability checks.

Capability negotiation includes OS/runtime version, rendering backend, camera availability, tracking/plane support, supported delivery and semantic requirements, quality tier, lifecycle limits and meaningful fallback. Permission refusal, revoke, busy camera, restricted device, unsupported AR services and failed provider initialization must remain distinguishable. No prompt loop or perpetual spinner may substitute for an answer.

### 7.2 iOS companion

Reuse `native/ios/LandfallCompanion`. Existing NCL candidate architecture retains ARKit `ARSCNView`/`ARWorldTrackingConfiguration`, SceneKit and GLTFKit2 model preparation. Replacing it with RealityKit is not a charter requirement or implicit authorization. RoomPlan, LiDAR, depth, scene reconstruction and persistent maps are optional additions with explicit support/privacy and physical proof.

Required qualification covers camera grant/refusal/revoke, world-tracking support, plane/surface mapping, authored transforms, mesh selection, light/material behavior, background/interruption and return, app close/reopen, cache cancellation and resource cleanup. iPhone and any advertised iPad configuration require their own supported matrix. Simulator Metal/SceneKit pixels are valuable graphics evidence, but do not instantiate physical ARKit tracking.

### 7.3 Android companion

Reuse `native/android/app`. Existing candidate architecture retains ARCore foreground tracking and a Filament model overlay. AR service availability/installation, permissions, camera ownership, display geometry, camera pose/projection and anchor tracking must be handled explicitly. The renderer backend and device/driver profile belong in the evidence.

Required qualification covers lifecycle pause/resume/destroy, surface/graphics teardown, anchor detachment, asset-worker cancellation, tap geometry and display rotation, network/session changes, compatibility and recovery. Depth API, environmental HDR, shared/cloud or geospatial anchors are separately negotiated additions. An Emulator GPU/Filament pass does not establish real camera composition, ARCore anchoring, OEM lifecycle, thermal or battery behavior.

### 7.4 Browser/native meaning and accessibility

Supported browser AR, native AR and Guided View must consume the same immutable meaning. Their capability tiers and evidence labels differ. Native handoff must be contextual and preserve current identity; it cannot send the Player into an unrelated sample Scene. A native-only enhancement must not break the accepted browser path.

Guided fallback must retain authored narrative, relevant entity descriptions, allowed actions and progression semantics without falsely claiming a physical measurement. Test large text, screen-reader navigation, touch/keyboard equivalents where supported, contrast, reduced motion, camera refusal and limited mobility. Native VoiceOver/TalkBack qualification and physical assistive interaction cannot be replaced by browser accessibility checks.

## 8. Lifecycle, cleanup and failure recovery

An increment must specify its session state machine and bounded transition outcomes: unavailable/permission decision, initializing, staging, active, limited/relocalizing, closing, closed, failed/fallback. These are required semantic distinctions, not a new state enum or migration imposed by this documentation.

During close or invalidation, cancel owned downloads and workers, invalidate generations, clear pending transfers and selection, release anchors and renderer resources, pause/end the owned camera session, remove observers and private caches, and report cleanup outcome. A cleanup method being called is not proof that OS, GPU or driver resources have actually been released.

Background/foreground policy must be declared per platform. If the safe policy is to close Lens and require re-entry, the UI must say so; it cannot claim seamless relocalization. Permission/session revocation invalidates interaction authority. Account sign-out or membership loss must not leave private Scene bytes available through an active native view.

Recovery testing must include interruption during asset staging and commit, during placement, during Inspect and after close. Late callbacks must be inert. Repeated close/reopen must preserve correct IDs and canonical state while producing bounded memory/resource behavior. Network loss, provider crash or unexpected dismissal must end in a recoverable state or a useful fallback, with private diagnostics and explicit unresolved cleanup where relevant.

## 9. Deployment, distribution and operations

### 9.1 Application identity and signed provenance

Extend the existing companions. The inspected iOS beta uses bundle `com.voyagewright.landfall`; this is an implementation fact, not permission to rename the product or create another app record. Android package/application identity and versioning must likewise be recorded from the actual signed build. Marketing identity, bundle/package identity, account identity and Scene identity are separate controls.

A distributable build needs exact source commit/tree, transport/generated-workflow identity where used, dependency/toolchain/configuration inputs, version/build number, app identifier, signing/profile metadata, packaged-resource verification and artifact digest. A workflow transport SHA is not automatically the implementation candidate SHA. Installation/readback must bind the physical device observation to the actual build; a later documentation commit or icon-only descendant is not a newly tested native behavior baseline.

Apple Developer enrollment, signing credentials/profile, archive/export, upload, Apple processing, internal availability, installation and physical behavior are separate gates. TestFlight beta availability is not App Store production approval. Reuse the [immutable TestFlight deployment runbook and receipts](https://github.com/Kgray44/treasurehuntSoT/blob/cd597b1274bddad70118b77dd65b13969dd55a8d/Development_Docs/Projects/Project_Parallax/NCL01_TestFlight_Deployment.md) rather than duplicating operational commands here. Builds 2–7 are recorded as consumed; future distribution must verify unused monotonically increasing build numbers.

Android test distribution must independently bind signed APK/AAB identity, source/configuration, tester channel, installation, supported devices and rollback. Apple distribution evidence does not qualify Android distribution. Production signing and publication are separately authorized operations, outside this charter task.

### 9.2 Origins, authentication and protected assets

Declare beta/production HTTPS origins and their exact host/origin policy. Normal certificate/hostname validation remains enabled. A private LAN CA and a public TLS origin have different trust/reachability requirements; changing network addresses can invalidate a build-bound LAN configuration. Laptop-hosted public beta availability still depends on its owned origin/tunnel/services and is not evidence of production operation.

Authentication must use the canonical Voyagewright account/session and current membership. Crossdeck authorizes additional surfaces; a native deep link or bridge message does not grant access by itself. Reauthorization and revocation must cover foreground resume and asset retrieval. Origin/CORS/ATS/certificate controls cannot be weakened to make a beta connect.

Integrity checks must verify expected bytes before loading, reject mismatched/stale releases and unauthorized redirects/resources, bound cache/download size and clear session-private assets according to owner policy. Scene integrity, asset integrity and authorization are all required; one does not substitute for another.

### 9.3 Beta, diagnostics and rollback

Beta configuration must be visibly distinguishable in operational records, with synthetic fixtures and isolated account/database/runtime state. A beta receipt cannot certify a production endpoint or private-content security that was not exercised. Signing material remains in approved protected storage, outside repository, chat and published logs.

Retain raw room geometry, photos, full private runtime traces and personal content privately under Sealed Hold/owner policy. Publish sanitized references, hashes, outcomes and evidence classification only. Diagnostic capture needs consent, bounded retention, access controls and cleanup. Public Scene identity must not embed room coordinates or private observations merely to simplify debugging.

Rollback must identify the last safe build/configuration and supported content versions, disable unavailable capabilities honestly, retain useful Guided access and preserve canonical progression. Beta rollback must not reuse consumed build numbers, delete failed receipts or downgrade authentication. Provider outage and revoked signing/distribution access need an owner and a documented safe failure path.

## 10. Evidence tiers and claim discipline

The seven NCL acceptance tiers below are a review structure. They do not rename Device Lab D0–D5, and they are not an automatic linear ladder: software integration can occur with explicitly limited physical claims, while product-complete native claims require the physical and human gates appropriate to their scope.

| NCL acceptance tier                          | Required evidence                                                                                                                        | Device Lab relationship                                                      | Does not establish                                           |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1. Static and contract verification          | Schema/source identity, invariants, compatibility, privacy and authority review                                                          | Static checks; D0 only where executable deterministic scenarios actually run | Executed graphics, tracking, usability or distribution       |
| 2. Native unit and integration               | Exact native tests and assertions, real model loader/graph and domain boundaries, cleanup outcomes                                       | D0 or platform-specific execution as actually used                           | Physical camera or anchoring from camera-free tests          |
| 3. Simulator and Emulator                    | Actual iOS/Android execution, rendered output/picks where claimed, host/profile/backend and failures                                     | D3 Apple; D2 Android; D1 browser only for its actual API emulation           | D4/D5, physical drift, battery, thermal or real-device touch |
| 4. Physical functional qualification         | Exact installed build, device/OS, permissions, camera, rendered geometry, interaction and lifecycle evidence                             | D4 controlled hardware                                                       | Measured room fidelity or full Player acceptance by itself   |
| 5. Real-world spatial fidelity               | Independent registration oracle, measured scale/orientation/placement/drift/recovery, representative environments                        | D4 for controlled measurements; D5 for representative field claims           | Unmeasured devices/environments or owner approval            |
| 6. Complete Player product acceptance        | Discover/open/place/find/act/leave/return/recover/fallback journeys and explicit owner decision                                          | Applicable D1–D5 evidence plus human walkthrough                             | Protected-main integration by itself                         |
| 7. Integration and protected-main acceptance | Reconciled exact candidate, required independent reviews, ordinary Sounding Line decision/seals, protected merge and landed verification | Sounding Line consumes applicable evidence                                   | Product/physical claims outside that accepted scope          |

Use these status terms precisely: **IMPLEMENTED** describes source; **SIMULATOR/EMULATOR VERIFIED** describes executed virtual proof; **OWNER-REPORTED PHYSICAL DEVICE OBSERVATIONS** describes owner testimony; **INDEPENDENTLY PHYSICAL-DEVICE VERIFIED** requires independently reviewable build-bound physical evidence; **PARTIALLY QUALIFIED**, **BLOCKED BY INTEGRATION**, **NOT YET IMPLEMENTED**, and **NOT YET ACCEPTED INTO PROTECTED MAIN** identify remaining boundaries. Multiple terms may apply to the same component.

A source-bound receipt must preserve producer identity, source/base/tree, build/configuration, scenario/assertions, device/runtime/backend, evidence tier, measurements/denominators, raw artifact hashes and custody, failures/skips, privacy and cleanup. A receipt that records a pass is retained evidence; this charter audit does not independently re-execute or rehash every original artifact. Current metadata readback and retained artifact review must be distinguished.

## 11. Physical acceptance protocol and bounded criteria

### 11.1 Freeze the claim before measurement

Before qualification, the owning increment MUST freeze its Scene/asset checksums, platform/builds, device/OS matrix, environment classes, mode (manual/session-local/calibrated/shared), independent oracle, sample counts, observation windows, thresholds and stopping rules. Record unsupported and unavailable rows explicitly. Never select the best camera angle, device or successful retry after failures and promote it to the whole denominator.

No universal centimeter, FPS or battery guarantee is invented by this charter. Absolute limits depend on declared use and devices. The candidate must supply numerical budgets or a strictly bounded qualitative criterion for each applicable row below. Missing budgets are an open acceptance decision, not a passing default. Existing stricter parent rules remain binding.

### 11.2 Required acceptance matrix

| Claim                                  | Required method and pass boundary                                                                                                                                     | Minimum bounded coverage                                                                                                     |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Actual rendered geometry               | Native output contains each expected original model; compare loaded digest, silhouette/markings, material and empty/loaded/removed views; no placeholder substitution | Every model class claimed by the increment on each advertised renderer                                                       |
| Correct object identity                | Select two distinct canonical entities; verify expected hit IDs, nearest eligible geometry, empty/hidden/removed/stale misses and operation authorization             | All enabled interaction classes; all planned attempts reported, zero wrong-entity receipts                                   |
| Scene placement                        | Record intended surface/origin/orientation and observed entity locations against an independent reference; error within predeclared translation/yaw/scale limits      | Every supported placement mode, including floor versus tabletop and an unsuitable-surface refusal                            |
| Anchoring/registration                 | Bind anchor/registration generation to the Scene and independently measured frame; retain uncertainty and mismatch rejection                                          | Local/manual baseline; calibrated, persistent or shared only when separately claimed                                         |
| Interactions                           | Native touch/intent → eligible entity → accepted domain outcome → same Journal; canonical progression only through the authorized path                                | Inspect and permitted Place/Pick baseline; negative/stale/unauthorized cases; every later advertised operation               |
| Tracking stability                     | Observe a predefined walk-around and dwell, record interruptions and registration drift against fixed references                                                      | Declared distances, durations and light/texture classes; no re-anchor hidden inside the observation window                   |
| Repeated opening/closing               | Reopen exact Scene; verify correct IDs/state, no late activation, camera release and resource trend                                                                   | Fixed cycle count per device; proposed baseline below; all failed cycles retained                                            |
| Background/foreground and interruption | Interrupt during staging, active placement and Inspect; verify declared resume/re-entry policy and no duplicate action                                                | At least one attempt per declared interruption class per device, with bounded recovery deadline                              |
| Network/session failure                | Disconnect while staging and active; restore, expire/revoke auth and test stale asset/Scene requests                                                                  | Every declared network state; zero unauthorized activation or duplicate authoritative progression                            |
| Memory/resource cleanup                | Compare warm baseline and post-close samples; observe owned camera/session/worker/anchor/renderer release and delayed callbacks                                       | Fixed sampling window and tolerance; plateau/no unexplained unbounded growth; driver-level claims need driver-level evidence |
| Compatibility                          | Run on declared physical device/OS/AR-service/render tier matrix and negative unsupported configurations                                                              | Each advertised platform and capability tier; no extrapolation from one iPhone to Android or all iPhones                     |
| Battery/thermal/frame time             | Measure actual devices under fixed Scene, brightness, network and duration; record idle baseline, frame quantiles, energy/thermal trajectory                          | Predeclared session duration and limits; simulated power state is insufficient for a physical claim                          |
| Accessible fallback                    | Refuse camera/use unsupported mode, navigate/read/act/return with declared assistive and conventional controls                                                        | All essential outcomes; VoiceOver/TalkBack and reduced-motion/large-text rows when native support is claimed                 |
| Complete journeys                      | Start at normal product entry; discover, open, place, find, Inspect/act, leave, return and recover without operator-only steps                                        | Owner walkthrough on exact build/Scene plus independent review of applicable physical evidence                               |

### 11.3 Proposed initial physical protocol

**PROPOSED / AWAITING OWNER RATIFICATION:** for the limited NCL-01 object slice, use one supported physical iOS device and one supported physical Android device, two original model types in one immutable clue, ten fixed open/close cycles per device, three independent initial placements per declared floor/tabletop mode, and three tracking-loss/background recovery attempts per device. Use a two-minute walk-around/dwell observation for each placement and a 20-minute active-session performance/thermal sample. Report every attempted case and stop a physical run on unsafe conditions, permission revocation or unresolved owned-resource cleanup.

These proposed counts are a reproducible starting protocol, not historical requirements already executed. Before running it, the owner/qualification plan must ratify device coverage, translation/yaw/scale/drift tolerances, recovery deadline, memory plateau tolerance, frame-time/energy/thermal limits and representative environment conditions. A missing Android device remains an unqualified platform row. It cannot be replaced by Emulator evidence or silently dropped while declaring both-platform completion.

For later room-registration claims, use independently measured landmarks and reference lengths that were not derived solely from the reconstruction being tested. Compare errors at multiple positions/orientations across the room; report measurement uncertainty and relocalization failures. Two estimated renderings agreeing with each other are not an independent physical oracle. Person-free/synthetic evidence and private physical evidence must retain their separate classifications.

### 11.4 Failure and acceptance disposition

Preserve original failures, assertions, timeouts, source identities and receipts. A later passing replay does not erase a failure or establish its cause. Repairs produce new evidence bound to the changed candidate; unchanged-source replay requires the applicable current authorization and must be reported separately. No NCL document grants reruns or consumes another owner's finite qualification allowance.

Owner feasibility observations are meaningful and may guide subsequent work. Product acceptance additionally needs an explicit disposition of the promised journey and limitations. Independent physical qualification needs reviewable measured evidence. Neither can be manufactured by rewording an observation or inheriting a TestFlight processing success.

## 12. Roadmap reconciliation and increment authority

### 12.1 Established history

The original owner brief names **NCL-01: Universal Scene Runtime & Native AR Expansion**. The retained [completion audit](https://github.com/Kgray44/treasurehuntSoT/blob/76d1787e1340e396bc95747293d43e57130b00ed/Development_Docs/Projects/Project_Parallax/evidence/ncl01-20261015/completion-next-action-audit-20261016T014011Z.json) binds that brief by SHA-256; the status record documents its direct inspection. It establishes three coordinated workstreams: shared runtime/assets, native iOS, and native Android. Both platforms belong to NCL-01's initial object-rendering milestone.

The inspected accepted authority, original brief and retained implementation/TestFlight planning records do **not** establish exact NCL-02/NCL-03 names, an iOS-only NCL-02, an Android-only NCL-03, an additional numbered NCL increment, or a serial iOS-then-Android policy. They do establish later separately validated work on richer content/effects, occlusion, scanning, shared anchoring and complete presentation. Search bounds and exact source identities are in the status record; this is a bounded finding, not a claim about every conversation ever held.

Parallax's accepted six-phase program already assigns adaptive staging/calibration to Phase 3, shared reality/Crossdeck/persistent anchors to Phase 4, rich artifacts/effects/integrations to Phase 5 and full qualification/closure to Phase 6. NCL is a native realization stream across those domains, not a renumbering of them.

### 12.2 Roadmap and dependency summary

| Designation                                              | Standing                                                             | Intended coherent plateau                                                                                                                                                                | Dependency and owner boundary                                                                                                                   |
| -------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| NCL-01 — Universal Scene Runtime & Native AR Expansion   | Established by original brief; implemented subset, acceptance open   | One immutable authored object clue through existing iOS/Android companions, correct model/transform, physical local anchor, real Inspect, canonical outcome and honest recovery/fallback | Shared contract first; both native tracks may proceed concurrently. Browser/continuity acceptance waits for governed owner integration          |
| NCL-02 — Native Spatial Registration and Fidelity        | **PROPOSED / AWAITING OWNER RATIFICATION**                           | Explicit manual/calibrated Scene-to-world registration with bounded scale/orientation/placement and recovery on both supported platforms                                                 | Reuse NCL-01 identities/adapters; Parallax Phase 3 owns calibration/adaptive semantics. No shared-anchor or automatic-scanning claim by default |
| NCL-03 — Native Scene Semantics and Player Qualification | **PROPOSED / AWAITING OWNER RATIFICATION**                           | A declared richer Scene capability profile and complete Player journey, tested on its advertised native matrix with meaningful browser/fallback continuity                               | Consume accepted registration where physical alignment is claimed, and accepted owner adapters for each richer semantic/integration             |
| Shared reality, rich artifacts and final program closure | Existing Parallax Phases 4, 5 and 6; no extra NCL number established | Owner-governed shared spatial truth, richer effects and final field/product closure                                                                                                      | NCL adapters participate through explicit later plans; this charter neither starts nor completes these phases                                   |

Development of independent native adapters, contract fixtures and isolated registration prototypes may be scheduled in parallel by a future authorized plan. Dependencies are capability/interface dependencies, not a mandatory calendar sequence between Apple and Android. Shared contract changes need one coordinated owner. Acceptance of a capability waits for the actual upstream interface and exact reconciled candidate, even if its platform implementation was developed earlier.

### 12.3 NCL-01 increment contract

**Exact designation:** NCL-01 — Universal Scene Runtime & Native AR Expansion. The PR's narrower title, “shared Scene delivery and native 3D asset slice,” describes its implemented candidate, not a new authoritative name for the whole mission.

**Purpose and scope:** extend existing companions with one canonical versioned delivery and original authored model rendering. The bounded initial milestone retains the original ten items: authored object, correct identity/transform, iOS rendering, Android rendering, physical ARKit/ARCore anchoring, browser semantic consistency, real Inspect, canonical interaction without duplicate progression, lifecycle/tracking recovery, and reproducible build/test/owner-review evidence.

**Prerequisites:** accepted Parallax runtime/Scene publication and v1 compatibility; canonical authentication/Player path; original asset identity/licensing; existing native framework; governed browser/provider and Crossdeck interfaces for the promised continuity portion. A future dependency landing does not by itself qualify NCL source.

**Required interfaces:** shared Scene delivery/transfer, authorized asset retrieval, native capability/permission negotiation, Scene graph/anchor mapping, interaction receipts, provider lifecycle, Guided fallback and existing Crossdeck participation/identity. Keep shared-contract edits coordinated; platform adapters consume the same version.

**Deliverables:** source-bound interoperable delivery, both native object loaders/renderers, stable graph/entity association, activation/cancel/cleanup, original asset fidelity, bounded manual/local placement and Inspect journey, compatibility/fallback, exact platform/build evidence and acceptance record. Reconcile TestFlight descendants explicitly rather than assuming PR #741 already contains their distribution changes.

**Non-goals of bounded closure:** complete rich Scene playback, RoomPlan/depth reconstruction, automatic recognition/room alignment, generic shared/cloud anchors, every imported asset/effect, all later artifact behaviors and Parallax-wide closure. The original broad expansion brief preserves those ambitions for separately validated increments; it does not make them prerequisites for the initial object slice.

**Mainline-safe completion boundary:** accept only the actually supported declared subset, retain v1 and truthful Guided behavior, and preserve canonical account/Voyage/edition/Scene and observation authority. If any physical or platform row remains open, an explicitly limited software integration may be described as such only through current authority; it cannot be called full NCL-01 initial-milestone acceptance.

**Acceptance and owner requirements:** applicable tiers 1–7 for the declared claim; initial both-platform milestone requires build-bound physical anchoring/Inspect/recovery on supported iOS and Android plus owner review of the same clue. Historical Simulator/Emulator proof remains supporting evidence. Browser/Crossdeck gates, ordinary protected qualification and owner acceptance stay distinct.

**Relationship to later increments:** supplies delivery, model and local interaction foundations. NCL-02 may improve registration; NCL-03 may expand supported semantics and complete richer journeys. Neither can retroactively substitute future features for missing NCL-01 physical object/Inspect/continuity proof or expand NCL-01 into the entire future AR product.

### 12.4 Proposed NCL-02 increment contract

**Designation and standing:** **NCL-02 — Native Spatial Registration and Fidelity; PROPOSED / AWAITING OWNER RATIFICATION.** This name and assignment are authored by this charter as a proposal, not recovered historical authority.

**Purpose and scope:** turn declared Scene placement modes into explicit, calibrated and explainable physical registration on both platforms. Establish origin/yaw/scale policy, floor/tabletop confirmation, authored-offset preservation, measurement provenance, uncertainty, environment mismatch rejection and tracking-loss/re-entry recovery. Automatic registration is included only if separately ratified with a qualified evidence provider and privacy contract.

**Prerequisites:** accepted or explicitly qualified NCL-01 interfaces; immutable Scene/Environment pins; a Parallax Phase 3 calibration/registration contract; Sextant capability/lifecycle context; physical devices and an independent measurement protocol. A missing richer owner implementation becomes a named dependency rather than a local replacement engine.

**Required interfaces:** canonical frame/transform definitions; registration revision and confidence; anchor lifecycle; supported placement controls and feedback; Environment observation provenance; safe re-anchor/update receipts; native capability/fallback reporting; Landfall references where physical Worldspace is involved.

**Deliverables:** documented provider-neutral registration semantics and per-platform adapters, manual/calibrated workflows, physical measurement matrix, recovery/mismatch results, privacy-safe diagnostics, current device limitations and a reviewed user journey. Proposed protocol and thresholds must be approved before they are used for acceptance; measurement windows/denominators remain fixed thereafter.

**Non-goals:** Scene schema authority, progression, room-scan data-model replacement, universal centimeter accuracy, automatically measured reconstructed rooms, shared crew anchor authority, Crossdeck pairing or native rich-content completion. Persistent anchors are excluded unless specifically ratified with their separate lifetime/retention and physical recovery proof.

**Mainline-safe completion boundary:** a declared placement profile works coherently on its qualified device matrix with explicit uncertainty and useful fallback. Other content/placement modes remain unavailable or use their accepted earlier mode. If NCL-03 never occurs, the bounded object experience remains useful and honest.

**Acceptance and owner requirements:** tiers 1–5 for actual registration claims, tier 6 for placement/recovery/fallback journeys and tier 7 for integration; measured position/yaw/scale/drift and recovery within predeclared limits against an independent oracle. Owner ratification must identify which modes/platforms are promised, thresholds, device matrix and whether automated correspondence is in scope. Exact-build owner walkthrough accepts the placement experience separately from independent physical measurement.

**Relationship to later increments:** provides a trustworthy spatial frame for NCL-03 and Parallax Phase 4 adapters. It does not accept crew-shared truth, all Scene interactions or Parallax Phase 3 as a whole.

### 12.5 Proposed NCL-03 increment contract

**Designation and standing:** **NCL-03 — Native Scene Semantics and Player Qualification; PROPOSED / AWAITING OWNER RATIFICATION.** It is not an Android-only increment.

**Purpose and scope:** realize a ratified richer capability profile of authored models, timelines, supported effects/audio/interactions and presentation, preserving Scene meaning across native and supported browser/fallback paths. Complete discover/open/place/find/act/leave/return/recover journeys for the advertised profile, with compatibility, accessibility, operations and physical performance evidence.

**Prerequisites:** accepted NCL-01 delivery/interaction foundations; accepted NCL-02 or another explicitly accepted registration profile for its physical claims; accepted Parallax behavior/artifact contracts; actual Crossdeck integration for promised continuity; Reach/Watchglass/Storytide adapters only when their supported integration is available. Future owner-project completion is not presumed.

**Required interfaces:** versioned semantic requirements/capability negotiation; native animation/effect/media presentation; visibility and interaction state; Reach-to-Parallax intent where used; canonical narrative/outcome path; accessibility and fallback equivalence; Crossdeck surface/Scene continuity; quality/thermal policy and bounded lifecycle.

**Deliverables:** an explicit supported/unsupported semantic matrix per platform, richer immutable reference Scenes, actual native rendering and interaction comparisons, complete Player/Creator-to-Player journey evidence, supported-device/OS matrix, failure/recovery/accessibility proof, deployment/rollback runbooks and an owner acceptance disposition.

**Non-goals:** adopting every possible AR feature, inventing another Chronicle engine, accepting shared anchors without Parallax Phase 4, implementing future Figurehead/Watchglass/Storytide systems implicitly, or closing Parallax Phase 6 solely through a native UI review. Richer content remains under Parallax Phase 5 ownership and its accepted contracts.

**Mainline-safe completion boundary:** each advertised semantic is faithfully implemented or has an authored equivalent fallback; unsupported content is not presented as supported. Published content and old companions remain compatible. A supported standalone native journey remains coherent even if future shared-reality or scanning work never ships.

**Acceptance and owner requirements:** all applicable tiers 1–7 for the declared capability profile; actual-device rendered meaning, interactions and registration, accessibility, fixed-duration battery/thermal/frame-time measurements, source-bound complete-journey review and explicit owner acceptance. Ratification must freeze the exact semantic list, advertised platforms/quality tiers, integration prerequisites and product-completion claim. No partial profile becomes universal “complete native Parallax.”

**Relationship to later work:** may satisfy native portions of Parallax Phases 5–6 only through their ordinary owner acceptance. Shared spatial reality and full cross-project program closure remain separately governed. No NCL-04 or later number is established by this charter.

### 12.6 Crossdeck and existing phase allocation

| Work                                                                              | Canonical ownership                                                            | NCL responsibility                                                                                                                             |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Contextual connect, same account/Voyage, role, handoff and safe return            | Crossdeck; current #721 dependency and applicable Product Experience authority | Consume accepted interface, reconcile exact source and supply native journey proof; do not duplicate design or consume owner capture authority |
| Local manual placement and initial physical Inspect                               | NCL-01 under Parallax native foundation                                        | Complete bounded object milestone; keep advanced registration separate                                                                         |
| Adaptive Environment semantics, calibrated registration and discovery             | Parallax Phase 3                                                               | Native realization/physical fidelity through ratified NCL-02 scope                                                                             |
| Shared anchor identity, crew consistency, late join and cross-platform resolution | Parallax Phase 4 with Crossdeck participation                                  | Supply explicit native adapters and device proof under a separately authorized plan                                                            |
| Rich artifacts/effects, spatial audio, optional perception/presence/memory        | Parallax Phase 5 plus adjacent owners                                          | Expand only the ratified native semantic profile; proposed NCL-03 is a packaging option                                                        |
| Full field, privacy/security/accessibility, performance and final closure         | Parallax Phase 6 and Sounding Line/Device Lab                                  | Supply native evidence and owner journey acceptance without replacing program closure authority                                                |

## 13. Current NCL-01 disposition and owner observations

The October 20 evidence establishes **IMPLEMENTED IN PART**, **SIMULATOR/EMULATOR VERIFIED** for identified components and **PHYSICAL-DEVICE OWNER OBSERVED** for limited iPhone feasibility/visibility. As of October 21, the Crossdeck upstream prerequisite has landed; the distinct NCL-01 product candidate still needs its own exact-source consumer/native and physical acceptance and is **NOT YET ACCEPTED INTO PROTECTED MAIN**. The original blocked integration evidence remains a historical outcome, not a current assertion that #721 is unmerged. NCL-01 is not declared fully accepted.

The owner directly confirms an Apple Developer account, installation of the native app on an actual iPhone, a successful simple bedroom native AR experience, and a positive impression of that real-hardware demo. Preserve these as **OWNER-REPORTED PHYSICAL DEVICE OBSERVATIONS**. They establish meaningful feasibility and must not be erased by an older “no signing/device installation yet” snapshot.

The later classroom record reports the correct Scene title, camera opening, an initially empty view and objects appearing on panning, followed by dissatisfaction with authored appearance. Native visibility is meaningful; all-three-object identity, exact installed build, measured alignment/scale/drift, native Inspect and full lifecycle were not independently verified. A reconstructed Environment and manually selected shared horizontal origin do not supply automatic classroom registration.

Signed TestFlight build 7 availability is recorded separately from installation and physical behavior of that exact build. The supporting status record reconciles source ancestry, the retained receipts and open gates. This charter does not restate every historical failure or deployment command; original records remain immutable at their source identities.

## 14. Findings, owner decisions and change control

### 14.1 Architectural and implementation findings

| Finding                                                                                    | Disposition / owner                                                                                                             |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Older NCL-01 record predates signing/physical visibility and still describes missing setup | Preserve history; use current status record to reconcile TestFlight descendants and owner observations                          |
| Room reconstruction/manual surface hit is not calibrated authored-room registration        | Record NCL-01 local placement limitation; proposed NCL-02/Parallax registration owner must define and qualify the stronger mode |
| Native v2 carries more descriptors than its advertised renderer capability subset          | Keep explicit unsupported negotiation/fallback; richer realization belongs to ratified later scope                              |
| Browser graph helper and Crossdeck continuity are not accepted through #741                | Hold integration claims pending actual owner dependency and source reconciliation; do not modify #721 or its finite authority   |
| Android physical hardware and complete both-platform milestone evidence are absent         | Keep physical Android row open; Device Lab/owner supplies a supported device and authorized protocol                            |
| iOS passing replay coexists with an earlier unknown-cause Home/background failure          | Preserve both receipts; lifecycle/physical qualification must address current behavior without inventing a historical cause     |
| Latest internal beta is not a production native release or exact-build physical acceptance | Distribution/operations owner supplies exact installation, supported matrix and separately authorized production readiness      |

These are recorded findings, not authorization to repair source, deploy infrastructure, rebuild or begin a subsequent increment.

### 14.2 Decisions requiring owner ratification

1. Whether to adopt proposed NCL-02/NCL-03 names and capability-oriented scope, or choose a different future packaging under the same owner boundaries.
2. Exact registration modes, platform/device coverage, independent oracle and numerical budgets, including the proposed initial physical protocol.
3. The richer semantic profile and supported browser/native quality tiers; whether any optional automatic registration, persistence, depth/occlusion or scanning capability is included in a specific increment.
4. The accepted Crossdeck dependency/interface and native complete-journey integration plan after its protected acceptance; this does not reopen or waive another owner's finite campaign.
5. Exact-build human acceptance and any explicitly limited integration claim while platform/physical gates remain open. Such a claim cannot redefine the original both-platform milestone as complete.

### 14.3 Publication and future maintenance

This is the sole NCL series charter topic. The status record is its factual companion, not a parallel governance registry. Program/project homes and the effective authority index link here; generated document indexes classify the files through the existing workflow. Future status updates cite exact sources and observation dates, retain older evidence and distinguish new source from previous qualification.

Changing increment ownership or a mandatory acceptance requirement needs an explicit owner decision and reconciliation with parent authority. Routine updates must not rewrite preserved Parallax constitutions, reassign One Voyage progression, alter historical receipts or promote a partial feature in the Feature Catalog. Documentation acceptance authorizes only this governance deliverable; implementation and deployment need their own bounded task and current acceptance process.

| Version                     | Date       | Change                                                                                                                                                                                            |
| --------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0                         | 2026-10-20 | Establish subordinate NCL program governance, evidence tiers, initial-milestone boundary and explicitly proposed future increment contracts; no product behavior changed                          |
| 1.0 review candidate        | 2026-10-21 | Record landed Crossdeck prerequisite and separate pending Studio/native lanes; preserve original source/evidence snapshot and unratified increment boundaries                                     |
| 1.0 local preparation       | 2026-10-22 | Reconcile accepted #789 documentation additively; preserve the original failed #781 run and expired-window diagnosis; await accepted guard repair and exact-source review before publication      |
| 1.0 qualification candidate | 2026-10-22 | Adopt accepted #790 unrelated-expiry routing, preserve original failed-run authority and all accepted records, and require own current-source ordinary qualification without inherited exceptions |
