# Project Lanternwake Phase 4 — Implementation Report

## 1. Executive summary

Phase 4 implements the assigned platform, Library, invitation, waiting-room, shell, Quartermaster, Studio, notification, and offline/reconnect presentation contracts at code commit `7521afa049b73ba39cd9d237773a6772d3656b5d`. The implementation reuses the Phase 1–3 Director, SceneHost, target preflight, ownership, receipt, replay, focus, motion-policy, and cleanup architecture. The canonical denominator is 151 MX rows plus 122 OA rows, with zero unmapped Phase 4 requirements. Final integrated validation remains the last completion gate until the Validation Report records the serialized `npm run validate` result.

## 2. Starting branch and commit

- Branch: `codex/project-lanternwake-phase-4-bring-the-harbor-alive`.
- Starting commit: `3a24e1e9c88449ee0bdfe35d7ab4bfe378d82fac`.
- Code-and-tests commit: `7521afa049b73ba39cd9d237773a6772d3656b5d`.

## 3. Repository safety

Work ran in `C:\Users\kkids\Documents\Codex_TreasureHunt_Phase4`, separate from the dirty root checkout. Existing staged, unstaged, untracked, environment, and database state in the root checkout was not modified. No destructive Git command was used.

## 4. Dependency verification

No dependency, lockfile, Prisma schema, migration, or database-reset change was required. Existing Motion, GSAP, dnd-kit, SceneHost, animation-policy, and browser-test dependencies are reused. TypeScript compilation and focused runtime tests pass; the production build remains recorded by the final integrated gate.

## 5. Motion language

The harbor uses restrained nautical material cues: ambient motion is subordinate, intent feedback is immediate, state reconciliation follows server truth, route travel is short, and ceremonies are bounded inside local hosts. Animation never substitutes for status text, focus, or an authoritative result.

## 6. Token system

`src/animation/platform/motion-tokens.ts` provides six tiers—micro, state, layout, route, ceremony, and ambient—with explicit full, gentle, and reduced values. Ordinary controls remain within 4 px and 1.5% scale; routes are capped at 22 px; contained ceremony travel is capped at 36 px. Reduced mode removes spatial travel while preserving order and meaning.

## 7. SceneHost usage

Existing scoped hosts and ownership permits remain authoritative. Phase 4 adds only the `studio-publish` production scene contract required for an authoritative Studio publish receipt. Local Motion, GSAP, CSS, and dnd-kit work is separated by node/property ownership; no second Director, provider, registry family, or Player progression host was created.

## 8. Landing implementation

`HarborLanding` now provides deterministic nonsynchronous ambience, visibility/reduced-motion pauses, role intent and handoff states, remembered-session badges, stable shared relic identity, static critical frames, and readable reentry. Decorative role objects are hidden from assistive technology and never become accidental tab stops.

## 9. Authentication implementation

Player, Captain, and Creator sign-in surfaces use an authoritative async lifecycle with single-flight request identity, slow-state text, recoverable failure, input preservation, permission mismatch, distinct role relics, and success-only route handoff. Switching Player entry methods clears stale method-specific errors without clearing entered values.

## 10. Invitation implementation

The invitation ceremony covers resolving, valid, PIN-required, invalid, expired, revoked, accepting, accepted, declined, replacement, and account-required states. Seal, ribbon, and title choreography begins only after authoritative acceptance; mutation failures restore readable controls. Tokens and PINs are excluded from labels, keys, and animation metadata.

## 11. Player Library implementation

The Player Library supports grouped/gallery/list presentation, filters, pinned/hidden preferences, invitation and waiting states, semantic empty output, changed-only polling, durable card identity, and authoritative navigation. New-invitation presentation is one-shot per card and server version.

## 12. Captain Library implementation

The Captain Library supports grouped cards, attention/readiness states, filters, stable layouts, launch reconciliation, and New Voyage entry. Changed-only polling avoids entrance replay, and success presentation waits for committed server state.

## 13. Wizard implementation

The New Voyage flow preserves values across step and validation transitions, blocks duplicate submission, exposes field and summary errors, retains created invitation results until explicit close, and restores the opening trigger. Directional motion collapses to immediate semantic settlement in reduced mode.

## 14. Waiting-room implementation

The waiting room distinguishes connecting, live, polling, reconnecting, scheduled, launch-ready, releasing, and terminal revoked states. Crew and readiness updates use semantic deltas. Launch presentation is one-shot per voyage status and authoritative synchronization time, then hands off to the existing Player journal path.

## 15. Shell, theme, and focus implementation

`ProductShell` owns the keyed route boundary, active navigation plate, unseen badges, and exact-once destination focus without stealing focus from active typing. Route fallback remains direct if Motion ownership is unavailable. Mobile navigation wraps without horizontal overflow.

## 16. Loading, error, and success implementation

`AsyncState` and the shared authoritative async hook provide idle, pending, slow, success, recoverable-error, terminal-error, and cancelled semantics. Stale/unmounted responses cannot commit presentation state; failures remain textual and retryable; success never precedes server acceptance.

## 17. Offline and reconnect implementation

OA-170 / MX-254 is implemented end to end. The event-stream failure records the latest authoritative sequence, reconnect requests `offlineAfterSequence`, the server projects only later events with a server-generated synchronization time, and Ship's Log labels those rows while retaining authoritative event order. Subsequent refreshes preserve the label for the session. Reduced mode inserts the row statically. The client never synthesizes an event time.

