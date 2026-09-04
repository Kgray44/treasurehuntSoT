---
title: Voyagewright Brightwork Stage 7 Master Audit Reconciliation
audience: engineering-evidence
status: final
canonical_for: voyagewright-brightwork-stage-7-master-audit-reconciliation
last_reviewed: 2026-09-03
---

# Voyagewright Brightwork — Stage 7

## Master Audit Reconciliation and Repair-Authority Ledger

**Audit date:** 2026-08-31
**Final reconciliation date:** 2026-09-03
**Stage state:** `STAGE 7 FINAL`
**Mode:** Finding adjudication, deduplication, source corroboration, reclassification, and repair-authority freeze
**Product repairs performed:** None
**Raw audit/decision rows considered:** 140 (12 Stage 4 source-forensic + 51 Stage 5 Pass 1 + 56 Stage 5 Pass 2 + 14 corrected Stage 6 live observations + 7 Creator live-continuation observations)
**Master product findings:** 41
**Pending product-attribution findings:** 2
**Audit/evidence actions:** 8 (7 open; BW-AUD-006 closed as an audit-environment correction)
**Explicit retired/withdrawn findings:** 8
**Reference-quality protection contracts:** 15
**Creator live lane:** COMPLETE; all seven continuation observations adjudicated below

> **Stage 7 governing rule:** An audit observation is evidence, not repair authority. A finding may authorize ordinary product repair only after its attribution survives newer evidence, source truth, fixture intent, and conflicting audits.

## 1. Executive verdict

Stage 7 confirms that Brightwork found many real defects and polish opportunities, but it also found several things that **must not be repaired as product defects**. The biggest corrections are not cosmetic bookkeeping; they materially change the Stage 8 repair plan.

The old Captain and Studio “READY unavailable” findings were evidence-fixture failures already corrected by Stage 4B. Bridgewatch behaved correctly by denying a synthetic auditor that had not been granted access. The Stage 6 Captain/Player lifecycle contradiction was produced by the Brightwork route-representative fixture itself: it seeds an ACTIVE/launched Voyage without a current block, while the preview component uses “The voyage has not launched” as a fallback for a missing block. The incomplete historical record similarly comes from intentionally minimal synthetic route evidence and demonstrates a good product behavior: Voyagewright refuses to fabricate history it does not possess.

Stage 7 also overturns the Stage 5 claim that the Community Harbor home is simply “unimplemented.” Current source contains the full Community Harbor experience and Stage 6 interacted with the real shelves/search. The blank READY capture is an evidence/capture/presentation anomaly and must be recaptured, not “fixed” by building a second Community home. The Featured route likewise already has a complete populated/empty-state implementation.

Conversely, several findings become _stronger_ after reconciliation. Journal/Captain mojibake is source-corroborated. Passport count disagreement is now source-explained as inconsistent lazy history materialization rather than ambiguous wording. Admiralty Configuration is indisputably read-only. Passport material drift is traceable to token lineage. Studio Exchange/Private Content rawness is structural in their components. These survive into the repair-authority ledger.

The Creator continuation completed the former live-coverage gate with a dedicated, task-owned Creator account. Its sole ordinary-product observation does not create a new route-specific ticket: the Studio Exchange motion status hard-codes reduced motion and is additional live/source evidence for the existing cross-surface effective-motion defect in BW-M-020. The remaining Creator observations either close an audit-fixture gap, remain an evidence limitation, or strengthen reference-quality contracts.

The result is a safer repair campaign: fix what is actually wrong, preserve what is already excellent, and refuse to let a synthetic fixture bully the product into unnecessary surgery.

## 2. Evidence precedence used by Stage 7

When sources conflict, Stage 7 uses this order:

1. **Current product/source semantics and governing ownership**, especially when a finding makes a claim about what code actually does.
2. **Newer corrected evidence**, including Stage 4B fixture corrections and the corrected Stage 6 attribution review.
3. **Independent cross-audit corroboration** across source, screenshot, and live behavior.
4. **Owner clarification** for environment/configuration facts the audit cannot infer, such as Bridgewatch intentionally not being granted to the synthetic auditor.
5. **Older evidence**, retained for traceability but superseded when a later source proves its attribution wrong.

No repair is authorized merely because an older finding has a high severity label.

## 3. Stage 7 source adjudication notes

Stage 7 performed targeted current-source review for the ambiguous findings most likely to cause harmful repairs:

- `scripts/brightwork/prepare-fixture.mjs` seeds `brightwork-stage4b-captain-voyage` as `ACTIVE` with `launchedAt` and `startedAt`, but does not seed `currentChapterId` or `currentBlockId`.
- `PlayerSafePreview.tsx` uses a missing chapter/block as the fallback condition for the literal text **“The voyage has not launched”** / **“The journal remains closed.”**
- `getTaleSessionState()` derives preview chapter/block from `session.currentBlockId`. This proves BW-LIVE-006 was observing an internally incomplete synthetic route representative, not a coherent normal lifecycle state.
- `/api/passport/voyages` runs `materializeChronicleHistory()` before querying the archive, while `passportOverview()` and Personal Harbor summary count currently materialized rows directly. This explains BW-LIVE-007's 1→2 count change and confirms a real refresh-consistency issue.
- The Brightwork fixture creates deliberately bounded route-representative history rows without full chapter/choice/crew evidence, explaining BW-LIVE-008. The product's warning behavior is correct and must be preserved.
- `/community` has a complete `CommunityPageFrame`, discovery browser, shelves, designed zero-content state, and district directory. `/community/featured` renders a full `PublicCommunitySection` with a designed empty state. Therefore the old “surface is unimplemented” attribution is false.
- `/admin/configuration` explicitly says **Values cannot be changed here** / **No mutation surface**, confirming the Admiralty manageability gap.
- The Creator continuation fixture uses a dedicated verified synthetic account with an active Creator role, no active Player membership, and a Creator-owned private Chronicle. The prior full-capability account had an intentional active Player workspace lock, so its Studio denial was a fixture conflict rather than ordinary authorization evidence.
- `StudioExchangeConsole.tsx` passes the bare `reducedMotion` prop to `ArtifactPreview`; in JSX this evaluates to `true`. That source fact corroborates the Creator observation that Studio Exchange announces the static reduced-motion state while `matchMedia('(prefers-reduced-motion: reduce)')` is false.

### 3.1 Creator continuation adjudication

| Creator source ID   | Stage 7 disposition                                                 | Precedence and deduplication decision                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BW-LIVE-CREATOR-001 | `BW-AUD-006` closed as `AUDIT_ENVIRONMENT_GAP_RESOLVED`             | Newer corrected fixture evidence proves the former Creator denial was an intentional Player-workspace conflict in the synthetic account, not a product authorization failure. |
| BW-LIVE-CREATOR-002 | Fixture-only; retained in source reconciliation with no master item | The legacy evidence Chronicle lacked an editable draft, and the product made no contrary promise. No ordinary behavior or data is authorized to change.                       |
| BW-LIVE-CREATOR-003 | Merged into existing `BW-M-020`; no new master finding              | Independent live observation plus current source explains a second manifestation of the same effective-motion-state defect.                                                   |
| BW-LIVE-CREATOR-004 | Evidence limitation; no product finding or repair authority         | The audit browser did not expose the child window opened by Preview Voyage. The initiating surface reported no error, so downstream presentation remains unobserved.          |
| BW-LIVE-CREATOR-005 | `BW-REF-013`                                                        | Positive live evidence protects source-bound Drydock validation, exact-source publication gating, and receipt traceability.                                                   |
| BW-LIVE-CREATOR-006 | `BW-REF-014`                                                        | Positive live evidence protects labelled overlays, Escape/focus restoration, semantic regions, and narrow-viewport Studio navigation.                                         |
| BW-LIVE-CREATOR-007 | `BW-REF-015`                                                        | Positive live evidence protects Exchange requirement validation and the explicit no-install Preview sandbox contract.                                                         |

## 4. Master product repair ledger

Only findings in this section are ordinary product repair candidates. `PRODUCT_DECISION_REQUIRED` entries require a product-contract decision before implementation.

### BW-M-001 — Theme applicability and truthful Light-mode support

