---
title: Brightwork Stage 6 Creator Live Continuation Findings
audience: engineering-evidence
status: current
canonical_for: voyagewright-brightwork-stage-6-creator-live-continuation-findings
last_reviewed: 2026-09-03
---

# Brightwork Stage 6 Creator Live Continuation Findings

Status: **CREATOR LIVE COVERAGE COMPLETE — STAGE 7 ADJUDICATED**

This is a diagnosis-only continuation of the missing Creator, Studio, and
Drydock live coverage. It is source evidence for the canonical Stage 7 master
reconciliation; it does not itself authorize a Stage 8 repair.

## Scope and evidence boundary

- Audit date: 2026-08-31.
- Approved audit origin: `https://audit.absoluterelativesystems.com`.
- Audited ordinary-product commit: `e69f452a69f2a531f6fbf4a3e0cb75d204e4c922`;
  uncommitted changes in this task are audit-only fixture/runtime support.
- Historical Brightwork source baseline retained for comparison:
  `a82473c40114280694fd292f1103ae914dcc7c6c`.
- The fixture, server, database, Chronicle, and Sea Trial used here were
  synthetic and task-owned. This is not deployment, real-user, live-provider,
  owner-acceptance, or assistive-technology certification evidence.
- No ordinary product behavior was changed in response to an observation. No
  private package, provider integration, immutable Version, published release,
  or real account was created or used.

## Creator-fixture correction and acceptance

The prior persona mapped `creator` to the full-capability synthetic account.
That same account intentionally held an active Player membership for Captain
coverage. Studio correctly treats that active Player workspace lock as a reason
to withhold Creator entry, so the earlier `Permission required` outcome was an
audit-fixture conflict rather than ordinary Creator authorization evidence.

The continuation uses a dedicated synthetic Creator account with an active
Creator global role, verified active profile and email, claimed ordinary
entry, no active Player membership, and a Creator-owned private Chronicle.
The audit runtime verifies the same ordinary `workspaceCapabilityOverview()`
projection that Studio uses before issuing the persona session. It grants no
global Creator permission, weakens no Studio guard, and special-cases no
`/studio/*` route.

Fixture acceptance was observed live:

```text
/__audit/persona/creator
  -> /studio/library
  -> HTTP success; ordinary Studio shell; Brightwork Creator identity
  -> no Permission required state
```

The account menu's workspace switcher presented Creator as the current
workspace, and `/account/roles` presented Creator as available to the active
verified account with the expected `Create and publish your own Chronicles`
description. The successful ordinary Studio entry and that capability
projection are mutually consistent.

## Coverage summary

| Lane                             | Routes or surface                                               | Interaction exercised                                                                                                                                | Result                                                                                                                                             |
| -------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Creator entry and library        | `/__audit/persona/creator`, `/studio/library`                   | Redirect, account menu, search/no-match recovery, library return, Back/Forward                                                                       | Ordinary Studio entry succeeded; populated and filtered/empty library states were truthful.                                                        |
| Workspace and navigation         | `/account/roles`, Studio desktop and mobile navigation          | Opened account menu, opened All Workspaces, returned through Enter Creator, opened mobile drawer, pressed Escape                                     | Creator is current and coherent; both overlays restored focus to their invoking control.                                                           |
| Editor                           | `/studio/tales/<task-owned-id>`                                 | Created a task-owned Chronicle, opened it, added/edited Narrative content, used Guided, Detailed, and Engineering inspector modes, Ctrl+K and Escape | Autosave reported a timestamp after the edit; structured inspector and command palette operated.                                                   |
| Supporting authoring surfaces    | `settings`, `assets`, `locations`, `artifacts` tabs             | Used visible editor navigation                                                                                                                       | Identity, empty Asset Library, Waypoint, and Artifact states rendered without a false ready claim.                                                 |
| Drydock                          | `trials` tab and validation panel                               | Ran validation, opened the affected Passage, saved and ran a deterministic Sea Trial                                                                 | Blocking graph findings, source checksum, exact issue-to-editor link, source-bound receipt, and paused trace were shown.                           |
| Publishing and review            | `versions#publication-review`                                   | Opened review from the visible Publish Chronicle action                                                                                              | Immutable Version creation was disabled until exact-source Drydock verification; no publication was attempted.                                     |
| Studio Exchange                  | `/studio/exchange`                                              | Exercised empty publish validation and no-change preview-sandbox mode                                                                                | Requirement errors were explicit; preview sandbox truthfully reported no install. See `BW-LIVE-CREATOR-003`.                                       |
| Private Content                  | `/studio/private-content`, `/studio/private-content/operations` | Inspected empty import/export and protected operations deep link                                                                                     | Empty controls were disabled until a package exists; Creator received the expected Administrator access requirement for operations.                |
| Responsive, motion, and keyboard | Studio library and editor at 390 x 844                          | Mobile drawer + Escape; command palette Ctrl+K + Escape; no-overflow check                                                                           | Focus restored correctly and the mobile editor had no horizontal overflow. See the limitations for preference-driven motion and popup observation. |

