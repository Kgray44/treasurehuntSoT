---
title: Parallax A1 evaluation and qualification
audience: engineering
status: software-accepted-owner-presentation-accepted
canonical_for: parallax-a1-evaluation-qualification
last_reviewed: 2026-10-11
---

# Evidence boundaries

The [mainline implementation record](Parallax_A1_Implementation_and_Qualification.md)
supersedes the earlier checkpoint holds below: protected PR #710, ordinary PASS
and clean landed smoke establish software acceptance. Owner visual acceptance
for the revised presentation is recorded in the [owner-refinement record](Parallax_A1_Visual_Refinements.md).
Historical reports and their source identities remain unchanged.

The current versioned corpus `parallax-spatial-assistant-2026-10-11-v4` defines 60 distinct
instructions across object creation, placement, relative positioning, editing,
multi-object scenes, timeline, interactions, ambiguity, unsupported effects,
accessibility, safety, privacy, follow-ups, conflicts and prompt injection. Each
case declares interpretation, required and forbidden operations, classification,
uncertainty, scene outcome and Guided fallback. Authored deterministic fixtures
test contracts; they do not establish a model's natural-language quality.

Run the sixty-case report without upstream calls:

```powershell
npx tsx scripts/parallax/evaluate-spatial-assistant.ts
```

The optional live evaluator uses the same corpus, real server provider/service,
canonical owner-bound synthetic working drafts, durable admissions and pinned
settlement. It provisions and removes its own temporary SQLite database. It
requires an inherited key, explicit `--live-authorized`, explicit `--max-calls`
(1–120), and explicit `--budget-usd` (greater than zero, at most $10). Selected
models are explicit; default is Luna. No automatic retry occurs; uncertain
accounting or a failure stops further calls. Safe reports retain case identities,
findings, model, source identity, dirty-state label and usage metadata under
ignored `tmp/parallax-a1/evaluations`. The later public synthetic evaluator retains
schema-validated interpretations, safe failure status and request IDs so outcomes
can be independently assessed; headers, credentials and arbitrary raw envelopes
remain excluded. Reviewed engineering evidence is published under
`Development_Docs`. The [model and prompt study](Parallax_A1_Model_and_Prompt_Comparison.md)
preserves the additional authorization, all fifteen rounds and their actual
limitations. Version-two historical reports remain unchanged.

After owner authorization, a small sample can be invoked with:

```powershell
npx tsx scripts/parallax/evaluate-spatial-assistant.ts --live-authorized --models gpt-6-luna --cases create-note --max-calls 1 --budget-usd 0.10
```

Compare both models on explicit corpus cases by passing
`--models gpt-6-luna,gpt-6.1-sol` and appropriate explicit call/spending limits.
Results use strict property expectations against the saved synthetic fixtures;
review failure categories and actual scene semantics before claiming quality.
The command does not establish mounted end-to-end Studio behavior or owner
visual acceptance. Full-corpus comparison requires sufficient explicit allowance
and remains optional. The bounded six-call canary below records the actual live
evidence, including the original evaluator's fixture-identity defect.

## Earlier independent development evidence

The focused local suite passes 209 checks across 13 files. Sixty deterministic evaluator results and the 61-check corpus suite pass. TypeScript, changed-source ESLint, documentation/index validation and generated Feature Catalog validation pass. No major catalog fragment changes are justified by this partial candidate.
Owner-bound service tests use actual isolated SQLite and a mocked HTTPS adapter
to prove admission before dispatch, exact saved revision/ownership, safe private
context, proposal retention, duplicate replay, disabled/absent provider behavior,
invalid billed operation handling and conservative uncertain billing. Additional preparation checks reject forged/foreign/expired retained proposals and stale working revisions, with no competing save path. Ledger
tests use independent Prisma clients against one isolated fixture to exercise
cross-server budget races and settlement/lease/month boundaries. Policy-command
tests exercise durable exact-session previews, stale revisions, audits and
inherited/expiring policy behavior. Account-dossier UI/route tests exercise
existing identity, observation capabilities, safe history bounds, policy preview
and assurance gating without a second user search.

