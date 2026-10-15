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

Product source candidate: `66bc6df56a95aaba09bb6b3dfb2e4cddfdc85f62`;
tree: `3b6cc100eefa08556ff0891f4dbe243e8da37028`.
The [local evidence manifest](evidence/local-verification.json) binds the actual
screenshots and runtime receipts to this source. Later evidence-only commits
do not replace that source identity.

- Production Next build and TypeScript validation passed.
- Focused component and Studio authorization checks: 29 tests passed in three files.
- Actual production Chromium: eight journeys passed, including desktop/mobile
  creation, header cancel/validation/apply, every supported metadata field, real
  synthetic cover upload, save/leave/reopen, incomplete-draft editing and
  publication refusal, conflict comparison/recovery, failed-save retry and the
  existing published Chronicle/Player/Captain/media paths.
- Both light and dark creation/Details states were captured on desktop/mobile;
  keyboard, reduced motion, overflow and serious axe checks passed.
- Task-owned browser/server lifecycle cleanup passed; processes were reaped,
  streams closed and loopback ports released.

The `chronicle.creation` Product Experience contract describes natural entry,
creation, inline editing, feedback, return, desktop/mobile, normal/reduced motion,
accepted visual references and the synthetic Creator identity. Existing Studio,
Shipwright, Drydock and Homeport tests retain their domain assertions while
using manual creation and inline metadata.

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