The deterministic Sea Trial used only the task-owned Chronicle. It produced a
frozen receipt with one `CONTINUE` trace entry and `PAUSED` result because the
deliberately minimal Chronicle has no terminal Passage. This is a truthful
fixture-dependent simulation result, not a failed live Voyage.

## Findings

### BW-LIVE-CREATOR-001 — Dedicated Creator fixture restores ordinary Studio authorization

- Observation status: `AUDIT_ENVIRONMENT_GAP`
- Treatment class: `AUDIT_INFRASTRUCTURE`
- Severity: not product-relevant
- Route/surface: `/__audit/persona/creator` to `/studio/library`
- Exact interaction performed: Opened the synthetic Creator entry after
  preparing the corrected task-owned audit runtime.
- Observed behavior: The route redirected to the Studio Library, rendered the
  ordinary Studio shell under `Brightwork Creator`, and did not render
  `Permission required`.
- Expected behavior: A synthetic Creator must traverse the same ordinary Studio
  authorization path as a legitimate Creator account.
- Evidence: Live redirect and Studio shell observation; focused audit runtime
  and Studio authorization tests passed.
- Source corroboration: The prior full-capability fixture's active Player
  membership triggered the existing `activePlayerWorkspaceLock`; the corrected
  persona has no active Player membership and the runtime verifies the ordinary
  capability overview.
- Confidence: high
- Likely ownership: Brightwork audit fixture and audit-runtime maintenance
- Ordinary product repair authorized: no; the correction is confined to the
  synthetic fixture.
- What must NOT be changed: Studio authorization semantics, global role policy,
  Wayfarer identity architecture, or `/studio/*` route guards.
- Relationship to existing Stage 4/5/6 finding: Corroborates the preceding
  `BW-LIVE-001` attribution as an audit-environment gap; it is not a new
  ordinary product defect.

### BW-LIVE-CREATOR-002 — Legacy Creator evidence Chronicle lacks an editable draft

- Observation status: `FIXTURE_DEPENDENT`
- Treatment class: `AUDIT_INFRASTRUCTURE`
- Severity: not product-relevant
- Route/surface: `/studio/tales/brightwork-stage4b-creator-chronicle`
- Exact interaction performed: Opened the pre-seeded Creator-owned Chronicle
  through the Studio Library's visible Edit Chronicle action.
- Observed behavior: Studio showed `This Chronicle has no editable draft.`
- Expected behavior: A record intended for editor traversal needs an editable
  draft; immutable/evidence-only records may correctly lack one.
- Evidence: Live editor route and exact UI copy. A new task-owned Chronicle was
  safely created through the real Studio form and supplied the editable
  continuation surface.
- Source corroboration: not required; the record is a synthetic evidence
  fixture, and the current UI did not promise an editable draft.
- Confidence: high
- Likely ownership: Brightwork synthetic fixture maintenance
- Ordinary product repair authorized: no
- What must NOT be changed: The product's handling of a Chronicle that has no
  draft, or any real Chronicle data.
- Relationship to existing Stage 4/5/6 finding: No duplicate ordinary-product
  finding located in the current Brightwork evidence records.

### BW-LIVE-CREATOR-003 — Studio Exchange reports reduced motion when the browser preference is not reduced

- Observation status: `SOURCE_CORROBORATED`
- Treatment class: `PRODUCT_DEFECT`
- Severity: low
- Route/surface: `/studio/exchange`, Artifact preview contract
- Exact interaction performed: Opened Studio Exchange with
  `matchMedia('(prefers-reduced-motion: reduce)').matches` false, then examined
  the preview status rendered by the page.
- Observed behavior: The surface announced `Reduced motion is on. A static
poster is shown.` even though the active browser did not request reduced
  motion. Its preview omitted the interactive 3D controls as a consequence.
- Expected behavior: The status must describe the effective preference or a
  deliberate always-static policy. It must not claim the user's reduced-motion
  preference is on when it is not.