- **Status:** `CONFIRMED_CROSS_AUDIT`
- **Severity:** **P1**
- **Treatment:** `SYSTEMIC_PRODUCT_CONTRACT`
- **Route/surface:** All theme-applicable routes
- **Source finding IDs:** BW-VIS-001; BW-VIS2-010
- **Why it survives Stage 7:** Stage 5 measured 197 of 230 matched DARK/LIGHT pairs as byte-identical, and Pass 2 confirms that Stage 4B changed evidence rather than product CSS. The earlier Stage 4 positive statement that the dark/light visual system was coherent is therefore overruled.
- **Repair objective:** For each product family, either materially realize Light mode or explicitly mark intentionally immersive/theme-locked surfaces as not Light-applicable. Recompute applicability and paired evidence after repair.
- **Must NOT change:** Do not brighten or flatten intentionally immersive dark-only surfaces merely to make screenshots differ. Existing dark visual identity is not the defect.
- **Acceptance proof:** A source-bound applicability registry plus representative paired captures showing meaningful Light-mode treatment where promised, and truthful theme-lock declarations elsewhere.

### BW-M-002 — Cross-generation visual-family drift and weak semantic token lineage

- **Status:** `SOURCE_CORROBORATED`
- **Severity:** **P1**
- **Treatment:** `SYSTEMIC_VISUAL_GOVERNANCE`
- **Route/surface:** Multiple product families
- **Source finding IDs:** BW-VIS2-001; BW-VIS2-002; BW-VIS2-009; BW-VIS2-012; BW-VIS2-013; BW-VIS2-014
- **Why it survives Stage 7:** Pass 2 traced newer surfaces to undefined or one-off variables, literal fallbacks, phase-appended CSS, inconsistent width/radius/shadow patterns, and visual age cohorts that correspond to implementation era rather than product family.
- **Repair objective:** Freeze semantic family tokens and reference implementations for surface, elevated surface, border, shadow, control, accent, width class, and workflow primitives. Newer siblings should converge toward the strongest established sibling, not toward a new generic system.
- **Must NOT change:** Do not refactor working reference pages merely for code cleanliness. The goal is lineage and consistency, not a whole-site repaint.
- **Acceptance proof:** Reference registry exists; representative newer siblings consume family primitives; no unexplained literal fallback creates a second visual generation.

### BW-M-003 — Implementation language, raw enums, and provenance dominate ordinary user copy

- **Status:** `CONFIRMED_CROSS_AUDIT`
- **Severity:** **P1**
- **Treatment:** `PRODUCT_POLISH`
- **Route/surface:** Passport, Captain, Admiralty, Community, Player and other ordinary surfaces
- **Source finding IDs:** BW-VIS-003; BW-VIS-032; BW-VIS-035; BW-VIS-038; BW-VIS-043; BW-VIS-053; BW-VIS-054; BW-VIS-064; BW-VIS-065; BW-VIS-068; BW-VIS2-011; BW-VIS2-028; BW-VIS2-062
- **Why it survives Stage 7:** The same failure appears across visual evidence and source-oriented review: source-bound/projection/canonical/phase language, raw identifiers, polling mechanics, security protocol details, and raw enum/duration forms occupy primary copy.
- **Repair objective:** Lead with the human task and current meaning. Preserve exact source/provenance/IDs in expandable Technical details, tooltips, or dedicated operator diagnostics.
- **Must NOT change:** Do not delete useful provenance, source identity, audit evidence, or diagnostic precision. Demote it; do not destroy it.
- **Acceptance proof:** Primary text can be understood without project-history knowledge, while exact technical evidence remains available to advanced users/operators.

### BW-M-004 — Successful, empty, loading, error, unauthorized, and disabled states lack consistent family composition

- **Status:** `CONFIRMED_WITH_RECLASSIFICATION`
- **Severity:** **P1**
- **Treatment:** `SYSTEMIC_STATE_UX`
- **Route/surface:** Multiple route families
- **Source finding IDs:** BW4-CODEX-011; BW-VIS2-007; BW-VIS2-090; portions of BW-VIS-002
- **Why it survives Stage 7:** Visual evidence confirms inconsistent state composition. Stage 4's proposed remedy of adding route-segment error/loading files broadly is too prescriptive: component-local handling can be valid. The actual defect is experience parity, not a specific Next.js file pattern.
- **Repair objective:** Define family-level state composition contracts and expected landmarks. Use segment files, component-local states, or shared shells as appropriate.
- **Must NOT change:** Do not replace existing truthful, accessible async handling solely to satisfy an architectural fashion. Preserve retry semantics, permission clarity, and announced state changes.
- **Acceptance proof:** Representative READY/EMPTY/ERROR/UNAUTHORIZED/DISABLED states per family meet the same layout, navigation, accessibility, and recovery standard.

### BW-M-005 — Media and artwork fallbacks expose browser-failure or placeholder UI

- **Status:** `CONFIRMED_CROSS_AUDIT`
- **Severity:** **P1**
- **Treatment:** `LOCAL_REDESIGN_SHARED_PRIMITIVE`
- **Route/surface:** Profile/banner/avatar surfaces and Chronicle/library art
- **Source finding IDs:** BW-VIS-004; BW-VIS-022; BW-VIS-040; BW-VIS2-091
- **Why it survives Stage 7:** Broken banner chrome, clipped avatar alternative text, and placeholder-like Chronicle art were independently visible and later reconfirmed.
- **Repair objective:** Use authored resilient fallbacks with stable geometry, initials/illustration where appropriate, and no broken-image browser chrome.
- **Must NOT change:** Do not fabricate private/public media or imply an asset exists when it does not.
- **Acceptance proof:** Zero-media, failed-media, and slow-media fixtures keep the page visually complete and semantically truthful.

### BW-M-006 — Navigation layers and legacy return controls accumulate beyond useful hierarchy

- **Status:** `CONFIRMED_CROSS_AUDIT`
- **Severity:** **P2**
- **Treatment:** `POLISH_AND_IA`
- **Route/surface:** Ordinary app pages across product families
- **Source finding IDs:** BW-VIS-005; BW-VIS2-006; BW-VIS2-015; BW-VIS2-096
- **Why it survives Stage 7:** Global header, product navigation, inner tabs, loose contextual links, Return Home controls, and legacy onward links sometimes duplicate one another.
- **Repair objective:** Keep one navigation authority per semantic level; contain contextual utilities in governed action/navigation components; retain redundant recovery only where it helps standalone/error flows.
- **Must NOT change:** Do not remove deep-link recovery, breadcrumbs, or useful return paths just to reduce link count.
- **Acceptance proof:** Every ordinary destination remains discoverable and escapable without duplicate navigation chrome competing for attention.

### BW-M-007 — Mobile navigation and dense desktop structures do not recompose aggressively enough

- **Status:** `CONFIRMED_CROSS_AUDIT`
- **Severity:** **P1**
- **Treatment:** `RESPONSIVE_LOCAL_REDESIGN`
- **Route/surface:** Passport, Personal Harbor, Admiralty and other dense mobile pages
- **Source finding IDs:** BW-VIS-006; BW-VIS-007; BW-VIS-034; BW-VIS-091; BW-VIS-092; BW-VIS2-030
- **Why it survives Stage 7:** Long tab rows clip, duplicate navigation consumes scarce height, and desktop card/table systems become long narrow stacks.
- **Repair objective:** Use context-aware selectors/scrollers, progressive disclosure, compact status summaries, sticky task controls where useful, and mobile-specific record composition.
- **Must NOT change:** Preserve desktop information density where it works and preserve the Voyage-detail sticky section-navigation interaction contract.
- **Acceptance proof:** 390px-class captures show no inaccessible tabs, clipped controls, hidden destinations, or needlessly enormous duplicate directories.

### BW-M-008 — User-visible mojibake and encoding corruption

