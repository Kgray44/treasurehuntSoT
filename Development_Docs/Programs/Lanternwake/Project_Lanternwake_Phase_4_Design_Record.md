# Project Lanternwake Phase 4 Design Record

Status: implemented at `7521afa049b73ba39cd9d237773a6772d3656b5d`; integrated validation pending
Program: Project Lanternwake
Phase: Phase 4 — Bring the Harbor Alive
Formal scope: Platform, Library, Invitation, Waiting Room, Shell, Quartermaster, and Studio Motion
Date: 2026-07-19
Branch: `codex/project-lanternwake-phase-4-bring-the-harbor-alive`
Starting commit: `3a24e1e9c88449ee0bdfe35d7ab4bfe378d82fac`

## 1. Truth boundary and dependency decision

Phase 4 starts from the clean Phase 3 tip in its own worktree. Phase 2 is an ancestor of Phase 3. The Phase 1 truth contracts, Phase 2 host/ownership contracts, and Phase 3 persistent Player presentation boundary exist in source and are reused without a competing director, provider, host, ownership registry, or event queue.

The Phase 3 validation report is still a pre-execution scaffold even though later Phase 3 implementation/fix commits exist. Phase 4 therefore consumes the source architecture but must re-prove the dependency-sensitive focused tests and final integrated gate. It does not rewrite Phase 3 Player presentation or claim its historical pending rows as passes.

The current Phase 4 denominator is:

- 119 matrix rows assigned to Phase 4;
- 122 OA requirements assigned to Phase 4;
- 241 traceable manifest rows;
- zero accepted requirements unmapped at intake;
- OA-216 through OA-219 remain Phase 3-owned;
- OA-207 through OA-215 and OA-220 remain Phase 4-owned;
- OA-170 / MX-254 is an additional Phase 4 assignment outside the headline ranges.

## 2. Platform motion tokens

`src/animation/platform/motion-tokens.ts` is the single TypeScript authority for ordinary platform duration, distance, scale, and easing limits. Components consume resolved tokens instead of inventing unrelated numbers.

| Tier     | Full duration | Gentle duration | Reduced duration | Full distance | Gentle distance | Reduced distance |
| -------- | ------------: | --------------: | ---------------: | ------------: | --------------: | ---------------: |
| micro    |        180 ms |          120 ms |            40 ms |          4 px |            2 px |             0 px |
| state    |        320 ms |          200 ms |            60 ms |         10 px |            4 px |             0 px |
| layout   |        420 ms |          260 ms |             0 ms |         18 px |            8 px |             0 px |
| route    |        460 ms |          280 ms |             0 ms |         22 px |            8 px |             0 px |
| ceremony |       1100 ms |          700 ms |             0 ms |         36 px |           14 px |             0 px |
| ambient  |       8000 ms |        12000 ms |             0 ms |          8 px |            3 px |             0 px |

## 3. Easing families

- Intent: `cubic-bezier(0.2, 0.8, 0.2, 1)`.
- State/layout: `cubic-bezier(0.22, 1, 0.36, 1)`.
- Route: `cubic-bezier(0.16, 1, 0.3, 1)`.
- Ceremony: `cubic-bezier(0.34, 1.2, 0.64, 1)` for contained objects only.
- Reduced: linear or immediate semantic settlement; never spatial travel.

## 4. Distance and scale limits

Ordinary controls stay within 4 px and 1.5 percent scale. State reconciliation stays within 10 px. List/layout movement is owned by Motion layout measurement and capped by the actual destination. Route travel is capped at 22 px. Ceremony children may travel up to 36 px inside their local host. Ambient parallax is clamped to 8 px and is disabled for coarse pointers, keyboard modality, hidden documents, offscreen hosts, and resolved reduced motion.

## 5. Full, gentle, and reduced variants

Full mode retains complete hierarchy and restrained secondary motion. Gentle mode shortens travel, removes most stagger, and lowers ambient amplitude. Reduced mode preserves the same state order, text, focus, controls, announcements, and authoritative result while using immediate or opacity-only reconciliation. Browser reduced motion remains the upper bound and cannot be overridden by the product setting.

## 6. Route transition contract

`ProductShell` remains the persistent shell owner. Motion owns the keyed route-content layer; it does not own business state. Navigation occurs once through the existing Next link/router. The outgoing route remains only for bounded presence/shared-layout handoff. Errors render inside the shell. Back/forward uses the shorter route variant and never replays success or arrival one-shots.

