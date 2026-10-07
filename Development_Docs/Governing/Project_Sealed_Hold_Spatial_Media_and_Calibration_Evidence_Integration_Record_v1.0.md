---
title: "Project Sealed Hold Spatial Media and Calibration Evidence Integration Record"
subtitle: "Protected AR Calibration Evidence, Spatial Media, Consent, Retention, Derivatives, and Cross-Project Privacy Boundaries"
author: "Voyagewright Engineering"
date: "October 7, 2026"
version: "1.0"
status: "Post-Closeout Governing Integration Record"
document_id: "VW-SEALED-HOLD-SPATIAL-INT-1.0"
repository: "Kgray44/treasurehuntSoT"
repository_baseline: "2cdb32ec504a4396092e9a0237661ee365ce9caf"
---

# PROJECT SEALED HOLD

## Spatial Media and Calibration Evidence Integration Record v1.0

### Protected AR Calibration Evidence, Spatial Media, Consent, Retention, Derivatives, and Cross-Project Privacy Boundaries

> **Governing Principle**  
> Spatial technology may need private imagery and bounded environmental evidence to make a Chronicle work, but the room is never the product. Sealed Hold protects only the minimum bytes and metadata required for an authorized purpose, keeps calibration evidence separate from personal Memories and public content, and never lets an AR feature create a second private-media system because the camera happened to be open.

This is a **post-closeout governing integration record** for Project Sealed Hold. It does not create Sealed Hold Phase 5, reopen accepted Phases 1 through 4, or replace the existing protected-media architecture. It freezes how future Project Parallax, Watchglass, Crossdeck, Wakebook, Harborlight, Storytide, Landfall, Sextant, and Drydock spatial features MUST use the accepted Sealed Hold protected-media boundary.

Current accepted Sealed Hold behavior already provides the core primitives this integration requires:

- protected originals remain private `PrivateAssetObject` records;
- `ProtectedMedia` references those private objects rather than copying source bytes;
- typed opaque associations bind media to allowlisted subjects and explicit purposes;
- public/shareable derivatives are separate protected objects;
- scanner state, exact consent, grants, withdrawals, receipts, and reauthorization are first-class;
- source filenames, raw provider keys, storage credentials, EXIF/GPS/device metadata, and original bytes are not exposed to consumer projects;
- unknown purpose, audience, subject kind, authority, scanner state, consent state, or transform policy fails closed;
- consumers receive opaque identities and governed delivery, not object-store paths.

Wave 3 therefore extends **purpose and integration policy**, not storage architecture.

---

# 1. Authority and Precedence

This record is subordinate to and must remain compatible with:

1. **Voyagewright Global Product Governance Standard** for coherent product behavior, human completion, accessibility, discoverability, and owner acceptance.
2. **Voyagewright Spatial Experience Architecture v1.0** for cross-project spatial ownership, calibration privacy, Chronicle Lens behavior, shared spatial reality, and Device Lab boundaries.
3. **Existing Project Sealed Hold governing and accepted Phase 1–4 records** for private-content packages, storage, scanning, key management, operations, protected media, grants, consent, derivatives, withdrawal, backup, and recovery.
4. **Protected Personal Media Architecture** for `ProtectedMedia`, associations, derivatives, grants, consent assertions, receipts, and withdrawals.
5. **Project Parallax v1.0** for spatial entities, calibration workflows, AR composition, scene understanding, and Chronicle Lens runtime behavior.
6. **Project Watchglass Spatial Perception Integration Amendment** for privacy-screening evidence and visual relocalization semantics.
7. **Project Wakebook v1.1 Spatial Memories and AR Capture Amendment** for private Memory/archive semantics.
8. **Project Harborlight spatial-content/public-projection authority** for any future public spatial media or reusable community package.
9. **Project Crossdeck v1.0** for paired-surface authorization and transport semantics.
10. **Project One Voyage** for authoritative Chronicle progression.
11. **Project Drydock** for authored-content validation.
12. **Project Sounding Line and Voyagewright Device Lab** for software/device verification and evidence fidelity.

