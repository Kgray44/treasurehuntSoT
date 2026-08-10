---
title: Project Helm Phase 1 Validation Record
audience: product-engineering
status: current
canonical_for: project-helm-phase-1-validation-record
last_reviewed: 2026-08-10
---

# Project Helm Phase 1 validation record

## Current decision

**RELEASE_GO; MAINLINE ACCEPTED.** Protected pull request 31 accepted exact
candidate `71a2055cf9174cb8c854ad1424b1ecfcb7473abb` as merge
`d4991766369697584c5d2ea7cba22da903ecab8c`. The hosted mainline finalizer
recorded 37 of 37 mandatory receipts `PASSED`, 37 of 37 cleanup states `CLEAN`,
and no invalid, missing, duplicate, or unknown evidence. The accepted merge has
the validated candidate as its second parent and an identical Git tree.

## Focused implementation evidence

| Lane                                                                                 | Result                                                                    | Truth boundary                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Protected pull request 31 and mainline finalization                                  | 40/40 checks successful; `RELEASE_GO`; 37/37 passed and `CLEAN`           | Exact hosted proof for candidate `71a2055cf9174cb8c854ad1424b1ecfcb7473abb`, accepted as merge `d4991766369697584c5d2ea7cba22da903ecab8c`; evidence digest `3f3e4650d16b10216932b6a39716414f7f46fa4c80d769f5a42e9415ab7084ed`.                                                                                                                                                                                        |
| Helm service, API, component, artifact, history, Homeport, and invitation regression | 13 files, 68 tests passed                                                 | Local diagnostic proof on a task-owned SQLite database                                                                                                                                                                                                                                                                                                                                                                |
| Superseded Sounding Line contract gate                                               | `RELEASE_GO`; `unit.helm` 26/26; `component.helm` 3/3; static gate passed | Exact-source governed proof on commit `98b135a086a5d2e6283965561644f3f620f2fff4`; cleanup was `CLEAN`. The later `40d822c` mainline advance makes it retained diagnostic history, not current acceptance evidence.                                                                                                                                                                                                    |
| Helm browser diagnostic                                                              | 2/2 passed in 1.2 minutes                                                 | Task-owned port 3101 and copied SQLite database on commit `3f4ba7f8f61f69642f2878eaf0991712bfc0d6be`; the 58.3-second authority/membership journey and 10.1-second responsive/accessibility matrix both passed. This is not yet the governed shared-lane receipt.                                                                                                                                                     |
| Governed `browser.helm` receipt                                                      | 2/2 passed; `CLEAN`; 167,120 ms                                           | Exact-source governed mainline-plan suite proof on commit `a67616f710f20f4f142c84706978cb90a15dc10a`; registered, discovered, executed, and passed counts were all 2 with zero failed or skipped. The later `fca5838` mainline advance requires a final rerun.                                                                                                                                                        |
| Focused browser repair                                                               | ESLint, Prettier, and TypeScript passed                                   | The matrix uses one canonical session for desktop/tablet/phone/zoom, a fresh reduced-motion context, native keyboard focus/selection assertions, touch targets, horizontal overflow, and desktop/phone Axe checks.                                                                                                                                                                                                    |
| Superseded comprehensive gate                                                        | `EVIDENCE_INVALID`; 35/36 passed; 36/36 `CLEAN`                           | Exact-source run on `c5321056ca6a32429784c2fd4298cf28a3e8ec0d`. `browser.admiralty` alone failed because this worktree's generated Prisma client still targeted MySQL after reconciliation; SQLite regeneration and TypeScript passed, but Drydock advanced main before the focused replacement could start. Later Drydock closure, Harborlight catalog integration, and Tideglass Phase 2 are now accepted upstream. |
| Reconciled policy and TypeScript                                                     | Passed                                                                    | Current worktree is reconciled through `fca58389a5e6be7bcf1db55e252b7427eb32b2aa`; generated registry and shared policy include Helm plus all accepted Tideglass, Deepwater, One Voyage catalog, Admiralty, and Drydock changes.                                                                                                                                                                                      |
| Schema                                                                               | **NONE**                                                                  | Helm's owned diff against current main changes neither Prisma provider nor any migration                                                                                                                                                                                                                                                                                                                              |

