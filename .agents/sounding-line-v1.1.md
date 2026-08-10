# Sounding Line v1.1 enforcement

The governing authority is the preserved Sounding Line v1.0 charter plus the
Part I, Part II, and Part III v1.1 amendments in
`Development_Docs/Governing/`. Where an amendment explicitly conflicts with
v1.0, v1.1 controls. This is active automation guidance.

## Before repair or validation

1. Classify the change and any failure before mutation: `PRODUCT_DEFECT`,
   `TEST_DEFECT`, `STALE_TEST`, `ENVIRONMENT_DEFECT`,
   `INFRASTRUCTURE_DEFECT`, `INFRASTRUCTURE_CONTENTION`, `TIMEOUT`, or an
   accurately unavailable external condition.
2. Select the smallest legal repair boundary for that classification. Do not
   change a test to hide a product defect, change product behavior to cure a
   test or environment defect, or delete a lock/bypass a queue to cure
   contention.
3. Determine semantic invalidation from producer, consumer, contract,
   fixture, policy, resource, and environment dependencies. A changed SHA,
   regenerated index, receipt wording change, or unrelated main advance is not
   sufficient by itself.
4. Create a source-bound carry-forward receipt for evidence that remains
   `PRESERVED`; keep the original receipt immutable. Mark evidence
   `INVALIDATED`, `REBOUND`, or `SUPERSEDED` accurately and rerun only the
   invalidated obligation.

## Invalidation and convergence

- A test-only change is capped at its changed family and direct evidence
  consumers unless a written dependency explanation proves broader impact.
  Do not run a full repository, browser, or release matrix as a reflex.
- Once every invalidated mandatory obligation has valid fresh or preserved
  evidence, converge to closure. Additional reruns require a changed semantic
  dependency, changed gate requirement, evidence-integrity failure, or a
  closure-revalidation incident.
- Treat receipt digest mismatch, missing artifacts, contradictory finalizer
  inputs, unverified carry-forward, a late root failure, or a contradictory
  reference-environment result as a closure-revalidation incident. Reopen only
  the affected decision boundary. No semantic incident means no reopening.

## Shared validation and environments

- Use the broker queue for scarce browser, build, database, provider, scanner,
  and restart-host resources. Do not negotiate order in chat, seize another
  run's lease, delete lock files, or bypass waiting work.
- Preserve active work, use fairness age to prevent starvation, allow only
  compatible fully isolated lanes to run concurrently, and hand off after
  verified cleanup. Check source identity immediately before expensive
  acquisition; cancel and replan stale requests outside the scarce lane.
- Keep queue, setup, execution, teardown, and finalization time separate.
  Local contention is environment/infrastructure evidence, not a product
  failure. Use a clean hosted/reference environment for timing-sensitive,
  capacity, browser, and provider claims. External absence is unavailable or
  blocked, never passed by substitution.

## Record-only closure

For documentation, index, receipt, evidence-record, or catalog-status work
that does not alter executable product or release-gate semantics, run the
smallest authoritative document/index/policy checks and generator output. Do
not start product/browser/release matrices without a proven dependency. Keep
generated indexes and the Feature Catalog generator-owned; report the catalog
status exactly as required by repository governance.
