---
title: Voyagewright Brightwork Stage 8 Wave 4 Completion Record
audience: engineering-evidence
status: complete
canonical_for: voyagewright-brightwork-stage-8-wave-4-completion
last_reviewed: 2026-09-04
---

# Voyagewright Brightwork — Stage 8 Wave 4 Completion Record

**Status:** `COMPLETE — COMMUNITY + STUDIO WORKFLOWS POLISHED`
**Protected base:** `7987e7f60864d26d48ae51330283dff96237ec3e`
**Candidate product commit:** `7b040b50137a29122ad2a2d33cfbe208d27effef`
**Scope:** Stage 8 Wave 4 only. Wave 5 Admiralty work, Wave 6 Captain/Auth/Public/Journal work, and Wave 7 micro-polish remain out of scope.

## Finding disposition

### BW-M-026 — Community discovery/search focus

- **Implementation:** Active searches make their result state primary and remove Home shelves from that search state. Search copy now describes the person's task, while anonymous save/follow controls stay compact without obscuring their sign-in destination.
- **Preserved contracts:** Public Community card grammar, search/filter capability, public projections, authenticated social mutation, useful no-query shelves, and intentional zero-result state.
- **Disposition:** `REPAIRED_AND_VERIFIED`

### BW-M-027 — Community moderation IA

- **Implementation:** The moderator queue and case detail now lead with case work, safe reported subject, evidence, actions, appeals, and case history. Provider/dead-letter information and checksum precision are retained in `TechnicalDetails` rather than primary task hierarchy.
- **Preserved contracts:** Authorization, CSRF, expected revision, audit, conflict checks, quarantine, and reporter/privacy boundaries remain server-owned and unchanged.
- **Disposition:** `REPAIRED_AND_VERIFIED`

### BW-M-028 — Voyage Log workflow family

- **Implementation:** A `CommunityWorkflowFrame` gives private draft, owner detail, and consent routes the established Community Harbor frame without projecting private draft content into public districts. Owner, consent, media, lifecycle, empty, and unavailable states have deliberate workflow composition.
- **Preserved contracts:** Drafts remain private; participant identity, private locations, and unconsented media remain excluded from public projection; consent and publication gates are unchanged.
- **Disposition:** `REPAIRED_AND_VERIFIED`

### BW-M-029 — comments and Creator-response contract

- **Product decision:** **YES — current capability.** Harborlight's mainline catalog explicitly includes reviews, comments, reports, and collections; current routes and service functions enforce authenticated comment/report mutations plus separately retrievable spoiler bodies.
- **Implementation:** Listing detail now contains a governed comment thread with sign-in guidance, reply, report, loading, empty, error, and explicit spoiler-reveal states. Creator response spoiler text receives the same explicit reveal treatment in the existing review surface.
- **Preserved contracts:** No spoiler body is initially rendered; reveal routes retain their public-subject checks and private/no-store response handling; reporting remains authenticated and CSRF-bound.
- **Disposition:** `REPAIRED_AND_VERIFIED`

### BW-M-035 — Studio Exchange

- **Implementation:** The Exchange now composes immutable release selection, licensing/accessibility/scanner requirements, package readiness, reuse intent, a no-install preview sandbox, and receipt state as one staged Studio workflow.
- **Preserved contracts:** Release immutability, scanner and validation gates, attribution/license obligations, server receipts, and reduced-motion preview behavior remain unchanged.
- **Disposition:** `REPAIRED_AND_VERIFIED`

### BW-M-036 — Studio Private Content

- **Implementation:** Private Content now separates designed package selection/import, verified export, and private import history, with explicit selected-package, validating/progress, empty, failure, and success states.
- **Preserved contracts:** Sealed Hold authentication, passphrase handling, encryption/package validation, scanner/provider requirements, unpublished import semantics, verified protected export, and non-disclosure of decrypted content remain unchanged.
- **Disposition:** `REPAIRED_AND_VERIFIED`

### BW-M-037 — New Chronicle desktop composition

- **Implementation:** The existing two-column creation form now uses the wider Studio canvas on desktop while retaining its original field order, semantic labels, validation, and one-column mobile reflow.
- **Preserved contracts:** Chronicle-creation request contract, keyboard order, responsive behavior, and simple non-wizard flow are unchanged.
- **Disposition:** `REPAIRED_AND_VERIFIED`

## Local Wave 2 contract usage

- **BW-M-002:** Community and Studio retain their established material families rather than use generic shell cards.
- **BW-M-003:** Moderator delivery/checksum precision uses the shared `TechnicalDetails` disclosure.
- **BW-M-006:** Community and Studio product navigation remains owned by their existing frames/shells.
- **BW-M-007:** Search, workflow panels, Studio steps, and mobile layouts use deliberate summary/detail and desktop-to-linear recomposition.

## Focused candidate verification

- Focused Vitest: 20 tests across discovery, anonymous save affordance, reviews, comment spoiler reveal, Creator response spoiler reveal, Exchange preview, and Voyage Log consent.
- `npm run db:generate`, `npm run typecheck`, changed-file Prettier, `git diff --check`, `npm run docs:index`, `npm run docs:validate`, `npm run features:sync`, and `npm run features:validate` passed in the isolated worktree. Full lint completed with zero errors and 108 repository warnings; the Wave 4 CommentThread lint error was corrected before candidate freeze.
- A task-owned production `next build` passed compilation and TypeScript. It retained five existing audit/workspace Edge-runtime trace warnings and one existing output-tracing warning; this record does not attribute them to Wave 4.
- Candidate product commit `7b040b50137a29122ad2a2d33cfbe208d27effef` passed a task-owned SQLite production `next start` browser journey. Seven desktop/mobile captures cover active Community search, private Voyage Logs, Exchange, Private Content, and Chronicle creation. Focused Axe found no serious or critical violations, each checked view had no horizontal overflow, and the Exchange preview now uses the checked-in Compass fallback rather than a missing image.
- The one normal Sounding Line/Mainline Decision is intentionally run only after this final record commit is frozen; its governed receipt is separate from this local completion record.

## Evidence boundary and deferrals

Current evidence is local and synthetic. It does not claim deployment, production data, live scanner/provider behavior, physical assistive technology, owner visual acceptance, or a full Brightwork corpus recapture. No Wave 5 work began.
