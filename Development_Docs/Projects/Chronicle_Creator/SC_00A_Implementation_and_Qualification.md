---
title: SC-00A Chronicle creation and inline details
audience: engineering
status: current
canonical_for: chronicle-sc-00a-implementation
last_reviewed: 2026-10-15
---

# Chronicle Creator: New Entry & Inline Details

Initial protected base: `4baa39af82b78b50a46f590bc2acc2ff0b7597aa`.
Owned branch: `codex/chronicle-sc-00a`. This is engineering evidence;
the active task contract is [under .agents](../../../.agents/sc-00a.md).

## Behavior and ownership

The old `/studio/tales/new` setup URL now offers exactly Create Manually,
Create with AI, Adapt a Story, and Start from a Template. Viewing it only reads
the authorized library/CSRF projection. Manual selection invokes the existing
`createStudioTale` transaction with an untitled working title and a unique
cryptographically generated address. Ownership stays bound to the authorized account.
No AI, Story Import, new schema, Scene binding, or Parallax work is included.

Whole-Chronicle template creation is unavailable in current source. Existing
Chapter templates, fragments, presets and insertion remain in TaleEditor.
All three unavailable choices visibly say Coming soon and are disabled;
unavailable choices have no creation handler. Manual creation uses the existing authorized creation API without a new service branch.

Chronicle Details is one component shared by the inline editor panel and legacy
settings URL. Its current fields are title, address, subtitle, short and long
descriptions, cover asset, theme, visibility, minimum/maximum players, duration,
and content warnings. There are no supported Chronicle difficulty or tags fields.
The header directly edits the same title. Existing save/history and optimistic
version authority persist all metadata. Keyboard apply/cancel, restored focus,
native controls, retry and saved-state feedback support ordinary editing.
Conflict pauses autosave, preserves local edits, compares saved metadata and
requires confirmation before replacing the local draft. Section navigation
awaits current saved edits. Incomplete drafts remain editable; Drydock and
canonical publication checks remain unchanged.

Scoped CSS modules use existing semantic themes and motion tokens. No shared
Studio stylesheet, Parallax source, or adjacent worktree is edited.

## Focused verification

Production-browser candidate: `d35140129eadae99f8ec0a8eb3f9ff525b50fc59`;
tree: `9e3592f26b3337a9971ced6af80f9088505b4fec`. The [local evidence manifest](evidence/local-verification.json)
binds eight fresh light/dark, full-page desktop/mobile screenshots and runtime
receipts to the repaired source. Eight actual production journeys passed.
The 29 focused component/authorization checks passed on repair commit
`19ba99dc`; those component blobs are unchanged by the protected-main merge.
A fresh four-context production experience replay passed normal/reduced motion,
contrast, overflow and lifecycle checks on this reconciled source. Evidence-only
commits do not replace these identities.

- Production Next build and TypeScript validation passed.
- Focused component and Studio authorization checks: 29 tests passed in three files.
- Actual production Chromium: eight journeys passed, including desktop/mobile
  creation, header cancel/validation/apply, metadata editing, real
  synthetic cover upload, save/leave/reopen, incomplete-draft editing and
  publication refusal, conflict comparison/recovery, failed-save retry and the
  existing published Chronicle/Player/Captain/media paths.
- Both light and dark creation/Details states were captured on desktop/mobile;
  keyboard, reduced motion, overflow and serious axe checks passed.
- Task-owned browser/server lifecycle cleanup passed; processes were reaped,
  streams closed and loopback ports released.
- Updated browser consumers also passed: Brightwork Wave 4, Drydock Phase 4,
  Shipwright Phases 2 and 3, Homeport Patch A journey N, and Shipwright Phase 5's
  complete immutable-publication journey. Phase 5 ran against the isolated
  production app with a synthetic Creator; its generic-suite skip is not counted
  as proof. The historical development runner's animation-host failure is retained
  separately and does not replace the successful production result.

The `chronicle.creation` Product Experience contract describes natural entry,
creation, inline editing, feedback, return, desktop/mobile, normal/reduced motion,
accepted visual references and the synthetic Creator identity. Existing Studio,
Shipwright, Drydock and Homeport tests retain their domain assertions while
using manual creation and inline metadata.

## Trusted capture and blocked independent review

Protected-base [capture run 38688383108](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38688383108)
completed on repaired product source `d35140129eadae99f8ec0a8eb3f9ff525b50fc59`,
based on protected main `99a2babaefbbe051de0352c4aca22c8723b743b8`.
The [provenance record](evidence/trusted-capture-provenance.json) identifies
capture artifact `11951925635` and lifecycle artifact `11951805615`.
Four complete Creator journeys cover desktop/mobile in normal/reduced motion,
with 40 actual screenshots, recordings and traces. Artifact validation and
lifecycle cleanup pass. Measured action feedback ranges from 117 to 181 ms
against the contract's 15-second bound. No overflow or serious/critical axe
finding was observed. This threshold does not mean zero raw axe observations.

The [review packet](../../Testing/Product_Experience/evidence/generic/chronicle.creation-review-packet.json)
binds the actual artifacts, source digest and contract. The separate reviewer
inspected all 32 screenshots, four recordings, four traces, accepted references
and eight fresh same-source light/dark supporting images; all hashes match.
Its [17-dimension review](evidence/independent-review-blocked-iteration3.json)
is **BLOCKED at iteration 3** by `SC-00A-REVIEW-A11Y-01`: the desktop Passage
library and Inspector are two unnamed complementary landmarks. Their visible
headings do not give the landmarks distinct accessible names. Raw trace axe
results report the moderate `landmark-unique` observation in desktop editor
and saved Details states in both motion modes. This is an unresolved semantic
navigation defect, despite the passing visual and Tab-based journey.