## 7. Focus handoff contract

After a committed pathname change, focus moves exactly once to `[data-route-focus]`, the destination `h1`, or the route content fallback. Focus is not stolen while the user is actively typing. Dialogs trap focus and restore the connected trigger. Shared-layout and decorative clones are `aria-hidden`. Reduced motion uses the same immediate focus decision.

## 8. Authoritative mutation transition contract

The common state family is `idle | pending | slow | success | recoverable-error | terminal-error | cancelled`. A unique operation identity and `AbortController` own each request. Pending disables duplicate submission. Slow state is timer-derived and never fake progress. Success begins only after a successful response. Failure restores the correct prior controls and focus. Stale, aborted, or unmounted responses cannot commit presentation state.

## 9. Polling-delta animation contract

Polling consumers derive a stable semantic version from authoritative row identities and presentation-relevant fields. Duplicate or out-of-order versions are ignored. Unchanged rows retain object identity and do not re-enter. Added, removed, changed, or regrouped rows alone receive layout/presence work. Server-confirmation time may update without replaying card or badge motion.

## 10. List identity strategy

Player cards use playthrough ID. Captain voyage cards use playthrough ID. Invitations use invitation ID. Crew use durable member ID where available and a stable composite fallback only for read-only rosters. Studio blocks, chapters, assets, tales, and versions use their persisted IDs. Array index is never an animation identity.

## 11. Shared-layout identity strategy

Layout IDs are namespaced by surface and durable object identity. The role gateway and destination sign-in relic share one role-scoped ID. Player/Captain cards use route-stable playthrough IDs. Active navigation uses one workspace-scoped plate. No two simultaneously mounted objects may claim the same layout ID unless they are the intentional outgoing/incoming pair inside the shared root layout group.

## 12. Invitation ceremony state chart

`resolving -> valid -> pin-required -> pin-validating -> accepting -> accepted -> waiting-room` is the success path. `valid -> declining -> declined` is the decline path. `account-required`, `invalid`, `expired`, `revoked`, `replacing`, `replaced`, and `failed` are readable branches with explicit recovery. Seal fracture, ribbon release, and title emergence start only after acceptance succeeds. PIN values never enter logs, labels, keys, telemetry, or DOM data attributes.

## 13. Waiting-room state chart

`connecting -> live | polling -> reconciling -> live` is recoverable connectivity. `scheduled -> launch-ready -> releasing -> journal` is authoritative launch. `revoked` is terminal and cannot enter a reconnect loop. Crew arrival and readiness use roster/version deltas. Launch is one-shot per authoritative launch version and shares the existing Player journal handoff rather than creating another progression host.

## 14. Authentication state charts

Player supports account and invitation modes with preserved inputs and deliberate focus. Captain and Creator share request logic but use distinct relics, success copy, color/material state, and route destinations. `idle -> pending -> slow -> accepted -> route` is successful. Invalid credentials, invalid invitation, permission mismatch, rate limit, offline, route failure, abort, and unmount each settle to a distinct semantic outcome without success flash or snapback.

## 15. Library card state charts

Player cards support invitation, waiting, active, completed, new-edition, server-confirmed, pinned, and hidden outcomes. Captain cards support needs-attention, active, ready, completed, launch-pending, launched, and failed launch. Preference/invitation/launch presentation follows server authority. Unchanged polling never replays entrances or badges.

## 16. New Voyage wizard transition contract

The wizard states are `closed | opening | tale-selection | voyage-details | crew | invitation-options | schedule | review | submitting | validation-failed | creation-failed | created | closing`. Forward/back direction is consistent, fields persist across validation failure, duplicate submit is blocked, created invitation results remain mounted until explicit close, and the original trigger regains focus.

## 17. Quartermaster command presentation contract

The existing Phase 2/3 command host remains authoritative. Motion owns confirmation/dialog/list layout. GSAP owns only the invocation-local command ceremony. Preflight names the exact command, target, consequence, expected sequence, and undo scope. Failure returns to the pre-command pose and unlocks controls without a receipt. Success exposes the authoritative event/action identity, sequence, and resulting state before dashboard reconciliation. Conflicting commands are explicitly rejected or serialized.

## 18. Studio ownership map