- **Status:** `SOURCE_CORROBORATED`
- **Severity:** **P1**
- **Treatment:** `PRODUCT_DEFECT`
- **Route/surface:** Player Journal and Captain operational surfaces; repository-wide scan target
- **Source finding IDs:** BW-VIS-041; BW-VIS2-008; BW-VIS2-064; BW-VIS2-093; BW-LIVE-003
- **Why it survives Stage 7:** The defect appears in screenshots, live interaction, and literal source strings such as `Â·`; this is not a browser-only artifact.
- **Repair objective:** Correct source encoding/literals and add a repository-wide user-visible text-integrity scan for replacement characters/common mojibake sequences.
- **Must NOT change:** Do not redesign the Journal or Captain material system. This is text integrity, not a visual-language failure.
- **Acceptance proof:** No known mojibake sequences in user-facing source or live surfaces; focused regression assertions cover affected strings.

### BW-M-009 — Personal Harbor and Chronicle Passport are structurally mixed and duplicate navigation

- **Status:** `CONFIRMED_CROSS_AUDIT_OWNER_ALIGNED`
- **Severity:** **P1**
- **Treatment:** `PRODUCT_INFORMATION_ARCHITECTURE`
- **Route/surface:** /account and Chronicle Passport entry
- **Source finding IDs:** BW-VIS-020; BW-VIS-021; BW-VIS-091; BW-VIS2-029; BW-VIS2-092
- **Why it survives Stage 7:** Both passes converge on the same root problem: an account/settings control center also embeds the archive product tree, while a second card directory duplicates the sidebar.
- **Repair objective:** Make Chronicle Passport a first-class personal destination with one concise gateway/summary from Personal Harbor. Keep Personal Harbor focused on account, identity, privacy, preferences, security, support and data management.
- **Must NOT change:** Preserve the explicit distinction between public Profile and private Chronicle Passport, and preserve unsaved-edit/destructive-action safeguards.
- **Acceptance proof:** Desktop/mobile navigation has one clear account/settings structure and one clear Passport entry, with no duplicated full destination directory.

### BW-M-010 — Personal Harbor action hierarchy is too flat

- **Status:** `CONFIRMED_VISUAL`
- **Severity:** **P2**
- **Treatment:** `POLISH_ONLY`
- **Route/surface:** /account overview and related cards
- **Source finding IDs:** BW-VIS-023
- **Why it survives Stage 7:** Several actions share equal visual weight, obscuring the primary task.
- **Repair objective:** Choose contextual primary actions and demote secondary navigation/actions to links or menus.
- **Must NOT change:** Do not hide essential account/security actions or make destructive actions easier to trigger.
- **Acceptance proof:** Each overview section has an obvious primary next action without losing access to secondary tasks.

### BW-M-011 — Chronicle Passport introduction has localized contrast problems

- **Status:** `CONFIRMED_VISUAL`
- **Severity:** **P1**
- **Treatment:** `POLISH_ONLY`
- **Route/surface:** /passport
- **Source finding IDs:** BW-VIS-030
- **Why it survives Stage 7:** The warm parchment introduction contains low-contrast light text in captured states.
- **Repair objective:** Rebalance foreground tokens while preserving parchment identity.
- **Must NOT change:** Do not replace the distinctive Passport parchment/archival presentation.
- **Acceptance proof:** Text meets contrast requirements in supported themes without visually flattening the Passport hero.

### BW-M-012 — New Passport insight surfaces drift from the established teal/brass archive material family

- **Status:** `SOURCE_CORROBORATED`
- **Severity:** **P1**
- **Treatment:** `LOCAL_REDESIGN`
- **Route/surface:** /passport/timeline, /passport/people, /passport/statistics, /passport/voyage-atlas
- **Source finding IDs:** BW-VIS-031 (part); BW-VIS2-020; BW-VIS2-021; BW-VIS2-025
- **Why it survives Stage 7:** Pass 2 traces the cooler gray surfaces to `var(--harbor-panel, #18212b)` where the established family does not define `--harbor-panel`, plus local border/radius/shadow choices.
- **Repair objective:** Route insight surfaces through canonical Passport semantic materials and editorial/archive hierarchy.
- **Must NOT change:** Do not redesign the strong Your Voyages/Voyage Detail family; it is the reference to converge toward.
- **Acceptance proof:** Side-by-side sibling review no longer reveals a distinct Wakebook-Phase-3 visual generation.

### BW-M-013 — Passport insight pages duplicate navigation and page titles

- **Status:** `SOURCE_CORROBORATED`
- **Severity:** **P1**
- **Treatment:** `LOCAL_REDESIGN`
- **Route/surface:** Passport Timeline, People, Statistics and Atlas
- **Source finding IDs:** BW-VIS-031; BW-VIS2-022; BW-VIS2-023; BW-VIS2-024
- **Why it survives Stage 7:** A second Archive Views tab bar and repeated inner H2s make the pages feel like an application nested inside Passport.
- **Repair objective:** Use one Passport navigation authority and one route title; keep only genuinely lower-level subnavigation.
- **Must NOT change:** Do not remove useful long-page Voyage-detail section navigation, which serves a different semantic level.
- **Acceptance proof:** No duplicate destination title/tab layer remains; focus/selected states stay clear.

### BW-M-014 — Voyage Detail presents too many peer actions and over-promotes provenance

- **Status:** `CONFIRMED_VISUAL`
- **Severity:** **P2**
- **Treatment:** `POLISH_ONLY`
- **Route/surface:** /passport/history/[recordId]
- **Source finding IDs:** BW-VIS-033; BW-VIS-035
- **Why it survives Stage 7:** Add Memory, Artifact Cabinet, See what changed, Replay, Voyage Book, Review and provenance compete with the emotional archive flow.
- **Repair objective:** Select one or two contextual primary actions, group the rest, and collapse specialist provenance by default.
- **Must NOT change:** Do not remove Tideglass comparison, replay, Memories, artifact access, or evidence provenance.
- **Acceptance proof:** Primary reading flow is obvious while every existing capability remains reachable.

### BW-M-015 — Voyage Detail sticky section navigation needs a mobile-specific form

- **Status:** `CONFIRMED_VISUAL`
- **Severity:** **P1**
- **Treatment:** `RESPONSIVE_LOCAL_REDESIGN`
- **Route/surface:** /passport/history/[recordId] mobile
- **Source finding IDs:** BW-VIS-034; BW-VIS2-030
- **Why it survives Stage 7:** The excellent desktop sticky navigator becomes cramped/clipped on mobile.
- **Repair objective:** Use a compact section selector or clearly scrollable horizontal section rail on narrow viewports.
- **Must NOT change:** Preserve the behavior where the navigator begins in document flow, becomes sticky under the global header while scrolling, and returns naturally at the top.
- **Acceptance proof:** Every section is reachable at narrow width with visible focus/selected state and no clipped labels.

### BW-M-016 — Passport People view reads like record metadata rather than shared-history storytelling

- **Status:** `CONFIRMED_CROSS_GENERATION`
- **Severity:** **P2**
- **Treatment:** `LOCAL_REDESIGN`
- **Route/surface:** /passport/people
- **Source finding IDs:** BW-VIS-036; BW-VIS2-027
- **Why it survives Stage 7:** The page emphasizes architecture, roles and availability rather than meaningful shared Voyage context.
- **Repair objective:** Emphasize shared-voyage count, first/last journey, historical identity, safe portrait/initial treatment and remembered context; demote provenance.
- **Must NOT change:** Do not turn the private history view into a public social graph.
- **Acceptance proof:** The page remains privacy-safe while communicating why each person matters in the user's archive.

### BW-M-017 — Passport Timeline lacks a strong temporal composition

- **Status:** `CONFIRMED_CROSS_GENERATION`
- **Severity:** **P2**
- **Treatment:** `LOCAL_REDESIGN`
- **Route/surface:** /passport/timeline
- **Source finding IDs:** BW-VIS-037; BW-VIS2-026
- **Why it survives Stage 7:** The current rail/list is visually sparse and does not scale gracefully from one event to many.
- **Repair objective:** Use year/date anchors, meaningful event hierarchy and adaptive single-record/many-record composition.
- **Must NOT change:** Do not invent events or infer chronology not supported by historical evidence.
- **Acceptance proof:** Small and large synthetic histories both look intentional and chronological.

### BW-M-018 — Passport Voyage Atlas empty state exposes subsystem architecture