The same source structure exists on protected base, but there is no registered
rendered baseline-debt exemption. It is not waived. The save-text and drop-hint
contrast repairs show no violations in the fresh trace audits; manual contrast
incompletes, physical devices, live screen-reader audio and owner acceptance
remain unclaimed. The optional textarea typography opportunity is nonblocking.

The canonical [candidate report](../../Testing/Product_Experience/candidate-review.json)
records the blocking review with no completion claim. No accepted authenticated
review artifact or ordinary PASS exists for this repaired source. The earlier
accepted iteration-2 capture/review artifacts `11948621812` / `11949726414`
belong to source `3aaaf45e` and remain historical, not current acceptance.

The [proposed two-label correction](evidence/proposed-landmark-labels.patch)
adds distinct `Passage library` and `Passage inspector` accessible names.
It passes `git apply --check` and is deliberately unapplied. Its SHA-256 is
`d92ff80369604adec514ec9a1bac4393b9a3a2a80d01d42cc78529b190c57e76`.
The [workflow](../../../.agents/product-experience-workflow.md) requires
stopping repeated repair after three iterations. A specific owner decision
on another bounded repair/review cycle is required; no fourth review or policy
exception is inferred from general implementation authorization. Feature Catalog
promotion is deferred while the capability remains unqualified.

The [section 24.2 decision packet](SC_00A_Review_Limit_Exception_Proposal.md)
proposes `PE-X-SC00A-LANDMARKS-20261015` for precisely the bound two-label patch,
one fresh capture attempt and the fourth independent review. It is inactive,
has no KG approval and changes no acceptance rule. Publishing the proposal does
not resume the gated repair or qualify this branch.

## Delivery authority and limits

[Ordinary run 38684202576](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38684202576)
failed on candidate `495fb5a760cc1edee7918c259b7943f6ecb22427`.
Its 1,051 selected component/contract tests, 12 general browser cases and all
14 Homeport journeys passed, as did authenticated experience attestation and
browser cleanup. A bounded unchanged-source replay exposed the failed final
accessibility check: fading save feedback measured 2.6:1 contrast against the
header during normal motion. The save message now updates at full opacity.
The failed decision remains failure; the repaired source requires fresh
capture, independent review and ordinary qualification before integration.

Preparation run `38687074703` completed on `3d7c661c`, but validating its
artifacts found one remaining normal-motion mobile contrast defect at editor
entry. Its trace identifies the timeline's "Drop here" hint while its text
color interpolates from transparent, measuring 1.23:1 contrast. The scoped
Chronicle stylesheet now toggles hint visibility at full text contrast while
preserving the drop-zone geometry/background transitions. That capture is
historical and does not qualify the repaired source.

[PR #726](https://github.com/Kgray44/treasurehuntSoT/pull/726) is the delivery
record. Trusted capture, independent review and the final exact-candidate
ordinary Sounding Line decision establish their own evidence tiers. Local
checks alone do not establish protected integration. The merged PR and its
required check identify the qualified source; landed smoke is recorded in the
delivery evidence when performed. Owner PRODUCT_ACCEPTED and physical
mobile/assistive-device acceptance are not claimed.

The initial managed checkout failed with C: nearly full. The owned checkout,
dependencies, databases, scratch files and logs use D:. No unrelated data or
process was removed. Earlier worker-start timeouts, failed development runs and
the cancelled preparation run remain failed/cancelled; the evidence manifest
describes only the final completed run. No prior acceptance receipt is reused.

Trusted preparation run `38679722803` reached six contexts, then exhausted the
existing six-attempt sign-in limit on the seventh context. Capture now executes
the same choice-preview and authoring actions as one continuous journey in each
device/motion context, preserving every assertion without changing authentication.
Superseded preparation `38680449344` was cancelled when a stale Brightwork CSS
selector required a test correction. These runs provide no accepted experience
or mainline verdict.

## Integration handoff

SC-00A owns `NewTaleForm`, `ChronicleDetails`, `ChronicleAuthoring.module.css`,
`StudioStatusHeader`, `TaleEditor` and the affected Chronicle browser consumers.
Canonical Chronicle storage, authorization, schema and publication services are
unchanged. Future Scene attachment must consume the SC-01 immutable SceneReference
contract after its owning work lands; this task adds no spatial binding.

The shared declarative files are `testing/contracts.json`, `testing/impact-map.json`
and `testing/suites.json`; preserve the `chronicle.creation` contract and affected
consumer registrations when integrating adjacent work. The shared Studio feature
fragment, generated catalog, documentation index and `.agents/README.md` require
normal reconciliation rather than replacement. Chronicle Details continues using
the existing TaleEditor model and save/history/optimistic-version transaction.
Spatial Inspector/Library components, spatial selection, entity property schemas
and Scene/Environment persistence remain with SC-00 and their owning follow-ups.

SC-01's pending reference pins the exact Scene definition/version/checksum and
Environment ID/version/revision/checksum, behavior IDs and transition intent
(`CUT` or `PRESERVE_ENVIRONMENT`). Environment release IDs are opaque. Do not
substitute a working copy or latest-version lookup for an immutable pin, or add
a second Chronicle publication authority. SC-01's draft PR #727 remains pending;
this interface description is a handoff constraint, not a completion claim.

SC-00's Spatial Studio overhaul remains separate in draft PR #722. The owner's
continuation and shared-file handoff request were forwarded to its existing
Parallax Spatial Assistant chat with explicit routing authorization. SC-00B's
Inspector/tool rail, SC-00C's Library and SC-07A's Harborlight publishing scopes
remain separately owned. This Chronicle change does not claim those refits or
the whole Spatial Studio overhaul are complete.
