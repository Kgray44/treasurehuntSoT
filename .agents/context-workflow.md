# Project Trim context workflow

Project Trim starts every applicable task with **Minimum Sufficient Context**:
the smallest verified, task-specific starting map that permits safe progress.
It then uses autonomous progressive expansion. **CONTEXT EXPANSION IS NOT SCOPE
EXPANSION**: reading a relevant authority, source, schema, test, or history item
does not authorize changing adjacent scope.

## Bootstrap and truth

Use `scripts/agent-context/build-context.mjs` with a task input to produce the
canonical derived JSON packet, compact task-facing Markdown, and task-local
ledger template. Select a profile from `agent-context-profiles.json`, read the
packet's source-bound authority slices, and use its confidence, staleness, and
fallback fields. Profiles and packets are startup heuristics, not permissions
barriers: there is no context prison.

Packet schema v2 binds authority, ownership, source, schema/data, verification,
dependency, profile, prior-plateau, and main-delta slices to exact source
identities. `FRESH`, `PARTIALLY_STALE`, `STALE`, `CONFLICTED`, and `UNKNOWN`
are explicit states. A changed bounded source invalidates only its bound slice
where possible. Regenerate stale slices with `--previous-packet` and the
comma-separated `--slices` option; do not rebuild or distrust unrelated fresh
slices merely because one source changed.

Authority summaries are source-bound navigation aids. Load exact authority text
for ambiguous normative wording, conflicts, security/privacy boundaries,
destructive or irreversible decisions, and migration/rollback gates. A stale or
conflicting authority slice is never silently trusted.

Current source and active governing documents prevail over packets, summaries,
or records. When current sources conflict or a source identity is stale, resolve
the precedence narrowly; escalate only if it is irreconcilable. Sounding Line
continues to own verification, release evidence, and `RELEASE_GO`; Project Trim
only supplies context for honoring it. Follow `.agents/testing-workflow.md` for
incremental verification and candidate acceptance.

## Expansion and recording

When a question is unresolved, classify the smallest needed expansion as
`AUTHORITY`, `SOURCE`, `SCHEMA`, `TEST`, `HISTORY`, `ADJACENT_PROJECT`,
`OPERATIONS`, or `SECURITY`; inspect the smallest useful source set; record the
reason, path/source identity, result, and repeated-read status in the ledger;
then continue. A coarse, partial, unmapped, stale, or unknown mapping lowers
packet confidence and requires conservative search/expansion or targeted slice
regeneration. The packet records the exact unresolved path and next targeted
action. Uncertainty never removes a needed source or proof obligation.

Record only safe identifiers, paths, digests, counts, and concise resolutions.
Do not place secrets, credentials, private content, full prompts, or raw logs
in packets or ledgers.

## Execution profiles

`STANDARD_AUTONOMOUS` performs safe in-scope work and targeted reading without
asking merely to inspect another relevant source. It retains normal approval
boundaries.

`UNATTENDED_CONTINUATION` has the same authority and must continue through all
locally attainable work. It does not stop for a needed document/source/history
or test, normal dependency setup, task-local configuration, a focused failure,
a task-owned alternate port, compilation repair, regeneration, low confidence
that targeted expansion can resolve, or an independently blocked lane.

Both profiles stop or seek direction for a destructive or irreversible action
outside authorization, a required external/costly action, unavailable required
credentials, a materially scope-expanding request, unrelated-work risk, or an
irreconcilable authority conflict with no safe local path.

## Usage accounting

Record official exposed goal totals as `EXACT`. Otherwise use
`RECONSTRUCTED`, `CALIBRATED_ESTIMATE`, `COARSE_ESTIMATE`, or `UNAVAILABLE` in
that order of evidence. Missing accounting is never zero. Estimates are not
official billing: retain their point/range, activity regime, confidence,
provenance, and estimator version.