- **Status:** `CONFIRMED_CROSS_AUDIT`
- **Severity:** **P2**
- **Treatment:** `LOCAL_REDESIGN`
- **Route/surface:** /passport/voyage-atlas
- **Source finding IDs:** BW-VIS-038; BW-VIS2-028
- **Why it survives Stage 7:** The empty state names Landfall/projection boundaries instead of explaining the user's archive state.
- **Repair objective:** Use plain language about when journey geography will appear; move subsystem provenance to technical details.
- **Must NOT change:** Do not fabricate map/location history when none is safely preserved.
- **Acceptance proof:** Empty state is designed, useful and privacy-safe without internal subsystem jargon.

### BW-M-019 — Passport summary counts can change only after entering the archive

- **Status:** `SOURCE_CORROBORATED_STAGE7`
- **Severity:** **P2**
- **Treatment:** `DATA_FRESHNESS_CONSISTENCY`
- **Route/surface:** /passport, /passport/history, /account
- **Source finding IDs:** BW-LIVE-007
- **Why it survives Stage 7:** Stage 7 source review resolves the ambiguity. Passport/Homeport summaries count currently materialized `PlayerChronicleRecord` rows, while `/api/passport/voyages` performs `materializeChronicleHistory(...)` before counting. Thus a visit to the archive can create/update records and make the count jump. This is not a unique-Chronicle-versus-Voyage semantic difference.
- **Repair objective:** Make summary counts refresh/materialize consistently, or expose a clear freshness/update contract so neighboring pages cannot disagree during one session.
- **Must NOT change:** Do not change the underlying durable-history ownership or double-count invitations as played Voyages.
- **Acceptance proof:** Opening Passport, archive, and Personal Harbor in either order yields consistent counts after the same authoritative refresh boundary.

### BW-M-020 — Effective motion state can report success while reverting or falsely reporting Motion

- **Status:** `SOURCE_CORROBORATED_CROSS_SURFACE_PRODUCT_FINDING`
- **Severity:** **P1**
- **Treatment:** `PRODUCT_DEFECT`
- **Route/surface:** /account/accessibility; /studio/exchange artifact preview
- **Source finding IDs:** BW-LIVE-002; BW-LIVE-CREATOR-003
- **Why it survives Stage 7:** The accessibility control announced success, immediately rehydrated from Reduced to Follow system, and remained reverted after reload. Independently, Studio Exchange announced reduced motion while the browser preference was not reduced; current source shows its bare `reducedMotion` prop always evaluates true. These are distinct manifestations of an incorrect effective-motion-state contract, not separate route findings.
- **Repair objective:** Trace preference mutation, persistence, revalidation, and effective-state propagation. Persist/apply the requested account value (or retain it with truthful failure feedback), and derive Exchange preview state from the actual effective preference rather than a hard-coded true value.
- **Must NOT change:** Preserve browser/OS reduced-motion authority, the static-poster fallback, and genuine reduced-motion behavior; do not force motion against system/user preference.
- **Acceptance proof:** Change Motion, save, reload, and verify the account’s persisted/effective state. With browser reduced motion both enabled and disabled, verify that Studio Exchange reports the matching effective state and only exposes interactive 3D controls when appropriate.

### BW-M-021 — Journal parchment contrast and historical-volume treatment can obstruct reading

- **Status:** `CONFIRMED_VISUAL`
- **Severity:** **P1**
- **Treatment:** `TARGETED_POLISH`
- **Route/surface:** Player Journal
- **Source finding IDs:** BW-VIS-042
- **Why it survives Stage 7:** Captured Journal pages include low-contrast text and a large historical-volume banner that can cover content.
- **Repair objective:** Raise readable contrast and reposition/reduce the badge so it never occludes journal content.
- **Must NOT change:** Do not redesign the Journal shell, paper language, page-turn model or cinematic identity.
- **Acceptance proof:** Long/short pages, historical state and mobile/desktop captures remain readable with no overlay obstruction.

### BW-M-022 — Runtime/fallback diagnostics are too prominent inside the immersive Journal

- **Status:** `CONFIRMED_VISUAL_WITH_PROTECTION`
- **Severity:** **P2**
- **Treatment:** `POLISH_ONLY`
- **Route/surface:** Player Journal
- **Source finding IDs:** BW-VIS-043; related context from BW-LIVE-004
- **Why it survives Stage 7:** Normal immersive presentation shows implementation/fallback language that reads like diagnostics.
- **Repair objective:** Keep user-actionable failure/fallback messaging, but move non-actionable runtime diagnostics out of the primary story surface.
- **Must NOT change:** The failed-opening fallback itself is reference-quality because it keeps the Journal usable. Do not remove truthful failure communication.
- **Acceptance proof:** A user can understand actionable degradation without seeing developer-oriented runtime narration.

### BW-M-023 — Public Chronicle navigation links can concatenate visually

- **Status:** `CONFIRMED_VISUAL`
- **Severity:** **P1**
- **Treatment:** `LOCAL_DEFECT`
- **Route/surface:** /play/lantern-chart and related public Chronicle layout
- **Source finding IDs:** BW-VIS-044
- **Why it survives Stage 7:** Captured breadcrumb/return links visibly run together (`Published ChroniclesView...`).
- **Repair objective:** Correct spacing/layout and test wrapping/long labels.
- **Must NOT change:** Do not remove useful public-return navigation.
- **Acceptance proof:** Visual regression at desktop/mobile shows separated, focusable labels.

### BW-M-024 — Public Chronicle card/preview emits empty heading elements when subtitle is absent

- **Status:** `STRONG_LIVE_PRODUCT_FINDING`
- **Severity:** **P2**
- **Treatment:** `ACCESSIBILITY_AND_MARKUP_DEFECT`
- **Route/surface:** /tales and /play/hp4-lantern-coast
- **Source finding IDs:** BW-LIVE-009
- **Why it survives Stage 7:** Live heading inspection found empty H2/H3 output for absent subtitle content.
- **Repair objective:** Conditionally omit the heading or provide meaningful fallback content.
- **Must NOT change:** Do not invent a subtitle just to fill the hierarchy.
- **Acceptance proof:** Heading outline contains no empty headings across with/without subtitle fixtures.

### BW-M-025 — Route transition briefly exposes duplicate main landmarks and old/new H1s

- **Status:** `STRONG_LIVE_PRODUCT_FINDING`
- **Severity:** **P1**
- **Treatment:** `ACCESSIBILITY_DEFECT`
- **Route/surface:** Community Chronicle detail → public Start Chronicle transition
- **Source finding IDs:** BW-LIVE-011
- **Why it survives Stage 7:** Timed live sampling showed both old and new `main` landmarks/H1s for roughly 250–750 ms after navigation.
- **Repair objective:** Keep visual overlap if desired, but make the inactive page inert/hidden from the accessibility tree as soon as the destination becomes active.
- **Must NOT change:** Do not remove the route-transition animation solely to solve the accessibility tree; preserve the authored motion when it can be semantically isolated.
- **Acceptance proof:** Timed accessibility-tree/DOM sampling during transition reports one active main landmark and one active page heading.

### BW-M-026 — Community discovery/search needs tighter task focus and minor card/search polish

- **Status:** `CONFIRMED_POLISH`
- **Severity:** **P2**
- **Treatment:** `POLISH_ONLY`
- **Route/surface:** Community Harbor search and district cards
- **Source finding IDs:** BW-VIS-052; BW-VIS-053; BW-LIVE-010
- **Why it survives Stage 7:** District grammar is strong, but repeated Sign in to save text clutters cards; search copy is implementation-heavy; a query that correctly finds one result still leaves all discovery shelves equally prominent.
- **Repair objective:** Compact save affordances, simplify search copy, and make active search results dominant/collapse discovery shelves or use the full-search destination.
- **Must NOT change:** Community district card/hero/search visual grammar is reference-quality. Do not redesign it wholesale.
- **Acceptance proof:** Search intent is obvious, small-result layouts stay composed, and district cards retain their established family.

### BW-M-027 — Community moderation mixes case work with infrastructure/protocol detail

