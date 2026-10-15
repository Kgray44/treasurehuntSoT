---
title: SC-01 lossless Studio compatibility review and comparison handoff
audience: product-engineering
status: implementation-in-validation
canonical_for: parallax-sc01-compatibility-review-20261015
last_reviewed: 2026-10-15
---

# Lossless Environment and Scene compatibility

This source-contract review verifies the bridge at 8e612f7a. The isolated D: review tree a4aa1c25 adds the separately owned SC-01 comparison projection. It incorporates accepted diagnostic main 99a2baba. The [source-bound report](evidence/sc-01/20261015-compatibility/review.json) distinguishes independent bridge review from the SC-01-authored patch, which still needs separate owner review and combined experience proof.

The main-based [SC-01 candidate](https://github.com/Kgray44/treasurehuntSoT/pull/727) retains its own Scene Manager and browser evidence. This review introduces no Scene Manager callback change. It does not establish combined UI, protected, physical or owner acceptance.

## Verified interfaces

The existing authenticated POST action ENVIRONMENT_CATALOG returns catalog through the Creator, CSRF, rate and private-no-store boundary. LIFECYCLE_V1 records preserve the complete lifecycle record, working Environment document, CAS revision, WORKING/SAVED/LEGACY_REVIEW membership, archive state and explicit immutable versions. SC01_SCHEMA1 records preserve legacy/built-in envelopes and conservative membership. No moving current pin is supplied.

resolvePinnedEnvironment resolves an exact owner-authorized positive release across both formats. Environment reference revision is the release ordinal; the working/source binding revision remains CAS. Version IDs are opaque and may contain 160 characters. Rich room yaw, parts, supports, exclusions, construction and provenance remain lossless. Legacy fixture data remains its own representation. Neither format is reconstructed through the other.

Scene saves and releases reject a pin with mismatched room or source identity. Existing published envelopes remain unchanged. Future SceneReference retains the immutable Scene definition/version/checksum, exact Environment pin, behavior IDs and CUT/PRESERVE_ENVIRONMENT intent. The added rich-room contract case verifies a complete 150-character Environment version ID, immutable Scene stability and rejection of a changed pin. This does not implement SC-03 or a transition runtime.

## Confirmed repair

The first independent audit of 03fd8a31 found that a valid schema-one pin could admit an object at x=99 metres. The failed probe and all 17 passing baseline checks remain in the evidence folder. At 8e612f7a the bridge invokes the retained legacy reviewEnvironmentImpact validator after exact resolution. Its type and function body match SC-01 source a33780ae after line-ending normalization; qualified imports preserve the distinct representation. Existing bounds, horizontal/vertical support, semantic resolution and ordinary authoring-error checks remain present. The original probe now rejects without changing draft content.

## Comparison projection

Patch 42697fa8 targets a combined source that contains the SC-01 comparison baseline and bridge 8e612f7a. Its projection still uses Tideglass stable identity and canonical comparison. It adds canonical animationTracks/clip changes, treats omitted and empty animation lists as the same authored state, and supports explicit working-snapshot source associations without inventing a release. It distinguishes changed working revisions and room snapshots while excluding usage timestamps and immutable-source CAS metadata from false differences. Conflicting immutable/source identities are rejected.

All 41 checks across six focused domain files pass at a4aa1c25, including the repaired audit, resolver/catalog cases, canonical animation regression, comparison and immutable reference cases. Changed-file lint, formatting and full TypeScript checks pass. These results concern software contracts; the separate combined UI remains unaccepted.

The [independent bridge experience review](https://github.com/Kgray44/treasurehuntSoT/blob/c7b5fcc1c0dc9d2e6860a3349e14c5e382c1ea1d/Development_Docs/Testing/Product_Experience/evidence/parallax-environment-bridge-20261015/independent-review.md) remains BLOCK_WITH_EVIDENCE, finding PX-BRIDGE-PRESERVATION-EVIDENCE-01. All three overall attempts remain FAIL. The final payload supports semantically unchanged Scene content, but stored Scene bytes, the immutable Environment release assertion and copy-workspace return/reload were not completed. The corrected harness remains unrun. This domain handoff neither supplies those missing outcomes nor grants another capture or resets history.

## Shared editing and integration boundary

The integrated Scene Manager must preserve the requested shared-authoring flow: an owned Environment definition is edited through its existing working workspace, released deliberately, then reviewed and updated per Scene. Existing pinned Scene room editing offers an explicit independent copy. Shared-source editing and independent copying need distinct labels/actions; copying every owned Environment instead of revising its shared definition would not satisfy SC-01. Built-in identities remain copy-only.

The Library projection retains working documents separately from selected releases. Creation, Save As, membership, release and archive keep their canonical services. A Scene retains its old pin until an explicit controlled update. Existing source-bound browser history and all repair counts remain intact. Current protected integration still requires the separately owned Crossdeck prerequisite, fresh exact-source experience evidence, ordinary PASS, protected merge and landed verification.