Ten mutation-route checks exercise the actual canonical session, CSRF,
capability, request parsing and privileged-assurance gates, with synthetic
session/account lookup and mocked owner persistence. Unauthenticated requests,
invalid CSRF, Creator/support roles, expired session-bound assurance, missing
confirmation, invalid preview identities and rate limits stop before owner
policy mutation. Successful requests pass the exact reviewed identity to the
owner service and return private, non-cacheable metadata. These HTTP checks
complement the existing durable policy tests and isolated production browser
journey; they do not replace either.

The isolated panel has component proof for intentional submission, preview,
explicit review, generation-based stale rejection, cancellation, uncertain-save
identity reuse, acceptance after verified acknowledgement, history callbacks and
safe session metadata. This is not rendered viewport/mobile/visual acceptance.

Additional context checks cover a clarification followed by its targeted answer,
two-turn chronological bounds, owner/draft/expiry/duplicate/cycle/malformed guards,
exclusion from safe usage reports and idempotent replay, replay after older context
expires, and derivation of object existence from the current scene. Component
checks cover deliberate follow-up identity, a fresh task without inference or
scene mutation, and account-scoped session restoration. These use synthetic
content and a mocked upstream with actual isolated durable records; they do not
prove live semantic quality or the mounted Studio refinement journey.

The prepared canonical HTTP/host adapter has fourteen focused checks for the
saved-snapshot boundary, same-origin Studio action/CSRF/cancellation, exact
request/proposal binding, acknowledged materialization before one host install,
concurrent and repeated application identity, uncertain response retry, malformed
or wrong acknowledgements, intervening local edits, account-scope changes, and
safe quota/reset projections. Its host callback owns the ordinary history and
marks the acknowledgement already saved. The bounded full-scene acknowledgement
check includes a supported 32-entity draft larger than the provider response
budget, without weakening response bounds. At independent checkpoint `1f5f4b7a`, the adapter was not mounted and its
ASSISTANT/ASSISTANT_APPLY handlers were not installed. The mounted checkpoint
below supersedes that implementation status. These checks use mocked HTTP and synthetic host state; they do not prove
authenticated atomic backend Apply, a real history installation, persistence or
the full Creator browser journey. Those gates remain pending.

