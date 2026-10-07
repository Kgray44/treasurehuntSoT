---
title: "Project Drydock Governing Amendment v1.1"
subtitle: "Spatial Provider, Parallax, Crossdeck, Device Lab, and Spatial Publication Verification Integration"
author: "Voyagewright Engineering"
date: "October 7, 2026"
version: "1.1"
status: "Post-Closeout Governing Integration Amendment"
document_id: "VW-DRYDOCK-AMD-1.1-SPATIAL"
repository: "Kgray44/treasurehuntSoT"
repository_baseline: "2cdb32ec504a4396092e9a0237661ee365ce9caf"
amends: "Project Drydock Governing Document v1.0"
---

# PROJECT DRYDOCK v1.1 AMENDMENT

## Spatial Provider, Parallax, Crossdeck, Device Lab, and Spatial Publication Verification Integration

> **Governing Principle**  
> Drydock proves that a spatial Chronicle is authorable, coherent, safely simulatable, capability-compatible, accessible, privacy-safe, and publishable. It does not render AR, drive device sensors, pair surfaces, recognize the world, or mutate a live Voyage. Spatial systems provide typed contracts; Drydock verifies the authored combination before Players are asked to trust it.

Project Drydock is already accepted through Phase 4, **Clear for Launch**, on protected main. This amendment does **not** create Phase 5 or reopen the completed program. It adds a post-closeout integration contract for the spatial-experience architecture introduced after Drydock's original governing baseline.

---

# 1. Authority and Scope

This amendment is subordinate to:

1. Voyagewright Global Product Governance Standard.
2. Voyagewright Spatial Experience Architecture v1.0.
3. Project Drydock Governing Document v1.0 and accepted Phases 1-4.
4. Project Sextant v1.0.
5. Project Parallax v1.0.
6. Project Crossdeck v1.0.
7. Project Landfall v1.0/v1.1 plus v1.2 boundary amendment.
8. accepted Storytide, Watchglass, Figurehead, and Wakebook spatial integration amendments.
9. Project Sounding Line effective authority and Voyagewright Device Lab governing annex.
10. Project One Voyage authoritative progression.
11. current protected repository source.

This amendment is authoritative for Drydock validation of:

- Spatial Moment authoring;
- Parallax spatial definitions and exact version pinning;
- Sextant capability requirements;
- Landfall Worldspace/place dependencies;
- Watchglass evidence dependencies;
- Crossdeck surface-role requirements;
- Figurehead spatial-presence references;
- Wakebook spatial-memory opportunities;
- Discovery Assistance;
- adaptive/shared placement semantics;
- spatial privacy and calibration rules;
- spatial provider simulation;
- Device Lab evidence requirements;
- Harborlight spatial package/install/remix validation;
- publication readiness for spatial content.

It does not grant Drydock runtime ownership.

---

# 2. Current Drydock Truth

Accepted Drydock Phase 4 already provides:

- strict typed Story Block contracts;
- variable/expression validation;
- whole-Chronicle static analysis;
- deterministic Sea Trial simulation;
- provider outcome simulation;
- fault injection;
- required scenario-suite policy;
- compatibility and publishing evidence;
- immutable source-bound readiness;
- SQLite/MySQL migration parity;
- One Voyage runtime-fidelity proof.

The existing required-scenario policy already requires explicit provider match/no-match/unavailable and reconnect/unavailable behavior for provider-dependent Chronicles.

Spatial integration extends those mechanisms. It does not create a separate “AR validator” beside Drydock.

---

# 3. Fundamental Boundary

Drydock answers:

> **Can this exact authored Chronicle version safely and coherently use the spatial/device/multi-surface capabilities it declares, including all required fallbacks, before publication?**

Drydock does not answer:

- whether an iPhone sensor actually behaves correctly - Sextant + Device Lab + Sounding Line;
- whether an AR anchor remains stable in a room - Parallax + Device Lab;
- whether a camera view matches a landmark - Watchglass;
- whether the Player is actually in a location - Landfall;
- whether the phone is paired to the same person - Crossdeck;
- whether the story advances - One Voyage.

---

# 4. Spatial Extension Contract

Drydock's extension/provider registry MUST support spatial capability families without collapsing them into one opaque provider flag.

Representative capability classes:

```text
DEVICE_CONTEXT
WORLD_CONTEXT
SPATIAL_RENDERING
SPATIAL_ANCHORING
ADAPTIVE_PLACEMENT
SHARED_SPATIAL_SCENE
VISUAL_EVIDENCE
MULTI_SURFACE
SPATIAL_MEMORY_CAPTURE
SPATIAL_CHARACTER_PRESENCE
```