The reconciled contract receipt recorded plan digest
`d385d8631564c5ec9b1880b11c0c06066cee6a4f2fa7cba90ac70b82c0e9b40e`
and evidence digest
`6a2b9de8b5c9d04907e0a5bec49998425f4beb2998ef8dbf23c59ac0ced5dcd9`.
The current policy validator reports 440 contracts, 7 gates, 14 owners, 56
suites, 1,880 registered cases across 51 families, two pre-existing validation
debt entries, zero policy errors, and policy digest
`0ebb765fdd373506cee7ad842cde8c0be4165a5d007b1a4ec4bff0733a23ff1d`.
The older contract result remains governed historical evidence, but it is not
the current browser receipt, final mainline gate, or integrated-SHA proof.

The `a67616f` browser receipt used mainline plan digest
`1aa5fae26d7b3da31d7d5de3e383b3d9a02d00690ea2fd64392ecd81cae6c47c`
and inventory digest
`266b7701a63e8b902edbde5e56e4076c0a0aa650ce6070eaa1f1e2ac2eadbc5d`.
The canonical database remained SHA-256
`54647911f63c6a55e5c6b6c95e5ec0a2977b4580a42de073c8c503a3d8c7a412`
before and after the governed isolated run.

## Visible product inspection

The in-app browser inspected the natural product journey on a task-owned
runtime and copied validation database:

- signed in from the public product route with one canonical account;
- entered Captain through ordinary workspace navigation;
- inspected Captain-only and Captain + Player cards and the default
  Captain-only setup choice;
- selected Captain + Player and verified both explanations remained visible;
- inspected the 390 by 844 phone layout with no horizontal document overflow;
- opened the ordinary Player Journal route and verified no Captain Console or
  Open Captain control appeared in the Player perspective;
- observed no console errors on the changed Captain or Player surfaces; and
- stopped the exact task-owned runtime, closed its tabs, and verified its port
  was free.

The browser controller did not change the native radio with its synthetic
ArrowRight action. The governed Playwright keyboard assertion remains the
deciding evidence because it sends a native browser key event and asserts both
selection and focus.

## Security and privacy coverage

The focused test set proves the four authority/membership states, independent
membership removal and Captain revocation, canonical same-account identity,
CSRF, rate limiting, stale-state denial, malformed mode denial, IDOR-safe
authorization, closed-membership handling, pre-launch reuse, blocked
post-launch rejoin, late joining, event-time artifact eligibility,
membership-bounded personal history, and equivalent Player DTO shapes for an
ordinary Player and a participating Captain.

Negative projection assertions cover Captain instructions and commands,
unreleased hints and progression, audit and raw evidence, account and provider
identity, session/security data, private Player material, and Creator draft
information. Synthetic fixture values use reserved invalid domains and contain
no real private Chronicle content.

## Isolation and retained warnings

- The canonical development database SHA-256 remained
  `54647911f63c6a55e5c6b6c95e5ec0a2977b4580a42de073c8c503a3d8c7a412`
  through focused validation.
- All mutating test and browser work used copied task-owned SQLite databases.
- Port 3100 is a shared governed lease and is never preempted by Helm.
- The Player Journal visibly contains pre-existing misencoded decorative dash
  glyphs around page numbers. Helm does not own or correct that unrelated
  presentation defect, and no acceptance claim conceals it.
- Local, synthetic, copied-database, and in-app browser evidence is not
  deployment, production, live-provider, physical-device, or owner-acceptance
  proof.

## Accepted mainline state

- Protected pull request 31 merged exact candidate `71a2055c` as `d4991766`.
- Sounding Line plan digest:
  `9a951190d9abb35b7df4d406d1036abfc197410eae112c3519c2ea2c40685652`.
- Sounding Line evidence digest:
  `3f3e4650d16b10216932b6a39716414f7f46fa4c80d769f5a42e9415ab7084ed`.
- The accepted merge tree exactly matches the validated candidate tree.
- Helm adds no Prisma schema change, migration, backfill, or data rewrite.

Helm Phase 2, **Read the Deck**, has not started and is not authorized by this
record.
