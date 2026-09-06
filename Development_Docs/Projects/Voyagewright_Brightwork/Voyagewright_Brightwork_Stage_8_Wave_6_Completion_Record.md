---
title: Voyagewright Brightwork Stage 8 Wave 6 Completion Record
audience: engineering-evidence
status: complete
canonical_for: voyagewright-brightwork-stage-8-wave-6-completion
last_reviewed: 2026-09-06
---

# Voyagewright Brightwork — Stage 8 Wave 6 Completion Record

**Status:** `STAGE 8 WAVE 6 COMPLETE — CAPTAIN + AUTH + PUBLIC + JOURNAL POLISHED — PROTECTED MAIN VERIFIED`
**Completion:** `STAGE 8 WAVE 6 COMPLETE`
**Capability:** `CAPTAIN + AUTH + PUBLIC + JOURNAL POLISHED`
**Integration:** `PROTECTED MAIN VERIFIED`
**Protected base:** `0f45852dbcfc9ad98e65e5f03940b70c9df70057`
**Final product candidate:** `b320c2722793ddc8c2b297f2dce951eb3542d7cb`
**Protected product merge:** PR #649, `e5bcfb81f5118c823914588140416d5d504619db`
**Hosted Mainline:** `Sounding Line / Mainline Decision` passed for PR #649.
**Scope:** Stage 8 Wave 6 only. Wave 1 through Wave 5 were not reopened; Wave 7 did not begin. `PEND-001` and `PEND-002` were not changed or reclassified.

## Finding disposition

### BW-M-021 — Journal parchment contrast and historical context

- **Root cause:** The durable Journal reading surface carried technical/fallback material and its historical context with insufficient separation from the authored parchment and persistent reading controls.
- **Bounded repair:** Strengthened authored parchment ink/edge contrast; added a non-fixed historical-volume banner; removed the fixed objective tray from completed historical records; and kept degraded-presentation messages outside the persistent reading controls.
- **Preserved contracts:** The Journal shell, PageFlip boundary, opening lifecycle, version-pinned historical record, and read-only historical behavior remain owned by their existing Journal implementation.
- **Rendered evidence:** The task-owned reduced-motion Journal capture shows the readable book, fixed active objective, and secondary presentation disclosure; the final Lanternwake lifecycle journey exercises the canonical Journal state, re-entry, PageFlip boundary, and reduced-motion fallback.
- **Test evidence:** Focused Journal Vitest assertions passed; final Lanternwake Phase 3 lifecycle passed; the local normal Sounding Line passed against the frozen candidate.
- **Reference lineage:** `Brightwork_Stage_8_Wave_2_Visual_Family_Registry.json` retains Journal as an authored immersive family, and `Voyagewright_Brightwork_Stage_8_Wave_2_Completion_Record.md` remains the shared visual-governance foundation.
- **Disposition:** `REPAIRED_AND_VERIFIED`

### BW-M-022 — Journal diagnostic hierarchy

- **Root cause:** Opening and PageFlip fallback diagnostics competed with the reading task instead of serving as support detail.
- **Bounded repair:** Kept the readable Journal and actionable degradation notice primary; moved opening result, readable-presentation result, and PageFlip presentation state into `TechnicalDetails`.
- **Rendered evidence:** The reduced-motion Journal capture shows a readable fallback without replacing the authored reading surface; diagnostics remain behind the disclosure.
- **Test evidence:** Focused Journal tests and the final Lanternwake lifecycle regression passed, including three reload/re-entry cycles and the reduced-motion path.
- **Reference lineage:** Wave 2's shared `TechnicalDetails` pattern and the existing Journal lifecycle contracts were reused without altering the Lanternwake harness.
- **Disposition:** `REPAIRED_AND_VERIFIED`

### BW-M-039 — Captain action risk hierarchy

- **Root cause:** Authority transfer, relinquishment, cancellation, and ordinary Voyage commands exposed their operational mechanics without a consistently readable distinction between shared-authority and irreversible consequences.
- **Bounded repair:** Added explicit ordinary, authority, and irreversible action hierarchy; kept consequence language adjacent to confirmation; and retained the established deep teal/brass/action semantics rather than introducing generic warning cards.
- **Rendered evidence:** The desktop Captain capture separates ordinary commands, Captaincy relinquishment, and cancellation with distinct consequence treatment; the mobile capture retains that ordering without horizontal overflow.
- **Test evidence:** Focused Captain command/operations tests passed; the task-owned browser proof reported no serious or critical Axe findings; normal Sounding Line selected and passed the Captain component coverage.
- **Reference lineage:** The Wave 2 Captain family remains `LIGHT_AND_DARK` applicable and the Project Helm authority model remains the source of action eligibility and confirmation behavior.
- **Disposition:** `REPAIRED_AND_VERIFIED`

### BW-M-040 — Captain operational scan and wayfinding