- **Status:** `CONFIRMED_VISUAL_SOURCE_FORENSIC`
- **Severity:** **P2**
- **Treatment:** `INFORMATION_ARCHITECTURE`
- **Route/surface:** Community moderation
- **Source finding IDs:** BW-VIS-054
- **Why it survives Stage 7:** Moderation mixes case handling with provider health and exposes CSRF/revision mechanics.
- **Repair objective:** Keep moderators focused on cases; move infrastructure health to Admiralty and protocol mechanics to technical details.
- **Must NOT change:** Do not remove revision/CSRF protections from the implementation.
- **Acceptance proof:** Primary moderation flow can be operated without understanding transport/security implementation details.

### BW-M-028 — Community Voyage Log owner/consent/detail workflows fall out of the Community product family

- **Status:** `SOURCE_CORROBORATED`
- **Severity:** **P1**
- **Treatment:** `MAJOR_REDESIGN`
- **Route/surface:** /community/voyage-logs/owner, /community/voyage-logs/consent and related owner/detail workflow
- **Source finding IDs:** BW-VIS-055; BW-VIS2-003; BW-VIS2-005; BW-VIS2-080; BW-VIS2-081; BW-VIS2-082; BW-VIS2-083; BW-VIS2-084
- **Why it survives Stage 7:** Pass 2 confirms strong Community pages use `CommunityPageFrame` while private Voyage Log workflow pages use a generic shell and sparse composition.
- **Repair objective:** Create/use a Community workflow frame with designed draft, consent, preview, publication, owner detail and empty states.
- **Must NOT change:** Do not alter consent/privacy semantics or redesign the strong public Community districts.
- **Acceptance proof:** All Voyage Log workflow states visibly belong to Community Harbor and preserve privacy/consent boundaries.

### BW-M-029 — Community comments and Creator-response spoiler behavior are not realized coherently in the UI

- **Status:** `PRODUCT_DECISION_REQUIRED_SOURCE_CORROBORATED`
- **Severity:** **P2**
- **Treatment:** `PRODUCT_COMPLETENESS_OR_ENDPOINT_RETIREMENT`
- **Route/surface:** Community detail/review surfaces
- **Source finding IDs:** BW4-CODEX-007; BW4-CODEX-008
- **Why it survives Stage 7:** Stage 4 found comment lifecycle and creator-response/spoiler endpoints without corresponding human-facing consumers, while copy promises separately available spoiler detail.
- **Repair objective:** First confirm current Harborlight/Feature Catalog contract. If comments/responses are current product capability, expose governed contextual UI. If not, remove misleading promises and restrict/retire dormant capability rather than building UI by inertia.
- **Must NOT change:** Do not surface private/spoiler content simply because backend endpoints exist.
- **Acceptance proof:** Product copy, registered feature state, endpoints and visible interactions tell the same truth.

### BW-M-030 — Admiralty Configuration lacks governed editing for settings that are legitimately mutable

- **Status:** `CONFIRMED_OWNER_CORROBORATED`
- **Severity:** **P0**
- **Treatment:** `PRODUCT_COMPLETENESS_GAP`
- **Route/surface:** /admin/configuration
- **Source finding IDs:** BW-VIS-060; BW-VIS2-095; BW-LIVE-013; part of BW4-CODEX-012
- **Why it survives Stage 7:** Source and live UI explicitly state Values cannot be changed here / No mutation surface. This is a by-design current limitation, but it conflicts with the intended operational Admiralty product.
- **Repair objective:** Add typed, allowlisted editing for runtime-editable settings/policies/flags/safe provider settings with validation, preview, privileged confirmation, audit receipt and rollback. Keep deployment-only/immutable settings non-editable.
- **Must NOT change:** Secrets remain references, never casually readable values. Preserve capability gating, auditability and fail-closed behavior.
- **Acceptance proof:** At least representative mutable settings can be safely changed end-to-end; immutable/secret classes remain correctly non-editable.

### BW-M-031 — Admiralty Operations and Releases do not provide or clearly hand off expected operational actions

- **Status:** `CONFIRMED_CROSS_AUDIT`
- **Severity:** **P1**
- **Treatment:** `PRODUCT_COMPLETENESS_AND_HANDOFF`
- **Route/surface:** /admin/operations, /admin/releases
- **Source finding IDs:** BW-VIS-061; BW-VIS-062; BW-VIS2-095; part of BW4-CODEX-012
- **Why it survives Stage 7:** Strong command-center styling presents readiness/incidents/releases while retry/cancel/repair/deploy/promote/rollback/restart controls are absent or declared unavailable.
- **Repair objective:** Where Admiralty owns governed actions, implement them with confirmations/postconditions/receipts. Where another deployment/operations system owns them, make the handoff explicit and actionable rather than presenting a faux control room.
- **Must NOT change:** Do not duplicate business logic or deployment authority merely to populate buttons.
- **Acceptance proof:** Every visible operational state has a truthful authority boundary and either a governed action or a clear owning-system handoff.

### BW-M-032 — Admiralty's global 'read-only' language contradicts narrow governed mutations

- **Status:** `SOURCE_CORROBORATED`
- **Severity:** **P2**
- **Treatment:** `COPY_AND_AUTHORITY_TAXONOMY`
- **Route/surface:** /admin and shared Admiralty shell
- **Source finding IDs:** BW4-CODEX-006; part of BW4-CODEX-012; BW-VIS-065
- **Why it survives Stage 7:** The shell describes a read-only command center while account/session/support stations already permit narrow auditable actions.
- **Repair objective:** Describe the system as primarily observational with capability-bound governed actions; label station-specific authority clearly.
- **Must NOT change:** Do not broaden permissions to make the copy true. Fix the copy/taxonomy, not least-privilege boundaries.
- **Acceptance proof:** Operators can tell which stations are observe-only, which allow narrow actions, and what assurance/consent applies.

### BW-M-033 — Admiralty provider views are dense and weakly actionable

- **Status:** `CONFIRMED_VISUAL`
- **Severity:** **P2**
- **Treatment:** `LOCAL_REDESIGN`
- **Route/surface:** /admin/providers
- **Source finding IDs:** BW-VIS-063
- **Why it survives Stage 7:** Cards repeat many fields, raw values wrap poorly, and management affordances are limited.
- **Repair objective:** Use compact readiness/status summaries with expandable detail and governed Configure/Test/Rotate actions only where authority permits.
- **Must NOT change:** Do not expose secret values or invent actions for externally managed providers.
- **Acceptance proof:** Providers are quickly scannable on desktop/mobile; technical detail and safe management remain available.

### BW-M-034 — Admiralty navigation, overview duplication, data formatting and advanced forms need consolidation

- **Status:** `CONFIRMED_VISUAL`
- **Severity:** **P2**
- **Treatment:** `LOCAL_REDESIGN_AND_POLISH`
- **Route/surface:** Admiralty global navigation, overview, audit, investigate and dense mobile pages
- **Source finding IDs:** BW-VIS-064; BW-VIS-066; BW-VIS-067; BW-VIS-068; BW-VIS-092
- **Why it survives Stage 7:** A long flat station row, duplicate Available Stations grid, raw durations/enums, advanced identifiers and desktop-shaped records reduce scan efficiency.
- **Repair objective:** Group stations semantically; use overview space for health/attention/recent changes; humanize data; move advanced IDs to filters/details; recompose mobile records.
- **Must NOT change:** Preserve Admiralty's established command-center visual grammar and source/freshness evidence.
- **Acceptance proof:** Desktop/mobile operator walkthrough reaches all stations with less duplication and no loss of diagnostic depth.

### BW-M-035 — Studio Exchange is structurally an internal-form workflow inside a polished Studio shell

- **Status:** `SOURCE_CORROBORATED`
- **Severity:** **P1**
- **Treatment:** `MAJOR_REDESIGN`
- **Route/surface:** /studio/exchange
- **Source finding IDs:** BW-VIS-081; BW-VIS2-003; BW-VIS2-040; BW-VIS2-041; BW-VIS2-042; BW-VIS2-045
- **Why it survives Stage 7:** Pass 2 traced the raw appearance to class-light `PublicationWizard` and `InstallationReview` component structure, not a missing stylesheet.
- **Repair objective:** Rebuild as a staged Studio workflow using existing Studio panel/wizard primitives, clear validation/package state, warnings and action hierarchy.
- **Must NOT change:** Preserve current publication/install semantics and use Studio Publishing Review as the reference pattern rather than inventing a new style.
- **Acceptance proof:** Exchange feels native to Studio in desktop/mobile READY/validation/error/success states.