Where this record conflicts with a historical assumption that “camera data is just another upload,” this record supersedes that assumption for spatial workflows.

---

# 2. Sealed Hold's Fundamental Question

Sealed Hold answers:

> **What protected bytes and private metadata may exist, for what exact purpose, under whose authority, for how long, and through which safe delivery path?**

It does not answer:

- where an AR object belongs — Parallax;
- whether a visual landmark matches — Watchglass;
- what place means — Landfall;
- what device/sensor capability exists — Sextant;
- which paired surface is active — Crossdeck;
- what a Memory means to the Player — Wakebook;
- whether content may be publicly distributed — Harborlight;
- whether finding an object advances the Chronicle — One Voyage through the owning completion logic.

The existence of a camera or spatial session never grants storage authority by itself.

---

# 3. Spatial Media Classes

Sealed Hold MUST distinguish purpose-specific spatial media rather than treating all AR imagery as one generic upload class.

At minimum:

```text
PARALLAX_CALIBRATION_REFERENCE
PARALLAX_CREATOR_REVIEW_DERIVATIVE
WAKEBOOK_SPATIAL_MEMORY
WAKEBOOK_SPATIAL_MEMORY_DERIVATIVE
HARBORLIGHT_PUBLIC_SPATIAL_DERIVATIVE
WATCHGLASS_LOCKED_REFERENCE_MEDIA
PARALLAX_PRIVATE_SPATIAL_ASSET
PARALLAX_SPATIAL_ASSET_DERIVATIVE
DEVICE_LAB_SPATIAL_TEST_ARTIFACT
```

These classes may share physical storage infrastructure but MUST NOT share authorization, retention, audience, or projection rules merely because their bytes are JPEG/WebP/PNG.

## 3.1 Purpose binding

Every protected spatial-media association MUST declare an allowlisted purpose.

Representative purpose values:

```text
CALIBRATION_CREATOR_REVIEW
SPATIAL_MEMORY_OWNER_ARCHIVE
SPATIAL_MEMORY_CREW_SHARE
HARBORLIGHT_PUBLIC_DERIVATIVE
VISION_REFERENCE_BUILD
SPATIAL_ASSET_AUTHORING
DEVICE_LAB_TEST_EVIDENCE
```

Unknown purpose fails closed.

---

# 4. Hard Boundary: Calibration Evidence Is Not a Memory

Parallax field-calibration evidence exists to improve or verify Creator placement.

Wakebook Spatial Memories exist because a Player deliberately chooses to preserve a moment.

These two classes MUST remain separate even when they originate from the same camera view.

**Calibration evidence**

- **Primary purpose:** improve spatial placement.
- **Trigger:** optional calibration workflow.
- **People allowed:** automatic upload **never** permits detected/suspected people or faces.
- **Default audience:** authorized Creator/calibration service only.
- **Default retention:** bounded/minimized.
- **Archive owner:** Parallax + Sealed Hold evidence boundary.
- **Public projection:** forbidden.
- **Full room mesh:** forbidden by default.
- **Raw sensor stream:** forbidden by default.

**Spatial Memory**

- **Primary purpose:** personal remembrance.
- **Trigger:** explicit Player capture.
- **People allowed:** yes in private capture, subject to later sharing consent.
- **Default audience:** owner-private.
- **Default retention:** durable owner archive policy.
- **Archive owner:** Wakebook.
- **Public projection:** separate Harborlight flow only.
- **Full room mesh:** forbidden by default.
- **Raw sensor stream:** forbidden by default.

Calibration evidence MUST NOT silently appear in Chronicle Passport.

A Player MAY separately press **Remember this** in the same scene to create a Wakebook Memory under a different purpose and consent path.

---

# 5. Person-Free Automatic Calibration Invariant

Automatic calibration evidence has a hard privacy invariant:

> **A frame containing a detected or reasonably suspected person or face MUST NOT leave the device as calibration evidence.**

The required pipeline is:

```text
candidate camera frame
        ↓
on-device privacy screening
        ↓
person or face suspected?
   YES → discard locally
   NO  → continue
        ↓
Parallax minimization / contextual crop
        ↓
explicit Player calibration consent
        ↓
Sealed Hold protected upload
        ↓
Creator-review derivative
```

## 5.1 Fail closed on uncertainty

If Watchglass/privacy screening returns:

- `PERSON_PRESENT`;
- `FACE_PRESENT`;
- `MIRROR_OR_REFLECTION_RISK` with unresolved human-presence uncertainty;
- low-confidence privacy classification;
- detector unavailable when person-free screening is required;

then automatic upload is not authorized.

The device may wait for another frame, ask the Player to reposition, or proceed without contributing calibration evidence.

The Chronicle MUST remain playable if calibration contribution is declined or unavailable.

## 5.2 No identity recognition requirement

The screening question is:

> Is a person or face potentially present?

It is not:

> Who is this person?

No biometric identity system is authorized by this record.

---

# 6. Explicit Player Consent for Calibration

Passing privacy screening is necessary but not sufficient.

Before uploading calibration evidence, the Player MUST receive a bounded explanation covering:

- what will be saved;
- why the Creator may need it;
- who may view it;
- that it is optional;
- that person-positive frames are discarded locally;
- that it is not a personal Chronicle Memory;
- retention or expiry policy;
- how revocation/removal works where supported.

A calibration-consent assertion MUST be bound to:

- Player/person identity or appropriately scoped guest authority;
- Voyage/session or Chronicle calibration context;
- exact purpose;
- exact media/object checksum when known;
- allowed Creator/reviewer audience;
- retention policy/version;
- timestamp and validity/revocation state.

A generic “camera permission accepted” is not calibration-media consent.

---

# 7. Data Minimization Before Storage

The preferred order is:

```text
raw camera input
   ↓
on-device person/privacy screening
   ↓
select smallest useful frame
   ↓
crop to local anchor context
   ↓
remove unnecessary metadata
   ↓
normalize image
   ↓
protected upload
```

The system SHOULD avoid storing an entire bedroom panorama when a cropped wall/desk region is sufficient.

## 7.1 Forbidden default attachments

Calibration evidence MUST NOT automatically include:

- full room mesh;
- raw point cloud;
- continuous camera video;
- microphone audio;
- continuous device pose history;
- raw accelerometer/gyroscope/magnetometer streams;
- Bluetooth scan history;
- UWB peer identifiers;
- exact private-home coordinate history;
- unrelated device identifiers;
- source EXIF/GPS metadata;
- nearby Wi-Fi network identifiers.

If a future feature genuinely requires one of these, it needs a separate explicit governing amendment and threat review.

---

# 8. Calibration Evidence Package

A protected calibration package may contain only the minimum required evidence.

Representative contract:

```text
CalibrationEvidencePackage
  evidenceId
  purpose: CALIBRATION_CREATOR_REVIEW
  spatialDefinitionVersion
  spatialMomentId?
  anchorResolutionId?
  voyageContextClass?
  sanitizedImageObjectId
  sanitizedImageChecksum
  cropDescriptor
  surfaceClass?
  surfaceNormalSummary?
  boundedPoseSummary?
  visualLandmarkReference?
  privacyScreeningReceiptId
  personFreeScreeningPolicyVersion
  playerConsentAssertionId
  createdAt
  expiresAt?
  creatorReviewState
```

The package MUST NOT expose private storage keys or original camera-file metadata.

## 8.1 Geometry summaries

Where Parallax needs geometry context, prefer bounded semantic summaries such as:

- horizontal/vertical surface class;
- relative anchor point;
- surface normal;
- approximate local scale;
- confidence;
- opaque environment signature.

Do not store a full reconstructable room model merely to let the Creator move a note 30 cm left.

---

# 9. Creator Review Derivatives

The Creator should normally view a **sanitized review derivative**, not the raw upload object.

Creator-review derivatives SHOULD:

- be bounded in resolution;
- strip metadata;
- preserve only the spatial context necessary for placement review;
- overlay or separately describe the current Parallax target location;
- never expose provider/storage identity;
- have purpose-bound access;
- expire or become unavailable according to calibration retention policy.

