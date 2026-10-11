---
title: Parallax A1 accounting contracts and privacy
audience: engineering
status: implementation-candidate
canonical_for: parallax-a1-accounting-contracts-privacy
last_reviewed: 2026-10-11
---

# Server and deterministic authority

The implementation candidate has one pure typed interpretation schema and a
separate owner-bound proposal envelope. Supported operations are CREATE, CONTENT,
TRANSFORM, PLACEMENT, VISIBILITY, BEHAVIOR and FALLBACK. Model output remains
advisory. Dependency-closed bundles materialize atomically through canonical
authoring edits and deterministic spatial validation. Locks, missing references,
invalid bounds, missing reveal paths and missing accessible alternatives reject
the bundle. Clarification, unsupported and critique results cannot mutate scenes.

The proposal binds schema version, request identity, definition identity, saved
revision, local editor generation and SHA-256 digest of the complete parsed
draft. Saved ownership and checksum are checked before inference. The local
generation catches an edit followed by Undo even when the digest matches again.
Clients cannot provide authoritative approved proposals: atomic Apply must use
the owner-scoped retained server result. Its final authenticated route and one
already-saved host history installation remain held for canonical integration.

## Admission and accounting

SQLite and MySQL additive schemas own global control, user policy, policy
revision, command preview and usage-ledger records. Every admission, dispatch,
settlement and policy mutation acquires the same durable global row lock before
reading budgets. The implementation uses integer USD nanodollars and pinned
model/tier pricing. Concurrent servers cannot reserve the same final budget.
Monthly requests/spending, per-user policy, RPM, concurrency, model permission
and per-request worst-case exposure are checked before dispatch.

RESERVED is undispatched exposure. DISPATCHED records the single upstream
attempt. SETTLED records reported usage at the admission's pinned prices.
RELEASED preserves a provably unbilled attempt with zero exposure. UNKNOWN
preserves full conservative exposure when billing is uncertain. Undispatched
expired leases can be released; dispatched expired leases remain unknown.
Idempotency conflicts reject changed instructions; repeated identities do not
dispatch again. Late usage settles against the original UTC month and prices.
Reported reasoning tokens are included within output and never charged twice.
Cached input is separated from uncached input; reported cache writes are charged
conservatively in addition. Actual unexpected costs remain recorded and trigger
an audited automatic disable.

Local exposure is an application admission ceiling, not a claim of total
provider-account billing control. Independent application databases maintain independent ledgers; the durable global lock governs servers using the same database. The same local credential can be used by
unrelated software. Missing usage does not become zero. There is no automatic
retry after upstream uncertainty and no unattended model escalation.

## Provider contract

The fixed Responses endpoint uses `text.format` with strict JSON Schema, bounded
input/output, explicit reasoning, standard tier, `store: false` and no tools.
Responses and response bytes are bounded. Authentication, model, provider quota
or rate, unavailable, timeout, cancellation, refusal, incomplete/malformed output,
unexpected tool and invalid operation findings are safe categories. HTTP errors
never expose raw upstream bodies. Bounded 429 classification separates upstream credit/spend/usage exhaustion from rate limits using the [official error-code contract](https://developers.openai.com/api/docs/guides/error-codes); ambiguous HTTP timeouts retain conservative exposure. Inputs include creator request plus bounded
selected/surrounding object IDs, labels, geometry, interactions and locks. Existing
clue text, alternatives, media and imported metadata are excluded. Labels and
requests remain untrusted data.

The server reads only `process.env.OPENAI_API_KEY`. It sends that value only in
the authorization header to the fixed provider. Safe diagnostics return configured
booleans. No credential file, cloud service, public environment variable or browser
secret is introduced. Browser imports of server modules are type-only.

Usage history explicitly selects safe metadata and excludes private retained
results. A successful advisory result retains the submitted instruction (at
most 2,000 characters) and the previous request identity inside its existing
owner/draft-scoped result, so a short clarification answer can retain the original
task's meaning. Failed results do not retain instruction text. Complete retained
results are bounded to 64 KB and expire after the configured 1–90 day retention
period; defaults are 30 days. Expiration is cleared on the next admission.

An explicit previous request identity resolves at most two chronological turns
from that same owner and draft. Context contains the submitted instructions,
bounded proposal summary/question and operation types/identities; it excludes
previous generated clue/alternative text and full proposal bodies. Those turns
are marked advisory. Current object existence comes from the current canonical
scene, and discussion cannot apply or restore edits. Foreign, expired, malformed,
duplicate or circular references fail before upstream dispatch; undispatched
reservations release their exposure. Idempotent replay strips private conversation
fields and remains independent of older context expiring. Administrators' usage
exports and diagnostics do not contain retained instruction text. The private
conversation field is excluded from ordinary provider replies. No instruction
is logged or placed in browser storage.

Browser session storage contains only timing/count metadata and a request
identity, scoped by account and draft. A recent session may restore that identity
without making an inference call; a fresh session uses current saved scene state.
**Start new task** clears local context and review without mutating the scene or
calling the provider. Financial/policy records remain durable. Account/draft
switches remount the panel and abort in-flight work.

## Integration boundary

These modules are not yet the mounted canonical Studio AI route. Narrow legacy
IntentProposal remains separate; migration must close its unmetered network
path before A1 completion. Shared Phase 3 authoring, renderer, persistence/history
and resolution/field/calibration models remain owned by their phase. Reconcile
both Prisma schemas by additive sections after the accepted base exists.