## 18. Notifications implementation

Navigation and Library notifications use durable unseen/changed identities, readable counts, and authoritative acknowledgment. Failed viewed acknowledgments keep unseen truth and expose retry; a success state appears only after the ledger confirms the write.

## 19. Quartermaster implementation

Quartermaster confirmation names the exact command, target, consequence, expected sequence, and undo scope. A command is queued and presented from authoritative receipts; failure reverses to the pre-command pose, success exposes result identity/sequence before reconciliation, and conflicting actions remain visibly serialized or rejected.

## 20. Studio implementation

Studio Home, New Tale, editor sections, insertion, deletion/undo, reorder, validation, autosave, preview, publish, versions, per-file upload, comparison, and immutable states have deliberate presentation. dnd-kit exclusively owns drag transforms through a dedicated handle; Motion owns only post-drop/presence wrappers. Publish/version ceremony is local and receipt-gated. The mobile More disclosure is semantic, keyboard accessible, and overflow-safe.

## 21. Rive/Lottie Phase 5 handoff

Invitation Seal, Journal Clasp, and Compass/role objects retain stable semantic state names, triggers, focus, text, and reduced poses behind truthful SVG/CSS fallbacks. No production `.riv` or new Lottie asset is claimed. Phase 5 may replace only the internal visual implementation without changing these contracts.

## 22. OA implementation totals

- Assigned: 122.
- Implemented at `7521afa`: 122.
- Focused validation status: 122 `focused_pass`.
- Final integrated validation: pending.
- Blocked: 0.

## 23. MX implementation totals

- Assigned: 119.
- Implemented at `7521afa`: 119.
- Focused validation status: 119 `focused_pass`.
- Final integrated validation: pending.
- Blocked: 0.

## 24. Tests

The focused cross-surface integration checkpoint passed 38 suites / 237 tests. The offline recovery slice passed 23 selected tests across four files; the snapshot validator passed 33 tests; the Phase 4 Chromium semantic/axe/mobile specification passed 2 tests; TypeScript and `git diff --check` passed. Exact commands and the final integrated result are maintained in the Validation Report.

## 25. Accessibility

Status is always textual; decorative motion is hidden; role objects are not focusable; dialogs restore focus; form failures are associated and recoverable; shared visual clones do not duplicate accessible content; dnd-kit has a dedicated keyboard/touch handle; reduced motion preserves meaning. Automated axe coverage includes landing, Studio, reduced, and mobile states.

## 26. Viewports

Targeted checks cover desktop 1440×900 and mobile 390×844 for landing, authentication, Libraries, Studio, and Quartermaster states. Mobile Studio overflow and its collapsed More disclosure were corrected. The integrated Playwright gate remains the authority for the full required viewport set.

## 27. Performance and lifecycle

Ambient work pauses while hidden/reduced; polling reconciles semantic deltas; one-shot keys prevent replay; request timers/controllers and scene ownership clean up on settle/unmount; dnd-kit and Motion do not write the same transform. No new unbounded loop, global observer, or duplicated provider was added. Integrated lifecycle and production performance results remain recorded by the final gate.

## 28. Files changed

The code checkpoint changes 62 source/test files: 18 new focused runtime/component/test files and 44 modified files. Documentation adds the design record, 273-row manifest, implementation report, validation report, visual checkpoint index, and deterministic generator updates. Canonical matrix, OA ledger, audit, roadmap, and test plan are updated in the evidence commit.

## 29. Deviations

Two narrow changes crossed the initially frozen leaf boundary: the existing scene registry gained `studio-publish`, and the authoritative Player snapshot/log projection gained offline synchronization metadata. Both were reproduced Phase 4 blockers, use existing architecture, include regression tests, and do not broaden into a platform redesign.

## 30. Known limitations

Production Rive/Lottie internals remain Phase 5 work. Broad performance polish, visual density refinement, and final art tuning remain Phase 6 work. These are assigned future-phase boundaries, not Phase 4 blockers. The final integrated verdict is not claimed until the serialized validation gate passes.

## 31. Phase 5 handoff

Replace the static Invitation Seal, Journal Clasp, and Compass/role internals only through their existing semantic state interfaces. Preserve authoritative triggers, focus, text, reduced poses, fallback labels, test selectors, and local ownership boundaries. Do not replay mutations when swapping visuals.

## 32. Phase 6 handoff

Use the Phase 4 token tiers, targeted viewport observations, ambient pause rules, axe results, and lifecycle gate as the tuning baseline. Phase 6 may tune performance and visual polish but must not reopen authoritative state, route focus, replay, or runtime ownership contracts.

## 33. Formal acceptance addendum

This addendum supersedes the earlier pending-final-gate wording. The full harness was run once and reached a shared Next 16 Turbopack chunk-loading failure during the browser matrix; it was repaired by using Webpack for the long-lived validation server. The exact repaired WebKit route test passed with its nonce-bound database and Axe audit, modal focus-return coverage passed 27/27, strict TypeScript/format/whitespace checks passed, and the canonical SQLite family remained unchanged. The project owner explicitly prohibited a second full-main-suite run and authorized formal acceptance. All 122 OA and 151 MX Phase 4 rows are therefore accepted as `passed` through the recorded composite evidence. No Phase 5 or Phase 6 work is started by this acceptance.