Each extension declares:

- owner;
- version;
- required config schema;
- completion/evidence contract;
- simulator adapter;
- unavailability result;
- accessibility/fallback semantics;
- privacy classification;
- compatibility constraints;
- Device Lab evidence policy where relevant.

---

# 5. Spatial Moment Schema Validation

A Storytide Spatial Moment or equivalent Chronicle attachment MUST validate at least:

- exact Parallax definition/version reference;
- activation condition;
- sharing scope;
- completion/evidence contract;
- required/preferred capability set;
- fallback chain;
- accessibility alternative;
- replay policy;
- Discovery Assistance policy when required;
- surface-role preference/fallback;
- privacy class;
- optional Watchglass/Landfall/Figurehead/Wakebook references.

A published Chronicle MUST NOT reference an unversioned mutable Spatial Library item.

---

# 6. Parallax Definition Validation

Drydock does not validate every internal Parallax renderer detail, but it MUST validate the authored spatial definition contract required for publication.

Representative checks:

- definition/version exists;
- item is publishable/compatible;
- required assets exist and pass ownership/security validation;
- coordinate space is declared;
- placement policy is explicit;
- anchor family is valid for the declared Worldspace/use;
- shared placement uses a shared-authority policy;
- personal placement is intentional;
- adaptive placement includes semantic constraints and safe fallback;
- deterministic variation has a seed/identity strategy where replay/debug requires it;
- interaction contract is valid;
- visibility/discovery semantics are coherent;
- required spatial entity does not depend on an inaccessible/unreachable placement rule.

---

# 7. Shared Spatial Reality Validation

For shared spatial content, Drydock MUST reject or warn on configurations that could create per-Player spatial truth.

A required shared entity must declare:

- sharing scope;
- authoritative scene/anchor identity model;
- late-join behavior;
- reconnect/relocalization behavior;
- re-anchor policy;
- discovery state scope;
- interaction state scope.

Invalid example:

```text
placement: ADAPTIVE_PER_PLAYER
discovery: CREW_SHARED
requiredForProgression: true
```

unless the effect is explicitly personal and the shared completion semantics remain coherent.

---

# 8. Adaptive Placement Validation

Drydock MUST understand the governed placement families:

- `FIXED`;
- `CALIBRATED`;
- `ADAPTIVE_STICKY`;
- `ADAPTIVE_PER_CREW`;
- `ADAPTIVE_PER_RUN`;
- `ADAPTIVE_VARIANT`;
- `PERSONAL`.

Static checks should catch:

- adaptive content with no eligible fallback surfaces;
- required content allowed outside its search region;
- required content with no maximum discovery/recovery path;
- shared content using personal placement unintentionally;
- fixed content lacking a recovery path when relocalization fails;
- placement rules that permit unsafe/blocked walk paths;
- adaptive variation that would break narrative ordering.

---

# 9. Discovery Assistance Validation

Every mandatory hidden spatial objective MUST have a valid Discovery Assistance contract.

Drydock MUST require:

- meaningful-search-time definition;
- at least one escalation path;
- final exact recovery (`Show Me` or governed equivalent);
- accessible cue form;
- behavior for low anchor/tracking confidence;
- fallback when Chronicle Lens capability is unavailable.

Optional secrets may omit strong hints only when no required progression depends on them.

---

# 10. Sextant Capability Validation

Spatial authoring must request semantic capabilities, not raw device APIs.

Drydock should validate requirement declarations such as:

```text
HEADING_ESTIMATE
DEVICE_ATTITUDE
MAGNETIC_ANOMALY
RELATIVE_ELEVATION
WORLD_TRACKED_AR
HAPTIC_OUTPUT
CAMERA_VIEW
```

For each mandatory capability:

- baseline compatibility tier is declared;
- unavailable/denied behavior exists;
- accessibility behavior exists;
- Chronicle audience declaration matches the requirement;
- no product claim depends on unsupported raw precision.

A Creator cannot publish a general-audience Chronicle whose only completion path assumes every phone contains a barometer because hardware designers remain annoyingly independent actors.

---

# 11. Landfall Validation

Drydock validates authored relationships to Landfall such as:

- Worldspace identity/version;
- physical vs virtual Worldspace compatibility;
- waypoint/region/route references;
- required place confidence class;
- place fallback;
- private-location projection rules;
- safe relationship between Landfall context and Parallax scene activation.

