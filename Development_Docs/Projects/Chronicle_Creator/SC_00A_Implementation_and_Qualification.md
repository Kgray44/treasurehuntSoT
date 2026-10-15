---
title: SC-00A Chronicle creation and inline details
audience: engineering
status: in-progress
canonical_for: chronicle-sc-00a-implementation
last_reviewed: 2026-10-14
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

## Verification and current limits

The managed worktree attempt failed because C: had approximately 90 MB free.
The owned checkout, dependencies, databases, scratch files and logs are on D:.
No unrelated data or process was removed. Prisma generation passed.

The first local Vitest fork could not start within its startup budget. The next
focused run passed all six new creation API/selection tests but could not start
the editor worker. An editor run passed 16 of 21 checks: one Address accessible
name defect was repaired; four existing checks hit five-second local timeouts
under concurrent host pressure. The next single-worker diagnostic run passed
26 of 27 checks, with the label fix still pending in its compiled input. Failed
logs remain task-owned. These observations do not constitute browser, visual
or mainline acceptance.

The `chronicle.creation` Product Experience contract defines natural entry,
creation, inline editing, save feedback, return, desktop/mobile, normal/reduced
motion, accepted references and synthetic Creator identity. Dedicated browser
tests cover no creation on view, disabled choices, header cancel/apply, metadata
persistence, reopen, incomplete-draft publication refusal and conflict recovery.
Existing Studio, Shipwright, Drydock and Homeport creation journeys now use
manual creation and inline metadata while retaining their domain assertions.

Required before integration: focused checks, production browser journeys,
light/dark evidence, independent experience review, exact-candidate ordinary
Sounding Line, protected merge and landed-source verification. Owner product
acceptance and physical mobile/assistive-device acceptance stay separate.