At this earlier checkpoint the complete authenticated Assistant browser journey,
motion/viewport package, ordinary final Sounding Line, PR qualification, live
provider canary and owner visual review remained pending. The later records below
supersede that implementation and browser status. The then-fetched main was
`0327eeb7bbe74a5fd7e7dba30dc64aaf22953dd6` (accepted Phase 3 PR #711, preserving Crossdeck and Pilot); the independent checkpoint still derives
from `f458bf2dc1176016c2d166180f038f0f15ac9f7c`. No unmerged Phase 3 source was
imported and no shared development server, account database or real private
content was used for validation.

## Published independent checkpoint

Draft PR [#710](https://github.com/Kgray44/treasurehuntSoT/pull/710) preserves the independent candidate. The source checkpoint `057c92877e61dd7852ff2c994c8d1d236a684514` has tree `7b3af8d5e944b24dc250226f3cae7001142eab0e`; Node 24.18.0/npm 11.9.0 and lock SHA-256 `a2f4140400648da7810670a7ef677e04d526628a8f66a98efcc180f5eef74014` were used.

The generic isolated production browser journey passed People search -> canonical dossier -> 500-to-250 allowance change -> privileged password assurance -> audit receipt -> restore inheritance. It also passed missing-CSRF rejection, provider health metadata, serious/critical accessibility filtering and 390px panel-width checks. The synthetic mobile capture was inspected; it is component/layout evidence, not owner visual acceptance. The harness cleaned its owned runtime; ports 53078/53079 had no remaining listeners. Browser receipt SHA-256 `c1b3e52c42b4e142c1c5d221138c054b021c3c79aaf32e3c1ad02719d9cfca64`, profile receipt `4365c741ce7971c0b77a3dfa315a294b3a9b60b29a4f09d2e3e656dca2ce2208`, are retained locally under ignored task artifacts. The initially inspected mobile capture had SHA-256 `70df1372196829ffc39b3677df4ce78c9b50926c355ac46567c6b310512ca61a`; the expanded journey replaced that capture, and the later image is retained separately below. The expanded global-policy result is not covered by the first checkpoint receipt.

This is a focused development checkpoint, not the final ordinary Sounding Line or integrated A1 acceptance. Resume shared integration only on the newest accepted canonical Phase 3 source with the mutually accepted generation/save-acknowledgement interface. Final qualification must bind the later complete candidate and must not reuse these focused receipts as whole-feature authority.

### Expanded global-policy journey

At source `7db9e0ed575cec68ab9c73803932bbb790aab1f1`, tree `f91ee26ee0de3aa1105174865d41830bb583aa06`, the same isolated browser journey also changed the global cap from $10 to $8 through exact preview, password assurance and confirmation, verified the durable global policy receipt, and kept assistance disabled. The full expanded journey passed. Runtime receipt SHA-256 is `5f630aec04c224c5aaf3340d9f134a44e9622c90b5b35db8bc0c191d3d3a8386`; the retained mobile capture is `b8f3d61772522f5087980928f795140a9ff05613c97b0b1d08ca24e8cb63a62c`. These files are copied under ignored `tmp/parallax-a1/checkpoint-7db9e0ed` before further validation. Owned ports 63667/63668 have no remaining listeners. No paid call or cloud executor test was dispatched.

The initial candidate's 177 focused checks remain applicable to unchanged implementation modules; the expanded journey and its production build also perform full TypeScript qualification. Later documentation-only commits do not replace the explicit browser-source binding. The final ordinary full-feature gate remains deferred to completed canonical integration.

### Accepted main reconciliation

Protected PR #711 merged as `0327eeb7bbe74a5fd7e7dba30dc64aaf22953dd6`,
tree `36529aefcac815a8a1cef0434624149b9b567e6f`. Its ordinary run `38171123906`
and job `114563773604` succeeded. This clears the A1 canonical-source prerequisite;
that Phase 3 receipt is not A1 qualification. The owned additive merge preserves
all 224 accepted models and all five A1 models in each schema, and retains the
accepted Studio, route and Library implementations before mounting work begins.
Four documentation conflicts were resolved by retaining both sets of updates.

After dependency installation and Prisma generation, TypeScript and 233 focused
checks across 15 files passed. Documentation and feature validation passed with
66 catalog entries. Lock SHA-256 is
`1dc07127fe4874a0d63baaf36fd4b644b1cbb0c37860312b11873c103a56b373`.
An early check started before generation completed is discarded. Adaptive recipe
compatibility, atomic Apply, host mounting and the complete browser journey remain
work to qualify on the integrated candidate. No paid request was made.

### Mounted integration candidate

The accepted-main reconciliation was published in `a4d469bb`. The subsequent
candidate mounts the Assistant in the existing floating/docked Studio workspace,
adds its strict actions to the existing authenticated endpoint, retires the
unmetered legacy network entry, and preserves adaptive recipe/discovery ownership.
Apply uses the canonical save/CAS implementation and commits a metadata-only
retry receipt atomically. No additional provider, endpoint, history or content
store was introduced.

The mounted checkpoint suite passed 271 checks across 19 files. Six durable Apply
checks cover a saved revision and receipt, concurrent retries, fresh-server replay,
receipt-write rollback, changed identities, later Creator work and stale/foreign/
expired proposals. Ten same-route HTTP checks cover canonical session/CSRF and
Creator workspace gates, strict parsing, request cancellation, safe allowance/
configuration output, safe errors and retired legacy actions. Three added mounted
host checks cover actual adapter/panel integration, preview without writes, one
acknowledged history installation with no duplicate autosave, byte-identical Undo
staleness, and locating/selecting a newly proposed object without erasing its preview.
They use synthetic HTTP/upstream data and isolated SQLite; WebGL is unavailable in
the DOM test environment, so these checks do not claim rendered 3D pixels.

Both Prisma schemas validate. TypeScript and scoped lint pass. Shared schema
references and a four-object context bound fit the tested eight-object adaptive
scene under the unchanged 12,000 conservative input allowance. Full canonical
scene validation still governs every selected bundle. No paid request occurred.
The checkpoint's next gates were the complete authenticated built-server Creator journey,
quota enforcement/browser scenarios, motion/viewport captures and final ordinary
qualification. Model semantic quality, paid canary and owner visual acceptance
remain separate from these deterministic checks.

Native fetch subsequently includes closure PR #713 at
`af867c011eb0c3c4d39cfe0d0bfef7c596fdbbbf`, tree
`2456cb6cf7091048d17d5e5d52b865b97ded9d6e`; direct Git comparison confirms its
product source matches the Phase 3 product merge. Main has since advanced through
phone sign-in correction PR #712 as `678dd115`. Additive reconciliation `6d19d0d6`
preserves that accepted correction and closure records; no sibling checkout changed.

## Authenticated production browser checkpoint

Source `6cc62ef911c86c038ef990db5613b5ef6328b5d3`, tree
`d3671cc09862db3ba35b9adbfb5d861a0b5ad4cb`, passed all five isolated production
browser journeys. The guarded fixture intercepts only the fixed OpenAI Responses
upstream inside a disposable runtime; real authentication, Studio/Admiralty routes,
canonical persistence, accounting, WebGL preview and publication remain intact.
No actual OpenAI network request or paid usage occurred. The source-bound local
receipt, captures, safe synthetic provider metadata and hashed recordings are in
`artifacts/parallax-a1/browser/6cc62ef911c8`. These are local evidence and are not
substitutes for the ordinary final Sounding Line authority.

The complete 28-step Creator journey passes response-to-scene correspondence,
one atomic saved Apply/ledger receipt, Undo/Redo, saved-address refresh, prior-object
refinement, Drydock, immutable Library version, exact Chronicle pin/reopen and
unchanged progression records. Browser proof exposed and corrected the saved
draft URL restoration defect.

Three quota journeys cover the canonical People dossier, inheritance, larger and
smaller allowances, privileged password assurance, suspension/reenabling, advanced
grant/denial, monthly exhaustion, global warning/disable/reservation funding cap,
stale reviews, privilege/private-history rejection, independent-user/global and
same-user/session capacity races, and durable same-key replay. Global reservation
funding denial is not a claim of literal 100 percent settled spending.

Presentation proof covers 12 welcome viewport/mode/docking combinations plus
composer reachability, real light/dark account appearance, reduced-motion styles,
rendered-review focus, provider failure/recovery, unsupported capability and settled
usage approaching/reaching a five-request synthetic allowance. Visible welcome
and light proposal accessibility checks report no violations. The earlier hidden
panel accessibility check is not used as visible-panel evidence. Layout and contrast
defects found by these checks were fixed; captures do not establish owner approval.

The expanded focused suite now passes 304 checks across 19 files, including
adaptive/library/layout compatibility. TypeScript and scoped lint pass. Final
ordinary qualification, exact PR/landed evidence, live-provider quality and owner
visual acceptance remain open. The mobile canvas-switch check also passes:
it preserves the actual proposal while hiding the panel, reopens the same review
without saving and verifies reachable Apply controls. The
[presentation review](Parallax_A1_Presentation_Review.md) records its
review package and acceptance boundary.

## Authorized bounded live-provider canary

The owner explicitly authorized six calls with a $0.50 total ceiling and no
retries. On clean source `d6d63b2ccf9da4e0d1ece9141dcbacaa99badfe8`, the evaluator
used the shared Windows user credential only in its server process environment.
It executed `create-note`, `relative-left` and `ambiguous-content` once each with
Luna and Sol, against a disposable synthetic SQLite store. Initial fixture
provisioning failed before any provider attempt; the evaluator was corrected to
reuse the existing migration bootstrap before these six calls. No shared runtime,
real Creator scene or credential file was involved.

All six HTTPS calls returned validated structured interpretations and settled
usage. The durable ledger total is 18,827,055 nanodollars ($0.018827055), below the
500,000,000-nanodollar authorization ceiling. Each record includes input/output
tokens and admission/context/provider/validation/materialization timings.
The unchanged original safe report is
`tmp/parallax-a1/evaluations/live-ca5c5954-3795-499f-bf7f-19a10f73ec67.json`,
SHA-256 `48f815cc93321f52b3bdfe65b9bf43771431f59a7ca29a88db6d3a24767e1051`.
It contains no prompts, responses,
credential values or private scenes.

The v1 report records four passing semantic evaluations and two
`REQUIRED_CREATE_MISSING` findings. Both creation results passed intent, final
parchment kind/content and materialization checks. Inspection found that the
required CREATE matcher also demanded the private fixture ID `pirate-note`,
which the provider was never given. This is an evaluator false negative, rather
than evidence that the requested note was absent. The raw report is preserved;
it is not relabeled as six green evaluations.

Corpus v2 matches CREATE kind, requested content and placement while allowing
valid newly chosen identities. Existing edit targets remain exact. Two regression
checks prove that arbitrary valid new IDs are accepted while wrong creation
content/placement and wrong existing targets still fail. The 63-check corpus
suite passes. No additional paid request was made, and this corrected matcher has
not been rerun live. Six synthetic samples do not establish full-corpus model
quality or physical AR acceptance.

## Requirement audit before final ordinary qualification

| Requirement group                                | Current evidence and boundary                                                                                                                                                                                     |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared local credential and absent-key operation | Safe fresh-child probes from three independent checkout directories; provider tests reject missing keys before fetch and preserve manual editing. Only server environment access is used.                         |
| Canonical Assistant and reviewed proposals       | Mounted host, strict same-route HTTP/service tests, operation/dependency/schema checks and 60 deterministic corpus cases. No tools or unmetered legacy inference path.                                            |
| Preview, Apply, history and persistence          | Production 28-step Creator journey, actual WebGL correspondence, durable atomic-save/retry-receipt tests and monotonic stale-generation checks.                                                                   |
| Adaptive/library/Chronicle ownership             | Focused compatibility checks plus immutable Library and exact Chronicle pin/reopen with unchanged progression in the production journey.                                                                          |
| Quotas, accounting and administration            | Isolated ledger/policy races and three authenticated quota journeys, including the normal People dossier, assurance, reviewed mutations, audit, suspension, advanced grants, exhaustion and independent sessions. |
| Live provider                                    | Six authenticated structured responses with settled usage; four raw semantic passes and two documented fixture-ID false negatives. Corrected v2 matcher is deterministic-only.                                    |
| Presentation and accessibility                   | Twelve viewport/mode/docking combinations, visible accessibility/motion/focus checks and inspected captures; gallery awaits owner review. Physical phone keyboard/touch and AR quality remain separate.           |
| Documentation and catalog                        | Product/status/guide/changelog review and governed documentation/index/catalog validation; partial A1 is not promoted as mainline availability.                                                                   |
| Final acceptance                                 | Ordinary exact-candidate Sounding Line, protected merge and landed smoke remain outstanding. Browser proof and the live canary do not replace that authority.                                                     |