### BW-M-036 — Studio Private Content is functionally serious but presented as a low-level engineering form

- **Status:** `SOURCE_CORROBORATED`
- **Severity:** **P1**
- **Treatment:** `MAJOR_REDESIGN`
- **Route/surface:** /studio/private-content
- **Source finding IDs:** BW-VIS-082; BW-VIS2-003; BW-VIS2-004; BW-VIS2-043; BW-VIS2-044; BW-VIS2-045
- **Why it survives Stage 7:** Encrypted import/export/history is exposed as a thin sequence of controls, including a native file chooser, with weak workflow grouping/state consequence.
- **Repair objective:** Separate Import, Verified Export and History into authored panels/steps; use an accessible file-select/drop surface; show package/validation/progress/receipt state.
- **Must NOT change:** Preserve Sealed Hold security semantics, explicit validation and safe failure. Styling must not obscure risk/consequence.
- **Acceptance proof:** The same secure operations can be completed through a coherent Studio workflow with designed loading/error/success states.

### BW-M-037 — New Chronicle desktop form underuses available width

- **Status:** `CONFIRMED_CROSS_AUDIT`
- **Severity:** **P2**
- **Treatment:** `LOCAL_REDESIGN`
- **Route/surface:** /studio/tales/new
- **Source finding IDs:** BW-VIS-083; BW-VIS2-046
- **Why it survives Stage 7:** A styled but extremely narrow/tall parchment form creates unnecessary vertical travel on desktop.
- **Repair objective:** Group compatible fields/sections, widen the task appropriately, or use a short guided creation flow while retaining simple mobile behavior.
- **Must NOT change:** Do not turn initial Chronicle creation into a heavyweight wizard if the task can stay simple.
- **Acceptance proof:** Desktop composition uses space intentionally; mobile remains linear and accessible.

### BW-M-038 — Studio private operations suppresses explicit empty-state messaging for empty arrays

- **Status:** `SOURCE_CORROBORATED`
- **Severity:** **P2**
- **Treatment:** `LOCAL_DEFECT`
- **Route/surface:** /studio/private-content/operations
- **Source finding IDs:** BW4-CODEX-009
- **Why it survives Stage 7:** Stage 4 identifies optional `.map()`/nullish-fallback logic where an empty array is truthy, so zero records can render as blank rather than an explicit state.
- **Repair objective:** Use explicit length checks and distinguish loading, successful-zero, error and unavailable states for each operational section.
- **Must NOT change:** Do not fabricate provider/backup/repair records to fill the page.
- **Acceptance proof:** Zero-record synthetic fixtures render deliberate empty messages for all operational sections.

### BW-M-039 — Captain contextual utilities and accumulated actions need a governed hierarchy

- **Status:** `SOURCE_CORROBORATED_VISUAL`
- **Severity:** **P1**
- **Treatment:** `LOCAL_REDESIGN`
- **Route/surface:** Captain console/header and operational actions
- **Source finding IDs:** BW-VIS-071 (narrowed); BW-VIS2-061; BW-VIS2-065
- **Why it survives Stage 7:** After Stage 4B fixed READY evidence, the broad unavailability claim disappears, leaving specific plain top-right links and a crowded hierarchy of navigation/ordinary/authority/destructive actions.
- **Repair objective:** Contain utilities in the Captain header/navigation and freeze action levels for ordinary Voyage actions, authority actions and destructive actions.
- **Must NOT change:** Preserve the Captain teal/brass material system and command consequence labeling.
- **Acceptance proof:** Active-Voyage Captain walkthrough makes navigation and action risk immediately scannable.

### BW-M-040 — Captain operational status is too prose-heavy and exposes polling mechanics

- **Status:** `SOURCE_CORROBORATED_VISUAL`
- **Severity:** **P2**
- **Treatment:** `POLISH_AND_INFORMATION_DESIGN`
- **Route/surface:** Captain operational console
- **Source finding IDs:** BW-VIS2-062; BW-VIS2-063
- **Why it survives Stage 7:** Membership/presence/sync/readiness is compressed into machine-like prose and polling frequency appears in primary copy.
- **Repair objective:** Use compact status cells/badges and a live/freshness indicator; keep exact polling/audit mechanics in technical diagnostics.
- **Must NOT change:** Do not reduce the underlying operational data or hide stale/disconnected state.
- **Acceptance proof:** Crew state is scannable at a glance and exact diagnostics remain available on demand.

### BW-M-041 — Authentication family needs copy/hierarchy polish and a composed invitation error state

- **Status:** `CONFIRMED_CROSS_AUDIT`
- **Severity:** **P2**
- **Treatment:** `POLISH_AND_LOCAL_STATE_REDESIGN`
- **Route/surface:** /sign-in and auth/invitation error family
- **Source finding IDs:** BW-VIS-011; BW-VIS2-090
- **Why it survives Stage 7:** Auth material language is strong, but legacy wording, oversized unavailable-provider controls, excess card whitespace, and a comparatively raw invitation failure state weaken continuity.
- **Repair objective:** Use current user-facing language, compact unavailable providers, clear Back/Cancel semantics, and the same parchment/ceremonial state family for invitation failures.
- **Must NOT change:** Preserve the strong auth parchment identity and the invitation ceremony itself.
- **Acceptance proof:** Normal, unavailable-provider and invitation-error states read as one product family on desktop/mobile.

## 5. Pending findings — observation retained, repair NOT authorized

### BW-PEND-001 — Journal opening ceremony fails in the Stage 6 live browser

- **Source:** BW-LIVE-004
- **Status:** `NEEDS_INDEPENDENT_REPRODUCTION`
- **Why repair is blocked:** The fallback preserved usability, and the failure may be product-side, browser/runtime-specific, or synthetic-audit-specific. Stage 7 does not authorize animation repair from this observation alone.
- **Required next evidence:** Reproduce in a second supported browser/runtime against a coherent active Voyage, with ordinary and reduced-motion preferences. If confirmed, repair the opening state machine without weakening the graceful fallback.

### BW-PEND-002 — Journal Next control failed to advance from page 3 of 4 after opening fallback

- **Source:** BW-LIVE-005
- **Status:** `NEEDS_INDEPENDENT_REPRODUCTION`
- **Why repair is blocked:** The failure occurred after the opening animation had already fallen back, so it may be an independent pagination defect or a secondary recovery-state symptom.
- **Required next evidence:** Test pagination after a normal opening and after fallback. Only then change page-turn logic.

## 6. Audit/evidence infrastructure actions

These items improve Brightwork/Homeport evidence. They are **not ordinary Voyagewright product repair tickets** unless a later reproduction proves a product defect.

### BW-AUD-001 — Non-ready state coverage is narrower than the declared census

- **Source:** BW4-CODEX-001
- **Status:** `AUDIT_INFRASTRUCTURE`
- **Action:** Build an explicit state-coverage matrix with covered/exempted rationale. Do not treat screenshot count alone as proof of every declared state.

### BW-AUD-002 — READY capture semantics need expected-landmark enforcement

- **Source:** BW4-CODEX-002; BW-VIS-002; BW-VIS-070; BW-VIS-080; BW-VIS2-047; BW-VIS2-060
- **Status:** `PARTLY_RESOLVED_AUDIT_INFRASTRUCTURE`
- **Action:** Stage 4B fixed the Captain/Studio false-READY fixtures and those product findings are retired. Preserve expected READY landmarks so equivalent false positives cannot recur.

### BW-AUD-003 — Studio private operations route was excluded from the human-route evidence census

- **Source:** BW4-CODEX-003
- **Status:** `AUDIT_CLASSIFICATION_GAP`
- **Action:** Classify `/studio/private-content/operations` explicitly as a protected human-facing operator page or formally justify its exclusion; capture its permitted/empty/error states if included.