Drydock does not recompute route matching or geolocation confidence.

---

# 12. Watchglass Validation

A spatial definition that uses visual relocalization or scene semantics MUST define:

- exact immutable Vision Waypoint/model/reference version where applicable;
- accepted evidence classes;
- minimum confidence/certification policy;
- abstention path;
- expiry/freshness expectations;
- fallback when Watchglass is unavailable/not configured;
- privacy screening requirement for calibration evidence.

Drydock MUST NOT treat `recognition unavailable` as an impossible state.

---

# 13. Crossdeck Validation

Multi-surface Spatial Moments must declare:

- preferred surface role;
- minimum capabilities;
- whether same-surface fallback is allowed;
- whether the interaction remains completable with one device;
- privacy constraints for shared displays;
- disconnect behavior;
- handoff/reconnect semantics;
- stale/revoked surface handling.

A Chronicle MUST NOT strand a Player merely because the companion phone battery dies unless the Chronicle was explicitly published for a constrained hardware environment.

---

# 14. Figurehead Spatial Presence Validation

Where spatial scenes reference Figurehead:

- character/appearance version must be resolvable;
- fallback representation exists when full spatial rendering is unavailable;
- no biometric identification of real people is implied;
- pose/gaze requirements are compatible with Parallax scene constraints;
- historical capture semantics are version-pinned where necessary.

Until Figurehead implementation is accepted, Drydock should treat general Figurehead spatial presence as unavailable/not configured rather than simulated implementation truth.

---

# 15. Wakebook Spatial Memory Validation

Drydock validates Chronicle-authored Memory opportunities for:

- optional versus required capture;
- explicit Player capture semantics;
- owner-private default;
- Crossdeck surface fallback;
- exact Spatial Moment/version references;
- participant consent if later sharing is enabled;
- accessibility alternative;
- no calibration-evidence confusion;
- no progression mutation on replay/revisit.

Calibration evidence MUST NOT be accepted as a Wakebook Memory merely because both happen to contain an image.

---

# 16. Calibration Privacy Validation

For Parallax field calibration, Drydock MUST enforce the authored/privacy contract that:

- automatic calibration evidence is optional for the Player;
- a person/face-positive or uncertain candidate frame is rejected locally before upload;
- the evidence purpose is Creator placement refinement only;
- Sealed Hold is the protected-media authority;
- retention is bounded and declared;
- the Creator receives only the authorized minimized evidence projection;
- declining calibration does not block Chronicle completion.

A Chronicle cannot publish a calibration workflow that says “upload room image now, we promise to blur it later.”

---

# 17. Device Lab Evidence Requirements

Drydock may require a minimum device-evidence class for a provider/capability, but Device Lab execution remains Sounding Line-owned.

Representative policy:

```text
Spatial provider:
  static/schema validation      -> Drydock
  semantic provider simulation  -> Drydock Sea Trial + D0 receipt
  OS/native path                -> D2/D3 Device Lab receipt
  public compatibility claim    -> configured D4 evidence if governing project requires
  field-safety claim            -> D5 where required
```

A Chronicle's **publication** gate and a platform feature's **certification** gate are related but distinct.

Drydock may say:

> This Chronicle has a complete fallback and may publish even though the optional AR enhancement is only simulator-qualified.

while the platform UI truthfully labels the enhancement compatibility status.

---

# 18. Spatial Provider Simulation

Drydock Sea Trials should support deterministic simulated outcomes such as:

```text
SPATIAL_TRACKING_AVAILABLE
SPATIAL_TRACKING_DEGRADED
SPATIAL_TRACKING_LOST
ANCHOR_RESOLVED
ANCHOR_RELOCALIZATION_FAILED
ADAPTIVE_PLACEMENT_FOUND
ADAPTIVE_PLACEMENT_NONE
SHARED_SCENE_SYNCED
SHARED_SCENE_CONFLICT
DEVICE_CAPABILITY_UNAVAILABLE
WATCHGLASS_ABSTAINED
SURFACE_DISCONNECTED
CALIBRATION_CONSENT_DECLINED
```

The simulator models contract outcomes, not real AR physics.

---

# 19. Required Spatial Scenario Classes

Drydock's required scenario policy SHOULD gain spatial classes equivalent to:

- `SPATIAL_BASELINE_SUCCESS`;
- `SPATIAL_CAPABILITY_UNAVAILABLE`;
- `SPATIAL_TRACKING_LOSS_RECOVERY`;
- `SPATIAL_ADAPTIVE_NO_VALID_PLACEMENT`;
- `SPATIAL_SHARED_LATE_JOIN` when shared scenes are used;
- `SPATIAL_DISCOVERY_ASSISTANCE` for mandatory hidden objects;
- `SPATIAL_PRIVACY_CALIBRATION_DECLINE` when field calibration exists;
- `MULTI_SURFACE_DISCONNECT` when Crossdeck is required;
- `WATCHGLASS_ABSTENTION` when vision evidence is required;
- `SPATIAL_ACCESSIBILITY_FALLBACK`.

The exact machine-readable policy may be implemented later under normal Drydock maintenance; this amendment freezes the requirement semantics now.

---

# 20. Fault Injection

Spatial Sea Trials should be able to inject:

- permission denial/revocation;
- tracking quality loss;
- device capability loss;
- Watchglass abstention;
- surface disconnect;
- stale anchor evidence;
- duplicated interaction receipt;
- network loss during interaction;
- calibration consent refusal;
- Sealed Hold media unavailable;
- stale Spatial Library dependency;
- Landfall context unavailable;
- low-power quality reduction.

Fault injection MUST preserve One Voyage's no-mutation guarantees inside Drydock simulation.

---

# 21. Coverage Reporting

Spatial validation reports should include coverage for:

- every required Spatial Moment;
- every required capability family;
- placement policy variants that alter behavior;
- required fallback branches;
- Discovery Assistance final recovery;
- shared/personal state combinations;
- surface-role fallbacks;
- visual-evidence abstention;
- replay/non-mutation;
- accessibility alternatives.

Coverage does not imply real-device certification.

---

# 22. Harborlight Import, Install, and Remix Validation

When Harborlight distributes spatial content, Drydock MUST validate installed/remixed definitions against the receiving platform and Chronicle.

Checks include:

- immutable release/version identity;
- Parallax schema compatibility;
- required Sextant capability vocabulary;
- required Watchglass dependencies;
- required Landfall Worldspace semantics;
- Crossdeck surface requirements;
- Sealed Hold asset availability/scan state;
- licensing/attribution dependencies;
- fallbacks and accessibility;
- no private calibration evidence packaged as reusable content.

A Community spatial preset does not bypass Chronicle validation merely because somebody gave it five stars.

---

# 23. Publication Gate Semantics

A spatial Chronicle is publishable only when:

1. static spatial contracts parse;
2. references/version pins resolve;
3. required capabilities have allowed fallbacks or declared constrained-audience policy;
4. mandatory searches have Discovery Assistance;
5. privacy/calibration rules pass;
6. shared-scene semantics are coherent;
7. required Sea Trial scenarios pass;
8. required external/Device Lab evidence is present or truthfully declared pending according to policy;
9. assets/dependencies pass Harborlight/Sealed Hold rules where applicable;
10. no simulation mutates live business state.

---

# 24. Waivers

Drydock's existing waiver principles remain.

A waiver MUST NOT be used to:

- remove the final recovery path from required hidden spatial content;
- bypass automatic calibration person/face rejection;
- treat unavailable hardware as present;
- publish private room imagery publicly;
- allow per-Player divergent placement for one required shared object;
- permit replay to mutate progression.

Some capability-compatibility warnings MAY be waived for intentionally constrained experiences if distribution metadata and fallback policy remain truthful.

---

# 25. Creator Studio Diagnostics

Drydock should surface actionable spatial diagnostics, for example:

> **Spatial object can strand Players**  
> `Captain's Map` is required for Chapter 4 but has no final discovery recovery.

> **Shared scene uses personal placement**  
> `Ghost Chest` is Crew Shared but its placement policy is `PERSONAL`.

> **Vision fallback missing**  
> `Old Harbor Statue` requires Watchglass evidence but has no abstention path.

> **Calibration privacy incomplete**  
> Field calibration is enabled without a person-free screening receipt requirement.

Diagnostics should link the Creator to the relevant Parallax/Storytide editor rather than duplicating the full editor inside Drydock.

---

# 26. Historical Compatibility

Published Chronicle versions must retain their original spatial-definition identities and validation evidence.

If a future Parallax version changes schema:

- historical reader/upcast support follows existing Drydock compatibility architecture;
- a current Creator draft may migrate with explicit changes;
- old published versions do not silently receive new placement/fallback behavior;
- removed current Spatial Library items do not invalidate historical packages if their immutable versioned dependencies remain available.

