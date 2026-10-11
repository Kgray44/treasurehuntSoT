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

The focused local suite passes 177 checks across 11 files. Sixty deterministic evaluator results and the 61-check corpus suite pass. TypeScript, changed-source ESLint, documentation/index validation and generated Feature Catalog validation pass. No major catalog fragment changes are justified by this partial candidate.
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

The isolated panel has component proof for intentional submission, preview,
explicit review, generation-based stale rejection, cancellation, uncertain-save
identity reuse, acceptance after verified acknowledgement, history callbacks and
safe session metadata. This is not rendered viewport/mobile/visual acceptance.

Shared Studio integration, authenticated atomic Apply, legacy network-path
migration, mounted quota/Assistant browser journeys, motion/viewport package,
ordinary final Sounding Line, PR qualification, live provider canary and owner
visual review remain pending. The latest fetched main is
`01d32824127d00628546ea4209d09fea57c335c1`; the independent branch still derives
from `f458bf2dc1176016c2d166180f038f0f15ac9f7c`. No unmerged Phase 3 source was
imported and no shared development server, account database or real private
content was used for validation.