### BW-AUD-004 — Admiralty census capability metadata does not mirror station-specific source gates

- **Source:** BW4-CODEX-004
- **Status:** `AUDIT_METADATA_GAP`
- **Action:** Make audit route metadata declare the actual station capability. This is an evidence-model correction, not an authorization rewrite.

### BW-AUD-005 — Homeport no-orphan-route proof is stale relative to the Brightwork census

- **Source:** BW4-CODEX-010
- **Status:** `AUDIT_GOVERNANCE_GAP`
- **Action:** Regenerate route/control reachability evidence from the current census before asserting no-orphan status. Stage 4 itself did not prove a current unexplained product orphan.

### BW-AUD-006 — Creator synthetic audit persona lacks Creator authorization

- **Source:** BW-LIVE-001; BW-LIVE-CREATOR-001
- **Status:** `CLOSED_AUDIT_ENVIRONMENT_GAP`
- **Disposition:** The synthetic fixture now uses a dedicated verified Creator account with no active Player membership and a Creator-owned private Chronicle. The targeted diagnosis-only Studio/Drydock continuation reached ordinary Studio entry and exercised the required Creator lane.
- **Closure rule:** Preserve the dedicated persona and its capability/session invariants. Do not infer ordinary Creator access is broken, and do not change Studio authorization semantics, global-role policy, or route guards.

### BW-AUD-007 — Audit build mode and synthetic deployment/data environment are conflated in labels

- **Source:** BW-LIVE-014
- **Status:** `AUDIT_ENVIRONMENT_ONLY`
- **Action:** Improve audit metadata to distinguish production build mode from Brightwork synthetic deployment/data environment. No ordinary product repair is authorized.

### BW-AUD-008 — Stage 5 blank Community Home/Featured captures cannot authorize 'implement the page' repairs

- **Source:** BW-VIS-050; BW-VIS-051
- **Status:** `EVIDENCE_CAPTURE_ANOMALY_REQUIRES_RECERTIFICATION`
- **Action:** Current source contains a complete `CommunityPageFrame` Harbor Home with discovery shelves/directory and a Featured section with designed populated/empty states; Stage 6 live Community also rendered real shelves/search. Retire the claim that `/community` lacks an implementation. Recapture `/community` and `/community/featured` with READY landmark/visibility checks before diagnosing any remaining presentation bug.

## 7. Explicitly retired, withdrawn, or overruled audit conclusions

### BW-RET-001 — Captain/Studio READY routes are product-unavailable

- **Original source:** BW-VIS-070; BW-VIS-080; corresponding portions of BW4-CODEX-002
- **Stage 7 disposition:** `RETIRED / SUPERSEDED`
- **Reason:** Stage 4B replaced false READY-unavailable frames with role-owned synthetic records. The old frames remain valid error/fixture examples, not current READY product evidence.

### BW-RET-002 — Bridgewatch is broken/unavailable from Admiralty

- **Original source:** BW-LIVE-012
- **Stage 7 disposition:** `WITHDRAWN_AS_PRODUCT_FINDING`
- **Reason:** Bridgewatch was intentionally not granted to the synthetic auditor and correctly failed closed. Do not expose it publicly, weaken authentication, or change the link.

### BW-RET-003 — Captain and Player lifecycle projections prove a normal product state contradiction

- **Original source:** BW-LIVE-006
- **Stage 7 disposition:** `RECLASSIFIED_TO_AUDIT_FIXTURE_DEFECT`
- **Reason:** Stage 7 source review found the synthetic `brightwork-stage4b-captain-voyage` is seeded ACTIVE with `launchedAt`/`startedAt` but without `currentChapterId`/`currentBlockId`. `PlayerSafePreview` maps missing chapter/block to the fallback text 'The voyage has not launched' / 'The journal remains closed'. That contradictory state is created by the audit route-representative fixture and is not proof that ordinary product operations can produce it.

### BW-RET-004 — Incomplete synthetic historical record proves current history preservation is broken

- **Original source:** BW-LIVE-008
- **Stage 7 disposition:** `RECLASSIFIED_TO_FIXTURE_DEPENDENT / NO PRODUCT REPAIR`
- **Reason:** Brightwork explicitly seeds route-representative history with only a bounded subset of historical fields. The product correctly marks unavailable/reconciliation-needed facts instead of fabricating them. Preserve that truthful fallback behavior.

### BW-RET-005 — Rendering configuration/provider references is a P1 privacy/security defect

- **Original source:** BW4-CODEX-005
- **Stage 7 disposition:** `SECURITY_FINDING_WITHDRAWN; COPY_POLISH_MERGED`
- **Reason:** Later audit evidence explicitly treats safe secret references/effective state without secret values as a reference-quality pattern. Raw identifiers may be too technical and are covered by BW-M-003, but the reference pattern itself must not be removed as a 'leak'.

### BW-RET-006 — Dark/Light visual system is established reference quality

- **Original source:** Stage 4 REFERENCE_QUALITY statement: coherent dark/light visual system
- **Stage 7 disposition:** `OVERRULED_BY_QUANTITATIVE_STAGE5_EVIDENCE`
- **Reason:** Stage 5 measured 85.7% of matched theme pairs as byte-identical. The broad positive claim is not defensible; see BW-M-001.

### BW-RET-007 — Community Harbor primary route is functionally unimplemented/blank

- **Original source:** BW-VIS-050
- **Stage 7 disposition:** `PRODUCT_COMPLETENESS_FINDING_RETIRED`
- **Reason:** Source contains a full Community Harbor frame, discovery browser, shelves, empty state and district directory; Stage 6 live search rendered those shelves. The blank READY screenshot is an evidence/presentation-capture problem, not evidence that the page was never built.

### BW-RET-008 — Featured Community surface must be implemented/restored because it is blank

- **Original source:** BW-VIS-051
- **Stage 7 disposition:** `IMPLEMENTATION_GAP_RETIRED; CAPTURE/VISIBILITY RECHECK`
- **Reason:** `/community/featured` renders `PublicCommunitySection('featured')`, which includes a full Community frame and a designed zero-card empty state. A blank capture can still indicate a transition/visibility/capture bug, but it cannot authorize building a surface that already exists.

## 8. Reference-quality contracts — DO NOT REGRESS

### BW-REF-001 — Gateway role-selection hero and responsive stacking

- **Evidence/source:** BW-VIS-010
- **Protection rule:** Preserve composition; demote motion/replay utilities rather than redesigning the gateway.

### BW-REF-002 — Chronicle Passport Your Voyages and rich Voyage Detail family

- **Evidence/source:** BW-VIS2-031
- **Protection rule:** Deep teal, warm brass, archival rhythm and human-first history are the Passport reference.

### BW-REF-003 — Community public district hero/search/card family

- **Evidence/source:** BW-VIS-052; BW-VIS2-085
- **Protection rule:** Use this family to repair Voyage Log workflows; do not flatten the districts.

### BW-REF-004 — Invitation parchment/ribbon ceremony

- **Evidence/source:** BW-VIS-090
- **Protection rule:** Reference for emotionally important Chronicle moments.

### BW-REF-005 — Player Journal shell and graceful failed-opening fallback

- **Evidence/source:** BW-VIS-041/042/043 context; BW-LIVE-004 reference behavior
- **Protection rule:** Fix text/contrast/diagnostics without destroying the immersive shell or the usable fallback.

### BW-REF-006 — Captain teal/brass operational material and consequence labeling

- **Evidence/source:** BW-VIS2-066; Stage 6 reference behavior
- **Protection rule:** Improve composition/copy, not the base Captain material identity.

### BW-REF-007 — Studio Publishing Review staged workflow

- **Evidence/source:** BW-VIS2-048
- **Protection rule:** Reference for Exchange and Private Content workflow redesign.

### BW-REF-008 — Admiralty overview/Chartroom grammar and Support Pilot integration

- **Evidence/source:** BW-VIS2-094; Stage 4/6 reference behavior
- **Protection rule:** Preserve strong command-center visual language, least-privilege gates, evidence/freshness metadata and audited action design.

### BW-REF-009 — Account menu Escape dismissal and focus restoration

