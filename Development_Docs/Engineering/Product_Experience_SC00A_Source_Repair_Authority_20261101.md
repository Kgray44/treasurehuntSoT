---
title: SC-00A exact source repair amendment
audience: engineering
status: proposed
canonical_for: sc00a-homeport-source-repair-amendment
last_reviewed: 2026-11-01
---

# SC-00A exact source repair amendment

The Homeport transition authority landed in #827 at protected main `0194edbc905a3443eea622b3a1c97b80a8425545`. This additive amendment preserves its original record, digest `a816a0a7d804594f5f2d29960be6be3497c73b6edd48317d6552309ec4cbf236`, reviewed ancestor `d83e81c9468363b09d1d776fa279c38cc2226ca9`, tree `2617baf5c14cce300a4e44fde6ae0725654c1ebb`, and three historical proof copies.

The separately reviewed product repair is PR #820 candidate `7281ef3cc419ed7457b212b3a4a4f56cf0f2efbc`, tree `88d40031c2fe95dac46236f4218f45656d09d11e`, on accepted main `0194edbc905a3443eea622b3a1c97b80a8425545`. Its parent is `cf5ffd1a7800be4cf03c41ebfd0ed933fd5ad209`. The complete parent delta contains exactly two mode-100644 replacements:

| Path                                         | Reviewed replacement blob                  |
| -------------------------------------------- | ------------------------------------------ |
| `src/components/studio/ChronicleDetails.tsx` | `9b2b1c21c470f9cf8d26e4a36c6916cde37da32a` |
| `tests/e2e/chronicle-creation.spec.ts`       | `ea9450f3722974b6c013f73964f35dd6c457de60` |

The repair brings the save footer into view after keyboard submission. The permanent test covers Tab/Enter save, visible inline feedback, and Escape focus restoration. The CSS pin remains unchanged. The product owner reports exact-source focused, TypeScript, production-build, four Chronicle and six Homeport cases passing; separate media-first critique resolved `SC00A-MOBILE-REDUCED-SAVE-FEEDBACK-OFFSCREEN` in local evidence. Dark mobile saved-frame SHA-256 is `c17530a65234b687bcdeb3a0b01b4405d6e3840f15a8943b27fc630778700353`; light mobile saved-frame SHA-256 is `f6c0f2c0364d9b0665d7c3e44a530c0f52296ef7e53fbbee86df8159d795ea94`. Capture artifact `13084384070` belongs to the earlier `cf5ffd1` source.

## Finite protected-base enforcement

`experiencePolicy.journeyMigrationSourceAmendment` is read only from protected base and pinned by digest `ae3b96c65d9d75167b824931131188e3e9b07a109a499fa805ce668efd25662d`. The controller derives an effective source closure while leaving the original record intact. It retains all 21 approved paths and ten browser/fixture/visual pins, replacing only the two reviewed blobs/hashes and the necessary inherited-registration witness. The new witness contains exactly the original approved contract data plus the authority policy inherited from accepted main.

All original immutable proofs are checked alongside the new registration witness. Ancestry must include the current protected base, original reviewed source, and exact repaired source. PR identity remains #820, expiry remains `2026-11-14T23:59:59Z`, and all old/new Homeport contract and journey digests, permitted fields, additive Chronicle registration, review ordinals and unaffected obligations remain in force. Candidate policy edits still route to the control-plane/mixed-change denial before product admission.

The publication tail remains `Development_Docs/Testing/Product_Experience/evidence/sc00a-20261031/`. Fresh captured media may use that namespace with original artifact IDs and SHA-256 values; existing historical generic files remain immutable. This amendment grants no review ordinal or execution exception.

## Qualification gates

Current main's 502 accepted contracts and old Title journey remain unchanged. The authority candidate requires focused historical/amended-source adversarial checks, independent source review, six exact-source old-Title browser cases, ordinary protected control-plane qualification, guarded merge and landed smoke. The product then retains fresh protected capture/review and qualification gates under the installed amendment. Physical-device and owner acceptance remain separate.
