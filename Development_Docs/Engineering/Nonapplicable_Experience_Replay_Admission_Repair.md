---
title: Nonapplicable experience replay admission repair
audience: engineering
status: prepared-awaiting-protected-qualification
canonical_for: nonapplicable-experience-replay-admission-engineering-20261021
last_reviewed: 2026-10-21
---

# Nonapplicable experience replay admission repair

Documentation PR #786 run `39699142397/1`, source
`50bbfe1f20c34ade7c7b972dcb69f519bd8da84f`, passed all seven technical obligations
and failed its final experience decision. The retained decision reports
`REPLAY_ADMISSION / PLAN_INPUT` with a backend-only, nonapplicable product
experience plan. The run remains failed; earlier #786 failures and the completed
R26 campaign remain unchanged.

## Source-bound cause

Accepted main `aaff919428ef9ab421579415ce3409949724760d` calls
`assertExceptionExecution` with `claim: true` before checking whether trusted
experience replay applies. Installed historical campaign recognition includes
descendant source. It consequently requires immutable replay identities even for
the canonical nonapplicable plans that intentionally have none.

A real synthetic Git repository independently reproduces the accepted production
failure as `PRODUCT_EXPERIENCE_EXCEPTION_EXECUTION_PLAN_CHANGED` at `PLAN_INPUT`.
The applicable negative control rejects correctly in the same original run. The
raw local reproduction is retained privately. It makes no API request, claim,
browser/capture invocation or consumer attempt.

## Correction and safeguards

The replay entry point accepts only canonical nonapplicable shapes before
exception admission: explicit `applicable: false`, a known non-user-facing
classification, no contract obligations, and either the minimal result or the
complete graph result with empty surfaces and uncertainty. Graph paths remain
typed strings in dense plain arrays. Every top-level field and array entry must
be an own enumerable data property; input accessors and input-owned methods are
never invoked. The inactive-policy classification accepts only its minimal
three-field form. Extra fields, sparse arrays, inherited state, unknown
classifications, nonempty obligations, uncertain results and malformed
applicability fail closed. Frozen canonical data remains valid.

Valid nonapplicable calls return `NOT_APPLICABLE` without source recognition,
exception claims, diagnostic setup, replay files or process execution. An
applicable plan still enters the original exception gate and its existing
immutable-source, lease, custody, phase, budget and execution checks. The capture
entry point, registry, R26 rows, grants, counters, seals and workflows are
unchanged. A nonapplicable return supplies no browser or capture permission.

Regressions use the actual canonical planner on an inert backend-only Git change,
cover all current nonapplicable result forms, verify zero observed Git reads and
diagnostic calls during the return, and require no execution artifacts. Negative
cases cover forged exception/contracts, inherited fields, invalid applicability,
visible surfaces, uncertainty, obligation IDs and malformed graph paths. The
applicable control retains real installed admission and its exact missing-plan
identity rejection. The existing direct capture/replay execution-denial test
remains required and unchanged.

## Explicit validation prerequisite

Accepted main also has an outdated FT-045 test expectation. The authoritative
Crossdeck catalog fragment already names `Project Crossdeck participation,
continuity and experience refit`; the test still expects its former Phase 1 name.
The #786 owner explicitly transferred only its exact expectation and multiline
Prettier correction from `50bbfe1f20c34ade7c7b972dcb69f519bd8da84f` into this
maintenance candidate. The title assertion stays meaningful; the authoritative
fragment and generated catalog are unchanged.

The 38 pending historical Ledgerlight media inventory additions remain owned by
#786. Documentation generation may discover them, but this repair restores those
unrelated additions after generation and retains only its own new documentation
entries plus the UTC-generated index date. This disposition is explicit rather
than silently absorbing the documentation owner's work.

Independent exact-source review, normal protected Linux qualification, protected
merge and independent landed verification remain required. The accepted tuple
then allows the documentation owner to reconcile #786 and qualify its remaining
diff normally. This maintenance lane does not dispatch #786 or consumer work.

Feature Catalog disposition: ordinary admission bug fix and existing-title test
correction; no major capability or important subfeature change.
