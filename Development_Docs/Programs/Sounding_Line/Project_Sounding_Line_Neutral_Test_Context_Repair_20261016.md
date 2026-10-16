---
title: Sounding Line neutral test context repair
audience: engineering
status: prepared-awaiting-protected-qualification
canonical_for: sounding-line-neutral-test-context-repair-20261016
last_reviewed: 2026-10-16
---

# Consumed failure and demonstrated boundary

[Ordinary3 run38948434772](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38948434772)
is whole-workflow FAILURE on candidate7241f5a8a5965d67882a0b205601eba3087ddef5,
tree28e172e042953fbf8d1bac697f9ad273ce1c637b, accepted base
2e2efa5b8b02e9e5dd0bb0b15d9b23c2f694d7ed and source
8c4a27ed0a7368b56a1552d11fcc0006cb7bb348af18504480c7678c5647fa3f.
Custody passed; focused verification and Mainline Decision failed before build,
technical browser suites or current Experience replay. Its reservation remains
consumed. The failed decision ZIP12068487536 is119107 bytes with SHA256
`3c3bf79e45d7235bbca961243484482bd83aef3c203aa6b4d1e5eeed78526804`.

The trusted workflow exports the real PR721 to the ordinary verifier. Production
buildPlan correctly defaults its PR identity from that environment. Synthetic
Git fixtures in ordinary.test instead omitted their own PR identity, causing
five tests to enter campaign admission before their intended assertions. The
ordinary test blob is identical between accepted main and the actual consumer.
Independent local reproduction with PR721/qualify/GITHUB_ACTIONS=true produced
the same58 tests/53 passes/five APPROVAL_MISSING_OR_INACTIVE failures.

Review found a later synthetic ordinary-CLI diagnostic test with the same
inheritance issue. Maintenance qualification under its own PR number had not
exercised this consumer-specific environment.

## Narrow correction and guard preservation

Synthetic candidate fixtures and all standalone evidence-planner calls now
select explicit PR0. A dedicated negative regression proves that explicit PR721
and the unchanged ambient default still reject an unapproved synthetic campaign.
Synthetic diagnostic children own their neutral PR context and omit inherited
campaign phase/lease/credentials, retaining their deliberately invalid diagnostic
input and original expected failure. The enclosing verifier is unchanged.
Production defaults, execution guards, workflow, product, contracts, registry,
namespace, counters and budgets are not changed by this repair.

Focused ordinary/diagnostic checks passed69 tests under the actual three-field
consumer envelope. Further exact-source review and protected Linux qualification
are required before acceptance.

The first complete frozen-consumer policy check on repair e3a87adad executed all
seven registered entry points:254 tests,250 passes and four failures, no skips
or cancellations,717930ms. This retained result is nonaccepting. One historical/
equal-base fixture borrowed ambient PR721; three R6/R7/R8 fixtures seeded their
fake protected base from the executing checkout's HEAD. In the consumer that
already contained the frozen product, their product interval was empty and the
rebuilt plan failed before the intended missing-artifact assertion.

The historical/equal-base test now owns and restores PR0 locally. The frozen
family fixtures start from accepted2e2 and its configuration, and explicitly
check that this base precedes the frozen product. All original rejection
predicates remain unchanged. The source fixture overlays this repaired policy
entry point too; the complete seven-entry gate must be rerun on corrected source.

## Frozen consumer policy fixture

The opt-in fixture is registered through the existing ordinary test entry point.
It reads the hash-pinned original failure ZIP, creates an owned throwaway7241
checkout, and recomputes the canonical plan using its real ambient PR721, the
original151/source6d/R8 historical projection, six browser selections and eight
obligation groups. Historical downloads are disabled for this source fixture.

Only repaired test files are overlaid after metadata inspection. The canonical
command scheduler receives an injected callback: its registered Node policy
slot executes the actual consumer package's complete registered policy suite
with real tests under PR721/qualify/GITHUB_ACTIONS, final-check and inert run/lease identities,
without credentials. Every application build, database, application-unit and
browser command is recorded as mocked, not executed. No trusted finalizer or
qualification is produced. Synthetic unit fixtures may create their own fake
phase files, subprocesses, owned loopback sockets and in-memory stores; no live authority or consumer
execution is claimed. The consumer's actual checkout and evidence store are
never mutated.

Set SOUNDING_LINE_ORDINARY_CONSUMER_POLICY_FIXTURE, supply the original ZIP through
SOUNDING_LINE_ORDINARY_POLICY_FAILED_ARCHIVE, and place retained logs/receipt
outside the candidate with SOUNDING_LINE_ORDINARY_POLICY_OUTPUT. Clear only the
opt-in orchestrator flag in its child to prevent recursive fixture invocation.
Output is create-only and survives workspace cleanup. Zero external-service and
custody effects are established by audited command routing, not instrumented
network counters; synthetic loopback policy fixtures are separate.

The second complete-suite attempt on repair39eeb155 reached its local780000ms
child deadline without terminal counts or a receipt. Its retained partial output
is incomplete and nonaccepting. TAP's declaration ordering cannot identify the
active test from its last line. The source fixture now retains immediate Node
test dequeue/completion/file-summary events beside unchanged TAP, and writes
terminal child timing/status even on failure. The earlier full run took717930ms
and corrected focused canaries added36223ms; the opt-in local child bound is now
1200000ms with a1500000ms outer bound. This diagnostic margin changes no protected
workflow, authority or consumer execution budget and cannot turn an incomplete
run into acceptance. A complete passing suite is still mandatory.

This repair and its policy fixture do not authorize another consumer invocation.
All failed runs and original proof remain immutable. Proper finite successor
review/installation, a final actual default true-loader/eight-group/history
audit, fresh technical/replay proof, whole protected success and matched-head
merge remain separate gates. No product capability changed; no Feature Catalog
fragment promotion is required.