| Surface                                                         | Owner                                          |
| --------------------------------------------------------------- | ---------------------------------------------- |
| Drag transform and sortable geometry                            | dnd-kit                                        |
| Post-drop list settlement                                       | Motion wrapper below dnd-kit node              |
| Inspector, validation, lists, section and dialog presence       | Motion                                         |
| Publish/version ceremony                                        | bounded local GSAP child in a Studio SceneHost |
| Materials and low-cost status seams                             | CSS                                            |
| Authoritative draft, save, publish, upload, and immutable state | React/server responses                         |

## 19. dnd-kit and Motion wrapper pattern

The dnd-kit node carries `data-dnd-transform-owner` and receives the drag transform. Its child Motion wrapper carries `data-post-drop-layout-wrapper`; layout animation is disabled while dragging and enabled only after drop. A separate `DragOverlay` provides paper weight. Cancellation restores authoritative order and announces the result.

## 20. Rive fallback and Phase 5 handoff

Phase 4 defines stable state names for Invitation Seal, Journal Clasp, and Compass/role objects. Current visuals are labeled SVG/CSS fallbacks with real text outside the decorative tree. Missing final `.riv` assets remain a Phase 5 external-asset boundary and are never reported as production Rive completion. Phase 5 may replace internals without changing triggers, state names, focus, text, route behavior, or tests.

## 21. Lottie containment policy

Lottie remains behind the existing wrapper. Ambient mounts are decorative, local, visibility-aware, mode-aware, bounded in count, and destroyed on unmount. Lottie never controls navigation or business state. Reduced mode uses the declared stable frame or static fallback.

## 22. Replay and one-shot policy

One-shot keys include a namespace, durable authority/version, and event kind. Arrival is once per tab; remembered-session badges are once per session version; invitation acceptance, waiting-room launch, publish/version, and created badges are once per authoritative result version. Mode changes and rerenders do not consume or replay keys. Presentation-only replay never repeats a mutation.

## 23. Logging and privacy policy

Logs may contain requirement IDs, scene/host/operation IDs, sanitized outcome, duration, and target counts. They may not contain invitation tokens, short codes, PINs, credentials, private story payloads, uploaded media, personal names, raw server errors, or DOM text snapshots. User-visible server failures use safe mapped copy.

## 24. OA and matrix implementation mapping

`scripts/generate_phase4_manifest.py` deterministically projects every Phase 4 matrix and OA assignment into `Development_Docs/Project_Lanternwake_Phase_4_Animation_Manifest.csv`. The manifest retains separate OA and matrix rows even where several requirements share one implementation, preventing silent consolidation. The canonical matrix and OA ledger remain the ownership sources; the manifest records implementation evidence and validation state.

## 25. Testing and checkpoint strategy

Focused unit tests cover tokens, corrupted preference/media change, async stale/abort/single-flight behavior, semantic polling deltas, one-shot keys, and route focus. Component tests cover each surface state chart and runtime cleanup. Chromium owns isolated mutations; WebKit remains read-only for accessibility/responsive coverage. The bounded visual matrix uses M1–M5 and the six required viewports only for applicable P0/P1 Phase 4 flows. Twenty-cycle lifecycle checks run once after integration. The complete repository validation sequence runs once after focused groups pass.

## 26. Implementation reconciliation

The implementation followed the frozen contracts with two narrow dependency corrections:

- the Studio publish ceremony required one new production scene contract, `studio-publish`, in the existing registry and access-scene builder; no Director, provider, or ownership-registry redesign occurred;
- OA-170 / MX-254 required authoritative offline-sequence metadata in the Player snapshot projection and Ship's Log row; the server timestamp and event sequence remain the only synchronization truth, and the client never fabricates an offline event time.

All 119 Phase 4 matrix rows and 122 Phase 4 OA rows now reference the implementation commit, actual source owners, focused tests, mode behavior, semantic checkpoints, and deterministic manifest projection. The implementation preserves the static SVG/CSS relic interfaces for Phase 5 and starts no production Rive, Lottie, or PageFlip replacement work.

## Final affected-file boundary

Shared ownership is limited to `src/animation/platform/*`, `src/components/shell/ProductShell.tsx`, the focused snapshot/log projection, the single `studio-publish` registry extension, and the Phase 4 documentation. Surface work remains limited to the named Phase 4 landing, platform, Player Library, Captain Library, invitation, waiting-room, Quartermaster, Studio, shell, and Ship's Log requirements. `AnimationDirector`, providers, ownership registries, Prisma schemas, package manifests, and lockfiles remain unchanged.