A Creator cannot download private originals through a debugging route simply because they own the Chronicle.

---

# 10. Creator Access and Authorization

Creator access to calibration evidence MUST be scoped to:

- the Chronicle/project they are authorized to edit;
- the exact spatial definition/moment the evidence supports;
- the permitted calibration purpose;
- a valid evidence retention window;
- non-revoked Player consent.

Creator authorization does not imply access to:

- the Player's Wakebook Memories;
- unrelated room imagery;
- other Creators' calibration evidence;
- raw location history;
- raw sensor streams;
- other Voyage private content;
- private Sealed Hold objects outside the calibration association.

---

# 11. Field Calibration Lifecycle

A protected calibration evidence record may move through a lifecycle such as:

```text
CAPTURE_PENDING
PRIVACY_SCREENED
CONSENTED
STORED_PRIVATE
CREATOR_REVIEW_AVAILABLE
CREATOR_REVIEWED
APPLIED_TO_CALIBRATION
SUPERSEDED
EXPIRED
REVOKED
RETAINED_AUDIT_ONLY
```

The exact implementation may use different names, but storage availability, Creator visibility, and durable audit state MUST remain distinct.

## 11.1 Applying a calibration does not require retaining the image forever

Once the Creator approves a placement, Parallax may persist the resulting bounded calibration recipe while the supporting image follows its own retention schedule.

The implementation SHOULD prefer retaining:

- resulting anchor recipe/version;
- safe evidence checksum/reference;
- calibration approval receipt;
- policy version;

rather than indefinite private-room imagery.

---

# 12. Retention and Expiry

Calibration evidence requires a **bounded retention policy**.

The policy should account for:

- whether the placement has been reviewed;
- whether the calibration has been superseded;
- whether later Players successfully resolve the anchor;
- Creator troubleshooting needs;
- Player revocation;
- incident/audit requirements.

The default SHOULD minimize retention after the calibration is accepted and independently verified.

Long-lived retention of room imagery requires a clear product purpose, not “storage is cheap.”

## 12.1 Audit versus media retention

It may be appropriate to retain a small immutable receipt after the media itself is deleted or expired:

```text
calibration evidence existed
checksum X
policy Y
consent assertion Z
reviewed at T
media expired/deleted at U
```

That receipt must not contain the room image.

---

# 13. Withdrawal and Revocation

Where policy permits Player withdrawal of calibration evidence:

1. future Creator delivery must cease;
2. active grants are revoked;
3. queued derivative work must stop or fail closed;
4. derived temporary Creator-review media becomes unavailable;
5. durable audit receipts remain as required;
6. already-materialized Parallax calibration recipes are handled according to the disclosed policy.

The system MUST be clear about whether withdrawing the evidence also removes a Creator-approved anchor recipe. Those are not necessarily the same object or purpose.

---

# 14. Offline and Deferred Upload

A Player may capture calibration evidence while offline.

If deferred upload is supported:

- raw pending media remains encrypted/protected locally;
- pending state is visible and cancellable;
- upload does not occur after consent expiry/revocation;
- privacy-screening evidence remains bound to the exact media checksum;
- retries are idempotent;
- completion of the Chronicle does not require upload;
- stale Crossdeck pairing does not inherit the pending object.

If local protected persistence cannot be guaranteed, the calibration contribution should simply be unavailable offline.

---

# 15. Crossdeck Does Not Expand Media Authority

Pairing a phone to a desktop through Crossdeck does not grant the desktop unrestricted camera or calibration access.

Crossdeck may transport a scoped capture intent or result reference.

The receiving surface must still satisfy:

- same canonical person/Voyage context;
- exact purpose;
- valid grant;
- privacy policy;
- Sealed Hold delivery authorization.

A previously paired surface that is no longer authorized MUST NOT receive private spatial media after reconnect.

---

# 16. Spatial Memories and Wakebook

Private Spatial Memories use the existing protected-media architecture but a distinct Wakebook-owned purpose.