---

# 27. Security and Abuse

Spatial authoring introduces abuse cases Drydock should validate where possible:

- unsafe magnet instructions;
- dangerous route/placement combination;
- trespass-prone placement;
- private-room imagery/public metadata leakage;
- arbitrary executable scripts inside spatial definitions;
- remote URL asset injection;
- spoofable completion paths;
- surface-role privacy mismatch;
- required physical spinning/motion without accessible alternative.

Static rules cannot replace runtime safety systems, but obvious unsafe authoring should fail before publication.

---

# 28. Performance and Compatibility Budgets

Drydock may validate authored spatial budgets such as:

- maximum scene entity count by profile;
- asset/texture/model budgets;
- required quality tiers;
- battery/thermal fallback declaration;
- device compatibility floor;
- network dependency;
- offline availability requirements.

It should not invent platform performance measurements. Device Lab/Sounding Line evidence supplies measured compatibility where required.

---

# 29. Implementation Model

This amendment does not authorize Project Drydock Phase 5.

Future work should arrive as:

- extension-registry additions;
- spatial rule-catalog additions;
- simulator adapters;
- Creator diagnostics;
- Harborlight import/remix validators;
- compatibility maintenance;
- Sounding Line-registered tests.

Each increment must remain mainline-safe and preserve existing Drydock behavior.

---

# 30. Acceptance Criteria

Drydock spatial integration is accepted when:

1. spatial authoring uses strict typed extensions rather than opaque blobs;
2. Parallax definitions are exact-version pinned;
3. shared/personal placement semantics are statically checkable;
4. adaptive required content has safe placement/fallback rules;
5. mandatory hidden objectives always include Discovery Assistance;
6. Sextant capability requirements have unavailability behavior;
7. Watchglass requirements include abstention;
8. Crossdeck requirements include disconnect/surface fallback;
9. calibration privacy rules fail closed;
10. Wakebook Memory opportunities remain distinct from calibration evidence;
11. deterministic Sea Trials cover spatial success/failure/fallback outcomes;
12. Device Lab evidence can be referenced without Drydock becoming its scheduler;
13. Harborlight spatial installs/remixes revalidate before publication;
14. simulation never mutates live Voyage state;
15. Drydock's completed Phase 1-4 status remains truthful and no Phase 5 is implied.

---

# Appendix A. Representative Spatial Rule Codes

Suggested stable rule families:

```text
DD-SPATIAL-001  missing immutable Parallax version
DD-SPATIAL-002  shared entity uses incompatible personal placement
DD-SPATIAL-003  mandatory hidden entity lacks Discovery Assistance
DD-SPATIAL-004  required capability lacks fallback
DD-SPATIAL-005  Watchglass dependency lacks abstention path
DD-SPATIAL-006  calibration lacks person-free screening requirement
DD-SPATIAL-007  adaptive placement has no eligible safe surface fallback
DD-SPATIAL-008  replay may mutate canonical progression
DD-SPATIAL-009  surface role has no disconnect fallback
DD-SPATIAL-010  private calibration evidence referenced by public package
```

Exact identifiers may be revised when implemented, but the governed defect classes remain.

---

# Appendix B. Canonical Validation Example

A Creator attaches `Captain's Lost Map v2.1` to Chapter 4.

Drydock validates:

1. exact Parallax version exists;
2. placement is `ADAPTIVE_PER_RUN`, sharing scope `CREW_SHARED`;
3. one run seed is generated and shared;
4. preferred floor/desk surfaces plus safe fallback are defined;
5. map may be picked up/placed;
6. mandatory discovery has progressive hints and exact recovery;
7. Chronicle Lens unavailable -> Guided Chart fallback;
8. shared late-join scenario exists;
9. capture prompt is optional/private;
10. calibration evidence, if enabled, is person-free and optional;
11. Sea Trials cover placement success/no-placement/tracking loss/disconnect;
12. required Device Lab qualification state is truthfully declared;
13. One Voyage remains the only progression writer.

Only then can the Chronicle receive a complete spatial readiness decision.

---

# Final Governing Rule

> **Drydock verifies the authored promise; it does not impersonate the world.**  
> Spatial systems may be complex, probabilistic, device-dependent, and beautiful, but the Chronicle contract around them must still be typed, simulatable, fallible, accessible, privacy-safe, and recoverable before publication.

**End of Project Drydock Governing Amendment v1.1**