- Evidence: Live Exchange UI plus browser media-query observation.
- Source corroboration: `StudioExchangeConsole` passes `reducedMotion` as a
  hard-coded true prop to `ArtifactPreview`; the component uses that prop both
  for the status copy and whether interactive controls render.
- Confidence: high
- Likely ownership: Studio Exchange / Community Harbor experience
- Ordinary product repair authorized: no; this continuation records the issue
  only for later owner adjudication.
- What must NOT be changed: The static-poster fallback, publication validation,
  install-safety hierarchy, or genuine reduced-motion fallback while correcting
  the inaccurate effective-state reporting.
- Relationship to existing Stage 4/5/6 finding: Genuinely new in this Creator
  continuation; no duplicate located in the current Brightwork records.

### BW-LIVE-CREATOR-004 — Preview Voyage downstream presentation is not capturable in the audit browser

- Observation status: `AUDIT_ENVIRONMENT_GAP`
- Treatment class: `EVIDENCE_GAP`
- Severity: not product-relevant
- Route/surface: Creator editor Preview Voyage action
- Exact interaction performed: Invoked Preview Voyage from the task-owned
  Chronicle after its saved Narrative was available.
- Observed behavior: The initiating Studio page showed no error, but the
  in-app audit browser exposed only the parent Studio tab and no child preview
  window to inspect.
- Expected behavior: The Creator preview opens in a separate, isolated window
  without changing runtime truth.
- Evidence: Live action and task-browser tab inventory after the action.
- Source corroboration: The editor posts to its Creator-scoped preview endpoint
  and opens a returned URL with `window.open(..., '_blank', 'noopener,noreferrer')`.
- Confidence: high for the capture limitation; no conclusion about the
  downstream preview presentation.
- Likely ownership: Brightwork audit-browser evidence environment
- Ordinary product repair authorized: no
- What must NOT be changed: Isolated Preview Voyage semantics or the
  no-runtime-truth guarantee merely to make the browser capture easier.
- Relationship to existing Stage 4/5/6 finding: New evidence limitation, not a
  product finding.

### BW-LIVE-CREATOR-005 — Drydock gives source-bound, actionable refusal rather than a false publish-ready state

- Observation status: `REFERENCE_QUALITY`
- Treatment class: `REFERENCE_QUALITY_DO_NOT_REGRESS`
- Severity: not product-relevant
- Route/surface: Creator editor validation panel, Sea Trials, and Versions
- Exact interaction performed: Validated the minimal task-owned Chronicle,
  followed an affected-Passage link, ran a deterministic Sea Trial, and opened
  publication review.
- Observed behavior: Drydock identified three authoring blockers, named their
  rules, supplied issue-to-editor navigation where applicable, exposed exact
  source checksums, kept the Launch Gate at `NEEDS REPAIR`, and disabled
  immutable publication until a verified decision for that exact source.
- Expected behavior: A deliberately incomplete Chronicle should have a
  comprehensible repair path and must not be publishable.
- Evidence: Live validation panel, source-bound Sea Trial receipt and trace,
  and staged publication-review surface.
- Source corroboration: not required for this positive live observation.
- Confidence: high
- Likely ownership: Drydock and Shipwright Studio
- Ordinary product repair authorized: no action
- What must NOT be changed: Exact-source validation/release binding,
  server-authoritative publication gating, issue-to-editor traceability, or
  redacted simulation receipts.
- Relationship to existing Stage 4/5/6 finding: Reference-quality corroboration
  only; no duplicate defect.

### BW-LIVE-CREATOR-006 — Studio overlays preserve focus and mobile navigation remains structured

- Observation status: `REFERENCE_QUALITY`
- Treatment class: `REFERENCE_QUALITY_DO_NOT_REGRESS`
- Severity: not product-relevant
- Route/surface: Studio Library mobile navigation and editor command palette
- Exact interaction performed: At 390 x 844, opened the product navigation
  drawer and pressed Escape; in the editor used Ctrl+K to open the command
  palette and pressed Escape.
- Observed behavior: Each overlay exposed a labelled dialog and returned focus
  to its invoker. The mobile Studio Library retained its destinations, search,
  sort, and two Chronicle cards; the mobile editor measured 380 px document
  width in a 390 px viewport (no horizontal overflow).
- Expected behavior: Keyboard dismissal should preserve orientation and focus;
  responsive navigation should retain Creator actions without horizontal
  scrolling.