Sealed Hold governs:

- protected object storage;
- media integrity/scanning;
- derivatives;
- consent/grants where required;
- delivery authorization;
- withdrawal/revocation.

Wakebook governs:

- Memory identity;
- archive organization;
- captions/annotations;
- private retention semantics;
- Voyage association;
- personal history presentation.

Parallax may provide the clean composited image but does not own the archive.

## 16.1 People may appear in explicit Memories

The person-free rule applies to **automatic calibration evidence**, not intentional private Player photography.

If a private Spatial Memory is later shared publicly or with crew, the applicable Wakebook/Harborlight participant/media consent rules apply.

---

# 17. Clean AR Capture

For Player-authored Spatial Memories, Parallax may provide:

```text
camera frame
+ authored AR entities/effects
+ approved presentation composition
- debug UI
- crosshairs
- tracking diagnostics
- permission prompts
= clean Memory image
```

Sealed Hold stores the resulting protected media according to the Wakebook purpose.

The capture process SHOULD strip EXIF/GPS/device metadata unless a separately governed owner-private feature explicitly requires it.

---

# 18. Harborlight Public Spatial Media

Harborlight MUST NOT receive or publish calibration evidence.

No calibration-media object, Creator-review derivative, room signature, or calibration package may become a Community Harbor listing asset by changing a visibility field.

If a Player/Creator later chooses to publish a Spatial Memory or spatial-content preview, Harborlight requires a **separate public derivative path** with:

- explicit public/share consent;
- participant consent where applicable;
- safe spoiler projection;
- location generalization;
- metadata stripping;
- current clean scan state;
- public-purpose derivative;
- Harborlight release/version binding;
- moderation/public-safety policy.

Private evidence is never “promoted” directly to public content.

---

# 19. Spatial Library Assets

Parallax Spatial Library packages may include:

- 2D textures;
- 3D models;
- materials;
- audio;
- effect assets;
- thumbnails/previews;
- optional authoring reference media.

Sealed Hold protects private/unpublished source assets where required.

Harborlight governs any public immutable distribution package.

## 19.1 Source versus derivative

A Creator's private high-resolution/source spatial asset may remain protected while a sanitized/optimized distribution derivative enters Harborlight.

Consumer devices should receive only the release-authorized asset form required by Parallax runtime.

---

# 20. Watchglass Reference Media

Watchglass may require protected locked reference media for visual recognition or relocalization.

Those references may be stored through Sealed Hold with a dedicated Watchglass purpose.

They MUST remain separate from:

- calibration evidence;
- Player Memories;
- Harborlight public preview media;
- ordinary Parallax render assets.

A Watchglass reference may contain sensitive physical context and should use purpose-bound delivery rather than a generic asset URL.

---

# 21. Location Metadata

Spatial media can accidentally reveal precise location even when the image itself seems harmless.

Controls MUST consider:

- EXIF GPS;
- filename/device metadata;
- Landfall exact place identifiers;
- Creator annotations;
- environment signatures;
- background signs/addresses;
- public captions;
- route IDs that resolve to private homes.

Sealed Hold strips machine metadata where governed; Harborlight/Creator review must still consider visible-image disclosure and semantic metadata.

## 21.1 Private-home calibration

Private-home calibration evidence should not durably store exact street coordinates unless there is a specific required reason and the Player has been told.

An opaque Voyage/site context and local spatial recipe are usually sufficient.

---

# 22. Environment Signatures

Parallax may need an opaque environment signature to help identify whether a later session is plausibly the same scene.

Any such signature MUST be:

- purpose-limited;
- non-public;
- minimally identifying;
- versioned;
- bounded in retention;
- unusable as a general person/home fingerprint outside the spatial feature.

The platform MUST NOT quietly create a cross-Chronicle private-home fingerprinting system.

If safe unlinkability cannot be maintained, the feature must use a less persistent relocalization strategy.

---

# 23. Logs and Diagnostics

Operational logs MUST NOT contain:

- image bytes;
- raw thumbnails;
- full room geometry;
- provider storage paths;
- access tokens;
- raw consent prose;
- exact private coordinates;
- raw environment signatures;
- private Memory URLs.

Diagnostics SHOULD record opaque IDs, reason codes, policy versions, checksums, and correlation IDs.

Example:

```text
CALIBRATION_UPLOAD_REJECTED
reason: PERSON_POSSIBLE
policy: parallax-person-free-v1
framePersisted: false
```

not the rejected frame itself.

---

# 24. Backup, Restore, and Disaster Recovery

Spatial protected media inherits accepted Sealed Hold backup/recovery architecture.

Backup sets must preserve:

- protected object identity;
- metadata/association records;
- consent/grant state;
- withdrawal state;
- calibration-review receipts;
- encryption/key references;
- integrity checks.

Restore must not resurrect revoked public grants or expired calibration visibility merely because historical bytes were restored.

The current state machine remains authoritative after recovery reconciliation.

---

# 25. Scanner and Provider Requirements

Spatial image/model assets use the existing scanner/provider policy.

A media item is not safe merely because Parallax generated it.

For public/shareable derivatives:

- scanner state must be current and clean;
- digest/length/media type must match;
- transform policy must be accepted;
- unavailable scanner/provider remains not configured/fail closed according to the consuming flow.

Wave 3 governance does not convert current external ClamAV/S3/KMS/MySQL/Linux evidence gaps into passes.

---

# 26. Device Lab Test Artifacts

Voyagewright Device Lab may produce screenshots/video/logs while testing spatial behavior.

Test artifacts MUST use synthetic or explicitly authorized environments whenever possible.

Real-device field evidence involving private locations must declare:

- evidence tier;
- privacy classification;
- retention;
- redaction requirements;
- operator consent;
- whether the artifact is acceptable for durable CI storage.

Device Lab evidence is verification material, not a Player Memory or Creator calibration asset unless separately captured under those purposes.

---

# 27. Drydock Validation Rules

Drydock should eventually validate spatial-media authoring for:

- calibration enabled only with privacy-screening and consent contracts;
- required calibration not used as mandatory progression;
- Memory opportunity uses Wakebook purpose;
- public sharing uses Harborlight/public derivative path;
- protected asset references use accepted Sealed Hold types;
- private originals are never referenced by public Story Block output;
- retention class is known;
- fallback exists when protected-media provider is unavailable;
- exact consent requirements are declared when people/media may be shared.

Drydock validates the authored contract. It does not inspect private media bytes unnecessarily.

---

# 28. Security Threats

Wave 3 spatial integration must explicitly defend against:

- calibration frame containing a person uploaded despite policy;
- Creator accessing another Chronicle's calibration evidence;
- secondary Crossdeck surface reusing stale media grant;
- public Harborlight route resolving a calibration object;
- EXIF/GPS leak in a public derivative;
- forged privacy-screening receipt;
- mismatched screening receipt/media checksum;
- consent assertion replayed for a different image;
- expired/revoked evidence still visible to Creator;
- malicious image/model payload;
- private storage key exposed in a Parallax client response;
- environment signature reused for unrelated tracking;
- backup restore resurrecting revoked grants;
- debug endpoint returning raw room imagery;
- telemetry containing exact coordinates or thumbnails.

## 28.1 Receipt binding

Privacy-screening and consent receipts MUST bind to the exact media identity/checksum they authorize.

A “person-free” receipt for image A cannot authorize image B.

---

# 29. Accessibility and Player Clarity

Privacy/consent UI must be understandable with:

- screen readers;
- keyboard/touch navigation;
- zoom/reflow;
- reduced motion;
- non-color-only status;
- plain-language explanation.

Players should not need to understand storage providers, derivatives, or EXIF.

A useful message is:

> Voyagewright can save one person-free image of the clue's surroundings so the Creator can improve its position for future Players. This is optional.

Not:

> Grant `CALIBRATION_CREATOR_REVIEW` scope to ProtectedMedia derivative v4.

The software can keep its nouns to itself for five minutes.

---

# 30. Data Subject and Account Lifecycle

