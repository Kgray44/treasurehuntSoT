---
title: Parallax A1 evaluation and qualification
audience: engineering
status: qualification-in-progress
canonical_for: parallax-a1-evaluation-qualification
last_reviewed: 2026-10-11
---

# Evidence boundaries

The versioned corpus `parallax-spatial-assistant-2026-10-11-v1` defines 60 distinct
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
ignored `tmp/parallax-a1/evaluations`; prompts and responses are excluded.

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
and remains optional. No paid evaluator or canary has been executed for this
candidate, despite the configured Windows user credential.

## Local development evidence

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
budget, without weakening response bounds. The adapter is not mounted, and its
ASSISTANT/ASSISTANT_APPLY action handlers are not yet installed in the canonical
route. These checks use mocked HTTP and synthetic host state; they do not prove
authenticated atomic backend Apply, a real history installation, persistence or
the full Creator browser journey. Those gates remain pending.

Shared Studio integration, authenticated atomic Apply, legacy network-path
migration, mounted Assistant browser journeys, motion/viewport package,
ordinary final Sounding Line, PR qualification, live provider canary and owner
visual review remain pending. The latest verified fetched main is
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
