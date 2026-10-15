---
title: SC-00A Chronicle creation and inline details
audience: engineering
status: in-progress
canonical_for: chronicle-sc-00a-implementation
last_reviewed: 2026-10-15
---

# Chronicle Creator: New Entry & Inline Details

Initial protected base: `4baa39af82b78b50a46f590bc2acc2ff0b7597aa`.
Owned branch: `codex/chronicle-sc-00a`. This is engineering evidence;
the active task contract is [under .agents](../../../../.agents/sc-00a.md).

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

Production-browser candidate: `3aaaf45e9e28b346476885b9f6eaa858bbaf6de0`;
tree: `c7204dc02bdd2bbf2d63256e8c29b0d2650e4f06`. The [local evidence manifest](evidence/local-verification.json)
binds eight fresh light/dark, full-page desktop/mobile screenshots and runtime
receipts to this frozen product source. The fresh eight-journey production run
passed after independent review identified the earlier screenshots' source limit.
Focused component checks retain their original `66bc6df5` checkpoint; the
relevant component and authorization source is unchanged. Evidence-only commits
do not replace these source identities.

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

## Trusted capture

Protected-base [capture run 38681552281](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38681552281)
passed on frozen candidate `3aaaf45e9e28b346476885b9f6eaa858bbaf6de0`.
The [provenance record](evidence/trusted-capture-provenance.json) identifies capture
artifact `11948621812` and lifecycle artifact `11948796667`. Four complete
Creator journeys cover desktop/mobile in normal/reduced motion, with 40 actual
screenshots, recordings and traces. Automated evidence validation and lifecycle
cleanup pass. Measured action feedback ranges from 108 to 383 ms against the
contract's 15-second bound. No horizontal overflow or serious/critical axe
finding was observed. These measurements do not substitute for independent
visual criticism or owner acceptance.

The committed [review packet](../../Testing/Product_Experience/evidence/generic/chronicle.creation-review-packet.json)
binds the actual captures, source digest and contract. A separate reviewer
inspected all 32 screenshots, four recordings, four traces, accepted references
and the fresh eight-image supporting set before its narrow source checks.
Its [17-dimension review](../../Testing/Product_Experience/candidate-review.json)
is ACCEPTED at iteration 2, with no blocking findings. One subjective opportunity
remains: unify textarea typography with adjacent inputs. The refreshed supporting
captures resolve the earlier light-theme and full-mobile source limits.
Authenticated submission retains the same review and source identities;
preparation provides no required mainline verdict or owner acceptance.

## Delivery authority and limits

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

SC-00's Spatial Studio overhaul remains separate in draft PR #722. The owner's
continuation and shared-file handoff request were forwarded to its existing
Parallax Spatial Assistant chat with explicit routing authorization. SC-00B's
Inspector/tool rail, SC-00C's Library and SC-07A's Harborlight publishing scopes
remain separately owned. This Chronicle change does not claim those refits or
the whole Spatial Studio overhaul are complete.
