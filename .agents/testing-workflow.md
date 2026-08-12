# Testing workflow

Every Codex task must separate incremental development verification from candidate qualification and authoritative acceptance. Sounding Line remains the sole release authority, but its mainline and release-candidate gates are finalization gates, not debugging loops.

## A. Development verification

During implementation, test incrementally.

After each coherent behavioral change:

1. Identify the smallest directly affected test or registered suite.
2. Run that focused verification.
3. If it fails, repair the defect and rerun the same focused verification.
4. Do not stack unrelated implementation on an unverified change.
5. Periodically broaden only to the affected subsystem or dependency scope.

Development verification may use task-owned local tests or the focused hosted workflow when local execution is inappropriate or resource policy requires hosted execution.

Development verification must not:

- request `RELEASE_GO`;
- invoke a full mainline or release-candidate authority gate merely to discover bugs;
- acquire canonical merge ownership;
- treat unrelated repository suites as debugging probes; or
- continue implementation past a known failure in the directly affected scope.

## B. Candidate qualification

Only after implementation is functionally complete:

1. Run required project-owned unit, component, and browser evidence.
2. Run directly impacted cross-project evidence.
3. Run required static, type, lint, documentation, catalog, migration, privacy, security, and accessibility checks according to the phase and current Sounding Line policy.
4. Resolve every known failure through focused development verification.
5. Produce one coherent candidate and freeze its exact branch head SHA.

A candidate with a known failing required suite is not candidate-complete and must not enter authoritative acceptance.

## C. Authoritative acceptance

Sounding Line mainline or release-candidate execution is permitted only for a qualified frozen candidate. The `Sounding Line / Mainline Decision` is a finalization test, an integration acceptance test, and a merge or release authority. It is not a debugging loop.

Authoritative acceptance must be explicitly dispatched against the exact frozen candidate branch/ref and SHA. A passing decision is valid only for that exact SHA; any subsequent candidate commit requires requalification and a new explicit decision.

If authoritative acceptance fails:

1. Record the exact failed receipt and suite.
2. Classify the failure.
3. Release canonical acceptance ownership.
4. Return the task to development verification.
5. Reproduce the smallest failing scope.
6. Repair it.
7. Prove the repair with focused evidence.
8. Requalify and refreeze the candidate.
9. Only then launch one new authoritative attempt.

Repeated full authoritative executions while diagnosing the same unresolved failure are prohibited. Do not widen timeouts, retries, or test scope instead of identifying root cause. A changed SHA alone does not justify blanket revalidation beyond the final authoritative candidate's governed obligations.

## Focused hosted evidence boundary

The focused hosted workflow accepts an exact suite ID only when that suite is present in the selected gate's sealed plan. It prepares only resources declared by that node and its governed adapter. Focused execution emits diagnostic or qualification evidence only; it never invokes the finalizer, emits `RELEASE_GO`, or substitutes for the Mainline Decision.