- **Evidence/source:** Stage 6 reference behavior
- **Protection rule:** Do not regress keyboard/focus behavior while changing navigation.

### BW-REF-010 — Truthful historical missing-evidence behavior

- **Evidence/source:** BW-LIVE-008 positive behavior
- **Protection rule:** Unavailable facts remain unavailable; never invent progress, choices, Captain identity or ownership.

### BW-REF-011 — Safe secret-reference pattern

- **Evidence/source:** Stage 6 reference behavior; supersedes BW4-CODEX-005 security interpretation
- **Protection rule:** Keep references/effective state available to authorized operators without exposing secret values.

### BW-REF-012 — Consent-scoped Support Access

- **Evidence/source:** Stage 6 reference behavior
- **Protection rule:** Support access remains category-scoped, assurance-gated, temporary/auditable.

### BW-REF-013 — Drydock source-bound refusal, verification, and publication gate

- **Evidence/source:** BW-LIVE-CREATOR-005
- **Protection rule:** Preserve exact-source validation/release binding, server-authoritative publication gating, issue-to-editor traceability, and redacted simulation receipts.

### BW-REF-014 — Studio overlay focus restoration and structured mobile navigation

- **Evidence/source:** BW-LIVE-CREATOR-006
- **Protection rule:** Preserve labelled dialogs, Escape handling, focus restoration, skip/main/navigation semantics, and the no-overflow narrow Studio layout.

### BW-REF-015 — Studio Exchange requirement validation and no-change preview sandbox

- **Evidence/source:** BW-LIVE-CREATOR-007
- **Protection rule:** Preserve immutable-release and scan prerequisites, explicit unmet-requirement feedback, attribution/licence obligations, and the truthful no-install sandbox guarantee.

## 9. Recommended Stage 8 repair waves

Stage 8 should not march route-by-route. That would maximize duplicate work and maximize the chance of repainting good pages while fixing a shared root.

**Wave 0 — Evidence safety before repair validation.** Maintain the corrected Creator synthetic persona, then address route/capability metadata, state-coverage ledger, Community blank-capture recertification, and stale Homeport reachability proof. These changes affect how later acceptance evidence is interpreted, not ordinary product UX.

**Wave 1 — Truth, accessibility, and data integrity.** Fix mojibake, accessibility preference persistence, duplicate transition landmarks, empty headings, public link concatenation, explicit successful-zero Studio operations states, and state-composition parity. These are high-confidence defects with small visual-architecture risk.

**Wave 2 — Systemic visual governance.** Establish product-family semantic tokens/reference registry, resilient media fallback primitives, navigation-level rules, responsive/mobile recomposition rules, and human-first technical-detail patterns. Do this before redesigning individual raw pages.

**Wave 3 — Personal Harbor and Chronicle Passport.** Separate Passport from account/settings IA, converge Timeline/People/Statistics/Atlas onto the established archive material family, remove duplicate navigation/titles, improve archive content design, keep the desktop sticky Voyage navigator, and fix summary-count freshness.

**Wave 4 — Community and Studio raw workflows.** Converge Voyage Log workflows toward CommunityPageFrame; rebuild Studio Exchange and Private Content around the existing Publishing Review workflow language; improve new-Chronicle desktop composition. Treat comments/Creator responses only after the current product contract is confirmed.

**Wave 5 — Admiralty manageability.** Add real governed control only where Admiralty is supposed to own it; create explicit handoffs elsewhere; correct read-only taxonomy; then simplify provider/nav/data presentation. Preserve secret references, least privilege, audit receipts, source/freshness evidence, and Support Pilot.

**Wave 6 — Captain/Auth/Public polish.** Contain Captain utilities/actions, turn operational prose into scannable status, polish auth error/copy hierarchy, and finish remaining public/Journal local issues without disturbing their reference-quality material systems.

**Wave 7 — Micro-polish and whole-product continuity.** Only after structural issues are fixed should Brightwork spend time on tiny spacing, wrapping, rhythm, iconography, orphan lines, hover/focus nuance, and route-to-route density transitions.

## 10. Creator live-coverage closure

The corrected, task-owned Creator fixture completed the targeted diagnosis-only continuation. It exercised ordinary Studio entry, workspace and overlay navigation, editor mutation/autosave, Drydock issue navigation and deterministic Sea Trial, publication review, Exchange, Private Content, responsive behavior, and the relevant keyboard/focus interactions.

The continuation is now adjudicated under the same Stage 7 precedence rules:

1. `BW-LIVE-CREATOR-001` closes the fixture-only audit gap in BW-AUD-006.
2. `BW-LIVE-CREATOR-002` remains fixture-only, and `BW-LIVE-CREATOR-004` remains a downstream-preview evidence limitation.
3. `BW-LIVE-CREATOR-003` is merged into BW-M-020 as additional evidence and source-root-cause corroboration; it does not create a duplicate Exchange ticket.
4. `BW-LIVE-CREATOR-005` through `BW-LIVE-CREATOR-007` are preserved as reference-quality contracts.

No continuation observation authorizes a product repair beyond the surviving BW-M-020 authority. The unobservable child Preview Voyage and physical Tab traversal remain evidence limitations for a future capable browser environment, not a reason to alter product isolation or accessibility semantics.

## 11. Stage 7 completion status

**Status: `STAGE 7 FINAL — ADJUDICATION COMPLETE FOR AVAILABLE EVIDENCE`**

Stage 7 has completed the work the owner specifically requested: the audits themselves have been audited, the Creator live continuation has been reconciled, and the repair-authority ledger is frozen.

The repair list is no longer a concatenation of every alarming sentence produced during Stages 4–6. It is a reconciled set of current product findings with duplicate observations merged, wrong attribution removed, evidence-only problems separated, pending findings blocked from repair, and reference-quality behavior protected.

**Stage 8 may use the Master Product Repair Ledger above for confirmed work, including BW-M-020’s now cross-surface motion-state authority.** It must not treat Pending findings, Audit/Evidence actions, Retired findings, or reference-quality contracts as product repair authority. This Stage 7 closure is audit/evidence closure, not deployment, owner acceptance, assistive-technology certification, or a claim that future product changes have been accepted.

## Appendix A — Source-set reconciliation

- **Stage 4 source forensics:** all BW4-CODEX-001 through BW4-CODEX-012 accounted for in master, audit-only, retired, or product-decision-required disposition.
- **Stage 5 Pass 1:** all BW-VIS rows are either merged into master findings, explicitly retained as reference quality, or retired/reclassified by Stage 4B/Stage 7.
- **Stage 5 Pass 2:** all BW-VIS2 rows are merged into their underlying master problem, retained as reference contracts, or preserved as resolved evidence decisions.
- **Corrected Stage 6:** all BW-LIVE-001 through BW-LIVE-014 are represented as master, pending, audit-only, or retired/no-action findings.
- **Creator live continuation:** all BW-LIVE-CREATOR-001 through BW-LIVE-CREATOR-007 are represented by the Section 3.1 disposition table: BW-AUD-006 closure; fixture-only/no-action; BW-M-020 merge; evidence limitation/no-action; and BW-REF-013 through BW-REF-015. No duplicate master finding was created.

## Appendix B — Important supersession rules

- Corrected Stage 6 supersedes the raw Stage 6 attribution document.
- Stage 5 Pass 2 supersedes Pass 1 dispositions for BW-VIS-070, BW-VIS-080, BW-VIS-081 and BW-VIS-082 and expands/splits several others.
- Stage 4B evidence corrections supersede older false READY Captain/Studio conclusions without implying product source changed.
- Stage 7 source adjudication supersedes BW-LIVE-006 and BW-LIVE-008 product attribution.
- Stage 7 source/live adjudication supersedes BW-VIS-050/BW-VIS-051 as 'missing implementation' findings; their blank captures remain evidence that must be recertified.
- The Creator continuation supersedes the provisional Creator-live-coverage-pending state and closes BW-AUD-006 without altering ordinary Studio authorization semantics.

---

**Final governing sentence:** Brightwork exists to make Voyagewright better, not to make every audit finding come true. Repair the product only where current evidence proves the product needs repair; repair the audit where the audit was wrong.

**Ledger freeze:** `STAGE 7 FINAL`