If a Player account is deleted or personal data is exported, spatial media follows the applicable Wayfarer/Sealed Hold data-lifecycle policy.

The system must distinguish:

- private Memory owned by the person;
- calibration evidence contributed under a bounded product purpose;
- Creator-owned source spatial assets;
- immutable public Harborlight releases;
- retained security/audit receipts.

No blanket delete/export assumption may silently break immutable public releases or security evidence; no immutable release rule may justify retaining unnecessary private room imagery forever.

---

# 31. Migration from Existing Sealed Hold Media

No bulk migration is required merely because this integration record exists.

Existing `PrivateAssetObject`, `ProtectedMedia`, association, derivative, grant, consent, receipt, and withdrawal systems remain canonical.

Future spatial implementation should add:

- new allowlisted purpose classes;
- new allowlisted opaque subject adapters where needed;
- policy rows for calibration/Memory/spatial-asset derivatives;
- retention/reconciliation rules;
- tests.

It SHOULD NOT create parallel tables or buckets named things like:

```text
ar_uploads
spatial_media_public
calibration_images_final_final
```

Humanity can survive without a fourth asset store.

---

# 32. Compatibility and Historical Stability

Historical Memories and spatial references must remain understandable if:

- Parallax runtime changes;
- Spatial Library items are updated;
- Watchglass build changes;
- a Creator removes an item from their current library;
- a Crossdeck surface is no longer paired;
- a calibration image expires.

The durable record should retain safe version identity and human-meaningful state without requiring the original private room evidence to remain forever.

---

# 33. Operational Monitoring

Operational monitoring should expose bounded metrics such as:

- calibration uploads accepted/rejected by reason;
- privacy-screening failures;
- consent declines;
- derivative failures;
- scanner/provider unavailable counts;
- grant authorization failures;
- evidence expirations;
- orphan reconciliation counts.

Monitoring MUST NOT expose the private media itself.

Bridgewatch/Admiralty may receive aggregate health, not room photographs.

---

# 34. Incident Response

A suspected spatial-media privacy incident must support:

1. identifying affected opaque media/evidence IDs;
2. suspending grants immediately;
3. blocking Creator/public delivery;
4. preserving necessary forensic receipts without broadening access;
5. determining whether public derivative or external download occurred;
6. notifying appropriate operators/users under applicable policy;
7. correcting the systemic defect;
8. revalidating with focused Sounding Line and, where applicable, Device Lab proof.

Do not solve a privacy incident by deleting every audit record and announcing victory.

---

# 35. Cross-Project Ownership Summary

**Cross-project owner summary**

- **Sealed Hold:** protected bytes, grants, consent, and derivatives.
- **Parallax:** spatial placement and calibration semantics.
- **Watchglass:** person/face/privacy visual-screening evidence.
- **Sextant:** device and camera lifecycle capability.
- **Crossdeck:** paired-surface session and transport.
- **Wakebook:** private personal Memory/archive.
- **Harborlight:** public spatial content and public Memory derivatives.
- **Landfall:** place/navigation context.
- **Storytide:** narrative meaning.
- **One Voyage:** progression authority.
- **Drydock:** authored validation.
- **Sounding Line / Device Lab:** software/device verification.


No subsystem may use this integration to steal the adjacent owner domain.

---

# 36. Required Verification Scenarios

At minimum, future implementation should cover:

1. person-free calibration frame accepted after explicit consent;
2. person detected -> frame discarded locally, no protected object created;
3. privacy detector uncertain -> no upload;
4. consent declined -> Chronicle continues;
5. consent revoked before queued upload -> upload does not occur;
6. screening receipt checksum mismatch -> fail closed;
7. Creator can access only authorized calibration derivative;
8. unrelated Creator denied;
9. expired evidence unavailable to Creator;
10. clean Spatial Memory with people remains private and valid;
11. Memory public-share request creates separate public derivative/consent flow;
12. Harborlight cannot resolve calibration object;
13. EXIF/GPS absent from public derivative;
14. Crossdeck stale surface denied private media;
15. Sealed Hold provider unavailable -> safe fallback/no progression dead end;
16. duplicate upload retry idempotent;
17. backup/restore does not reactivate revoked grants;
18. calibration media expires while safe anchor recipe remains where policy allows;
19. Device Lab real-device evidence carries explicit privacy class;
20. diagnostics contain no private image bytes/paths.

