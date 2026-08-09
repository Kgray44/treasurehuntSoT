---
title: Project Helm Phase 1 Validation Record
audience: product-engineering
status: current
canonical_for: project-helm-phase-1-validation-record
last_reviewed: 2026-08-09
---

# Project Helm Phase 1 validation record

## Current decision

**VALIDATION IN PROGRESS.** The Phase 1 implementation, focused service and
contract proof, and visible product inspection are complete on the owned Helm
branch. The repaired responsive/accessibility browser matrix, current-main
reconciliation, exact-candidate Sounding Line gate, protected integration,
integrated-SHA proof, and remote parity remain required. This record does not
claim mainline acceptance.

## Focused implementation evidence

| Lane                                                                                 | Result                                                                    | Truth boundary                                                                                                                                                                    |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Helm service, API, component, artifact, history, Homeport, and invitation regression | 13 files, 68 tests passed                                                 | Local diagnostic proof on a task-owned SQLite database                                                                                                                            |
| Sounding Line contract gate                                                          | `RELEASE_GO`; `unit.helm` 26/26; `component.helm` 3/3; static gate passed | Governed contract evidence before current-main reconciliation; its policy digest is invalidated by the known Sounding Line overlap on current main                                |
| Sounding Line Helm browser journey                                                   | Signature Captain/Player journey passed twice; responsive matrix remained time-bounded | The first matrix attempt exposed a test-only authentication race. After repair, desktop, tablet, and phone passed before the 180-second aggregate budget expired during zoom; no product assertion failed |
| Focused browser repair                                                               | ESLint, Prettier, and TypeScript passed                                   | The matrix authenticates once, reuses the same canonical session across isolated viewport contexts, and has a 360-second bounded budget; rerun pending the shared validation lease  |
| TypeScript                                                                           | Passed                                                                    | Static local proof before current-main reconciliation                                                                                                                             |
| Schema                                                                               | **NONE**                                                                  | Both Prisma providers were inspected; no schema or migration file changed                                                                                                         |

The pre-reconciliation contract receipt recorded policy digest
`0cdcdd66de9352fe804a65a462235d439ba4c6e5ea80c03f451c6e974646b00e`
and evidence digest
`31f660a56d94c944d9fcd60fbc2896944b08de64d1ca2c8a197b4abdf6b0c145`.
Those values remain useful provenance, not final acceptance evidence.

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

## Remaining acceptance work

1. Pass the repaired `browser.helm` journey and responsive/accessibility matrix.
2. Reconcile semantically with current `origin/main` and regenerate shared
   Sounding Line, documentation, and Feature Catalog outputs.
3. Run the exact-candidate contract and authoritative mainline gates.
4. Integrate through the protected repository path and validate the integrated
   SHA.
5. Prove advertised-remote parity and task-owned runtime cleanup.

Helm Phase 2, **Read the Deck**, has not started and is not authorized by this
record.