- Evidence: Live DOM accessibility snapshots, focus checks, and viewport
  measurement.
- Source corroboration: not required for this positive live observation.
- Confidence: high
- Likely ownership: Product shell and Studio experience
- Ordinary product repair authorized: no action
- What must NOT be changed: Dialog labelling, Escape handling, focus
  restoration, skip link, semantic main/navigation regions, or narrow viewport
  layout.
- Relationship to existing Stage 4/5/6 finding: Reference-quality corroboration
  only; no duplicate defect.

### BW-LIVE-CREATOR-007 — Exchange correctly blocks incomplete publication and makes no-change preview explicit

- Observation status: `REFERENCE_QUALITY`
- Treatment class: `REFERENCE_QUALITY_DO_NOT_REGRESS`
- Severity: not product-relevant
- Route/surface: `/studio/exchange`
- Exact interaction performed: Submitted an empty publication form, selected
  Preview sandbox (no changes), and opened it.
- Observed behavior: The form enumerated all five unmet requirements, including
  an immutable Version and clean package scan. Preview sandbox then stated both
  that it had opened and that no content was installed.
- Expected behavior: Incomplete releases must be rejected intelligibly, and a
  no-change mode must state its side-effect boundary.
- Evidence: Live form validation alert and preview-sandbox status messages.
- Source corroboration: not required for this positive live observation.
- Confidence: high
- Likely ownership: Studio Exchange / Community Harbor experience
- Ordinary product repair authorized: no action
- What must NOT be changed: Requirement validation, immutable-release
  prerequisite, scanner gate, attribution/licence obligations, or the
  no-install sandbox guarantee.
- Relationship to existing Stage 4/5/6 finding: Reference-quality corroboration
  only; no duplicate defect.

## Duplicate, new, and unresolved items

### Duplicate or corroborating observations

- `BW-LIVE-CREATOR-001` confirms the existing conclusion that the former
  Creator block was `AUDIT_ENVIRONMENT_GAP`, not a basis to change ordinary
  authorization.
- `BW-LIVE-CREATOR-005`, `BW-LIVE-CREATOR-006`, and
  `BW-LIVE-CREATOR-007` are reference-quality evidence. They do not create
  repair authority.

### Genuinely new observation

- `BW-LIVE-CREATOR-003` is the one source-correlated ordinary-product finding:
  Studio Exchange hard-codes a reduced-motion state and consequently gives
  inaccurate status copy when the browser preference is not reduced.

### Unresolved or needs-corroboration items

- `BW-LIVE-CREATOR-004` leaves the child Preview Voyage presentation
  unobserved because the audit browser did not expose the window opened by the
  product. This is an evidence gap, not a product diagnosis.
- The audit browser's keyboard Tab primitive did not advance focus from the
  document body. It is not treated as a product finding because modal Escape,
  command shortcut, focused dialog controls, and focus restoration were
  independently exercised with real keyboard events. A browser that exposes a
  normal child window and physical Tab traversal is needed for that additional
  evidence.
- Private import/export stayed in its intended no-package empty state. No real
  package was supplied, so successful import/export, provider work, and
  operations administration are intentionally outside this continuation.
- The Sea Trial remained `PAUSED` because the task-created minimal Chronicle
  lacks a terminal Passage. This is expected fixture content, not a product
  readiness claim or failed simulation implementation.

## Handoff statement

Creator authorization, Studio entry, editor behavior, Drydock, publishing
review, Exchange, Private Content, navigation, responsive behavior, and the
safe deterministic Sea Trial have been covered or explicitly attributed where
the audit environment cannot observe a downstream surface. The only ordinary
product item recorded here is `BW-LIVE-CREATOR-003`; no repair was performed.

**CREATOR LIVE COVERAGE COMPLETE**

## Stage 7 final integration

On 2026-09-03, the canonical
`Voyagewright_Brightwork_Stage_7_Master_Audit_Reconciliation.md` adjudicated
all seven Creator observations. `BW-LIVE-CREATOR-001` closes audit-only
BW-AUD-006; `BW-LIVE-CREATOR-002` remains fixture-only;
`BW-LIVE-CREATOR-003` merges into BW-M-020 as additional source/root-cause
evidence rather than creating a duplicate Exchange finding;
`BW-LIVE-CREATOR-004` remains an audit-browser evidence limitation; and
`BW-LIVE-CREATOR-005` through `BW-LIVE-CREATOR-007` become the reference
contracts BW-REF-013 through BW-REF-015. Stage 7 is frozen as `FINAL`.