---

# 37. Acceptance Criteria

This integration record is satisfied when future spatial implementation can prove all applicable requirements below:

1. Existing Sealed Hold storage/grant/consent/derivative primitives remain canonical.
2. Calibration evidence and Wakebook Memories are distinct purpose classes.
3. Automatic calibration frames containing or possibly containing a person/face never upload.
4. Privacy screening happens before network transfer for automatic calibration.
5. Explicit Player consent is required for calibration upload.
6. Calibration contribution is never required for Chronicle completion.
7. Stored evidence is minimized and does not include raw room mesh/sensor history by default.
8. Creator receives only purpose-bound sanitized review derivatives.
9. Creator access is Chronicle/spatial-definition scoped.
10. Calibration imagery has bounded retention and revocation semantics.
11. Crossdeck pairing does not grant additional media authority.
12. Wakebook private Spatial Memories may intentionally contain people.
13. Harborlight cannot publish calibration evidence directly.
14. Public spatial media uses a separate safe derivative, consent, location, spoiler, and moderation path.
15. Watchglass references, Parallax assets, Memories, calibration evidence, and Device Lab artifacts remain separate classes.
16. EXIF/GPS/device metadata is stripped where public/share policy requires it.
17. environment signatures are purpose-limited and do not become general private-home fingerprints.
18. backup/restore preserves revocation and current authorization truth.
19. logs/telemetry never contain private media bytes, paths, or exact private context.
20. no new private-media store is created.
21. current external provider gaps remain explicitly external and are not reclassified as passing.
22. Drydock and Sounding Line can validate the integration without consuming private content beyond necessity.
23. accepted Sealed Hold Phase 1–4 history remains closed and truthful.

---

# Appendix A. Calibration vs Memory vs Public Derivative

```text
PARALLAX CALIBRATION
  person-free local screening
  + explicit calibration consent
  → Sealed Hold private calibration evidence
  → Creator review derivative
  → bounded calibration recipe

WAKEBOOK MEMORY
  Player explicitly captures
  → Sealed Hold private Memory media
  → Wakebook archive

OPTIONAL PUBLIC SHARE
  private Memory / Creator spatial asset
  + public/share consent
  + participant consent if needed
  + metadata/location minimization
  + scan + public derivative
  → Harborlight immutable/public projection
```

No arrow exists from calibration evidence directly to Harborlight.

---

# Appendix B. Recommended Purpose Registry Additions

Representative names only; final implementation follows current Sealed Hold registry conventions.

```text
CALIBRATION_CREATOR_REVIEW
SPATIAL_MEMORY_OWNER_ARCHIVE
SPATIAL_MEMORY_CREW_SHARE
WATCHGLASS_SPATIAL_REFERENCE
PARALLAX_PRIVATE_SOURCE_ASSET
PARALLAX_RUNTIME_DERIVATIVE
HARBORLIGHT_SPATIAL_PUBLIC_DERIVATIVE
DEVICE_LAB_SPATIAL_EVIDENCE
```

Each must define:

- allowed subject class;
- allowed requester/audience;
- consent requirement;
- scanner requirement;
- derivative requirement;
- retention class;
- public projection eligibility;
- revocation behavior;
- backup class;
- logging/redaction policy.

---

# Final Governing Rule

> **Protect the moment without preserving the room.**  
> Sealed Hold may retain the minimum private evidence required to make spatial experiences reliable and memorable, but purpose, consent, minimization, retention, and access remain explicit at every boundary. Calibration is not a Memory. A Memory is not a public release. A paired device is not an authorization grant. And no AR feature gets to invent a shadow media platform merely because cameras are exciting.

**End of Project Sealed Hold Spatial Media and Calibration Evidence Integration Record v1.0**