- **Root cause:** Presence, readiness, synchronization, freshness, route context, and recovery evidence were individually available but did not form an immediate operational scan.
- **Bounded repair:** Introduced a concise scan for who is ready, who is present, synchronization, and view freshness; added Captain destinations; and moved projection/map/recovery references into expandable source detail.
- **Rendered evidence:** Captain desktop and mobile captures show the scan before the command surface, retained Crew status, and an intentional mobile linear composition.
- **Test evidence:** Focused Captain operations tests passed; the task-owned browser proof checked scan labels, destinations, responsive overflow, and focused Axe; local normal Sounding Line passed 952 selected unit tests.
- **Reference lineage:** Wave 2 information-hierarchy and responsive-composition rules were applied while retaining canonical Helm membership, presence, and command projections.
- **Disposition:** `REPAIRED_AND_VERIFIED`

### BW-M-041 — Authentication and invitation terminal polish

- **Root cause:** The account primary action was overly generic, an unavailable provider read like a disabled primary control, and invitation terminal outcomes lacked a concise next-step hierarchy.
- **Bounded repair:** Made account primary actions mode-specific; converted unavailable providers into explanatory status cards; added the contextual return destination; and gave invitation terminal states a ceremonial seal, outcome, and next-step summary without exposing private Voyage details.
- **Preserved contracts:** Account mutation, OAuth availability, invitation resolution, terminal privacy, and the valid invitation success ceremony remain server-owned and unchanged.
- **Rendered evidence:** Desktop/mobile sign-in captures show the unavailable-provider explanation; valid and revoked invitation captures show the preserved ceremony and bounded terminal-state hierarchy.
- **Test evidence:** Focused account and invitation tests passed; the task-owned browser proof passed with no serious or critical Axe findings; normal Sounding Line passed its exact candidate and built-server browser-profile contract.
- **Reference lineage:** Wave 2 keeps Auth as `LIGHT_AND_DARK` applicable and invitation as authored immersive; the invitation seal and ceremony remain the established Platform family.
- **Disposition:** `REPAIRED_AND_VERIFIED`

## Local Wave 2 contract usage

- **BW-M-002:** Captain, Auth, invitation, and Journal retain their owned visual families and material grammar; no generic replacement surface was introduced.
- **BW-M-003:** Projection, recovery, event, opening, and PageFlip mechanics are placed in `TechnicalDetails` where they support diagnosis rather than primary task completion.
- **BW-M-006:** Captain destinations and the sign-in return affordance clarify owned navigation without adding a competing route or authority model.
- **BW-M-007:** Captain's two-column-to-linear composition and the targeted mobile account evidence preserve readable, overflow-free task order.

## Final verification and repair lineage

- The final local ordinary Sounding Line decision was `PASS` for `b320c2722793ddc8c2b297f2dce951eb3542d7cb`, against protected base `0f45852dbcfc9ad98e65e5f03940b70c9df70057`; plan digest: `ad14221d61f551defdf234e9fa0dbdb0853635cd95cffe2a2199739c689a6504`.
- That decision recorded eight fresh obligations, 952 passing selected unit tests, exact-candidate formatting, typecheck, private-content scan, Prisma generation, production builds, and a passing built-server generic browser-profile receipt. The fixture-bound visual spec was intentionally skipped in the generic fixture rather than substituted with unrelated data.
- Focused Vitest passed 5 files / 50 tests for Captain commands, Captain operations, account flow, invitation ceremony, and Journal behavior.
- A task-owned production browser run passed the Captain desktop/mobile, authentication desktop/mobile, valid/revoked invitation, and reduced-motion Journal journeys. It captured seven rendered states, found no serious or critical Axe violations, and checked no horizontal overflow for each checked view.
- The final task-owned Lanternwake Phase 3 lifecycle run passed the canonical Journal, PageFlip boundary, three reload/re-entry cycles, and reduced-motion fallback without changing its fixture or harness.
- `npm run typecheck` passed. Full lint passed with zero errors and 108 existing repository warnings. The repository-wide format check retained 26 pre-existing files outside this wave; every Wave 6 source and test path passed changed-file Prettier and `git diff --check`.
- Production builds retained five existing audit/workspace Edge-runtime trace warnings and one existing output-tracing warning; this record does not attribute those existing warnings to Wave 6.
- PR #649's hosted `Sounding Line / Mainline Decision` passed and was squash-merged as `e5bcfb81f5118c823914588140416d5d504619db`. That commit is the verified protected product integration; any later completion-record-only merge carries no product-source changes.

## Evidence boundary and deferrals

Rendered browser proof is local, synthetic, and task-owned. It does not claim production data, live OAuth/provider behavior, physical assistive-technology validation, live Voyage behavior, or owner visual acceptance. The protected merge proves reviewed-source integration, not those external conditions. This completion does not authorize or start Wave 7.
