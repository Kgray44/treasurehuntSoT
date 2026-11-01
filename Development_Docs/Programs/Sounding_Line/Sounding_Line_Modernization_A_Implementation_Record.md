---
title: Sounding Line modernization A implementation and qualification record
audience: engineering
status: in-progress
canonical_for: sounding-line-modernization-a-implementation
last_reviewed: 2026-10-31
---

# Modernization A: reliability, cost containment and merge integrity

This increment implements A and its A0 transaction boundary. B depends on A's
landed execution identities; C depends on B's complete logical evidence model.
This record is not qualification, owner acceptance or a release decision.

## Source and incident boundary

The October 25 audit used protected main
`696ecec0fd89293074b271ab33d9256709158700`. Implementation refreshed protected
main at `f7ef7de4b606eec734d04eeaed316fea959cf80e`, then reconciled the complete
landed #805 tree at `809b6d54025fb66000960f30dc750b44ee056d49`. The only shared
index conflict was resolved from that landed index plus A's single new record;
all #805 records, assets and metadata were preserved. The source-bound incident
proposal remains [PR #819](https://github.com/Kgray44/treasurehuntSoT/pull/819),
original candidate `ee7f6b68173fdaa9a726db824fb5184a35fc1df1`.
Its failed [run 40541578392, attempt 2](https://github.com/Kgray44/treasurehuntSoT/actions/runs/40541578392/attempts/2)
is retained. No retry reclassifies that failure.

The #776 incident remains `REQUIRED_PROTECTED_DECISION_MISSING`. Existing capture,
review ordinals, original candidate identities, owner restrictions and 48 deferred
authored/photo states retain their existing scope. This work grants no historical
or post-merge `RELEASE_GO`. PR #805 and its owner workspace are excluded.

## Implementation

- Ordinary transport fetches exact source ancestry and the installed typed reader
  closure through the existing supervised checkout engine. Base/candidate
  snapshots remain complete. Missing objects fail closed; late transport remains
  disabled. The #721 and #776 finite selectors retain their installed routes.
- Authority checkout materializes scripts, policy and the existing finite
  controller's local reader files. The independent fixture compares actual file
  bytes and module imports with a full checkout after disabling transport.
- Ordinary preflight binds protected authority, candidate/tree, controller bytes,
  policy and runtime. It checks bounded inputs, ancestry and disk availability.
  Command transport is checked before execution, retaining whole obligations.
- An external asynchronous supervisor contains synchronous hangs using the
  existing Linux/Windows process ownership implementation. It debits actual setup
  time from the current job/attempt and reserves two minutes for finalization.
  Existing finite job ceilings remain separate. Command timeouts retain their
  original cause; cleanup and retention failures remain distinct.
- Supervision receipts are create-only and explicitly non-qualifying. Unknown
  CPU, child memory, fresh/reused-work and billing measurements remain unavailable.
  An evidence-publication failure retains a fixed-shape original-outcome fallback
  in Actions logs. Completed-obligation authority is unchanged.
- The required decision job explicitly fails when custody or verification did
  not succeed, including draft-triggered skipped work and draft conversion. Its source/readiness gate
  rechecks the exact live PR transaction. A protected dispatch uses its actual
  event input; candidate-written dispatch claims confer no authority.
- The owner-side merge client independently checks the successful app-15368
  decision, workflow, run/attempt, head/base, readiness history and live strict
  server protection. It requires administrator enforcement and an audited ruleset
  state, rereads before merge, supplies an exact-head server compare-and-swap,
  and checks observed merge parents. Failure never triggers another merge attempt.

The existing finalizer and `Sounding Line / Mainline Decision` remain authoritative.
New generic artifact inheritance and preparation/transport optimizations are not
activated by A. They start in shadow mode in their dependent increments.

The authority action uses its native sparse-checkout input. In the inspected
[checkout v4 source](https://github.com/actions/checkout/blob/v4/src/git-source-provider.ts),
sparse checkout selects the blob filter during fetch; an explicit filter input
would take precedence. The fixture tests both missing media and complete readers.

## Measured development evidence

| Observation                                       | Result and scope                                                                                                                                                                               |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Historical authority fetch, #819 attempt 2        | 518.703 seconds                                                                                                                                                                                |
| Historical candidate checkout, same attempt       | Timed out at 600 seconds while fetching all branches/tags; custody and verification did not execute                                                                                            |
| Existing selected-checkout regressions on Windows | 19 passed, one existing platform skip; 304.071 seconds; includes exact ancestry, omitted unrelated refs, stalls, cancellation, long paths and missing-object attacks                           |
| First authority parity fixture                    | Preserved failure: cone mode intentionally includes root files; fixture media moved under `public/`                                                                                            |
| Corrected authority parity fixture                | 134 files byte-equivalent; full 3.055 seconds, sparse 3.920 seconds; 1 MiB synthetic media omitted with transport disabled; fixture-only, no hosted speedup claim                              |
| Reliability focused tests                         | External synchronous-hang containment, detached listener cleanup, command timeout cause, retention failure, source drift, job-clock debit and merge races passed                               |
| Existing Windows verifier/diagnostics run         | 210 passed, 13 failed; the same 13 failure reasons reproduced on exact protected main and candidate `b42cf7ccb273f67112ffda28634366c8c5f5c204` in the same runtime with isolated fixture state |

Original logs and failed fixture source are retained privately with SHA-256
receipts. The matched baseline does not turn any failed assertion into a pass.
Linux protected qualification remains required. Test counts do not establish
billing savings or human/product acceptance.

## First protected qualification and focused repair

Candidate `8c1d76b7aff8fe369c31de3a34f0fca9967b0b8a` against protected base
`809b6d54025fb66000960f30dc750b44ee056d49` failed ordinary run
[41255214433/1](https://github.com/Kgray44/treasurehuntSoT/actions/runs/41255214433).
The control-plane regression step reported 11 failures among 1,067 tests; the
Mainline Decision failed closed.
No merge or protection-setting change followed. The original 417,864-byte failed
job log has SHA-256 `cd1eab96bfdb70486608cb032df70e6e81bba2d6927767041ebd6aa2f2114aa1`.

That run executed the existing protected-base checkout workflow, not the proposed
checkout changes. Custody authority/candidate checkouts took 423/174 seconds;
verification authority/candidate checkouts took 426/175 seconds. These are
pre-installation observations and do not establish modernization savings.

Focused repairs authenticate the supervised exporter and all seven supporting
modules against installed bytes, protected Git identities and provider blobs.
They retain the legacy exporter route, opaque proof, exact candidate binding and
fresh browser obligations. Substitution of each supervisor module is rejected.
Checkout assertions now require the bounded ordinary helper and sparse authority.

The R3 fixture also failed unchanged on exact protected base `809b6d54` and the
candidate. Its synthetic historical base inherited later runtime assets and
configuration. The fixture now reconstructs the recorded historical closure and
frozen configuration before exercising admission. The production freeze remains
unchanged, and an unlisted public asset is explicitly rejected. Original failed
reproductions remain retained alongside the repaired test receipts.

## Protected integration and installed-path correction

PR [#821](https://github.com/Kgray44/treasurehuntSoT/pull/821) qualified exact
candidate `083bb327042d472a87d687bbf13d6e005399d114` on base
`809b6d54025fb66000960f30dc750b44ee056d49` in run `41258855297/1`, required
Mainline Decision `124715022477`. Administrator enforcement strengthened from
false to true; every other protection field, strict app-15368 decision, owner
permission and ruleset state remained unchanged. The frozen source-bound guard
performed the actual server merge to `cf1e5ad78b3e2b633d4ed691f396a4bab0191217`,
verified those exact two parents, and observed tree
`38fe042789fd18983c5f364e604e1b26a0f8d25c` equal to the qualified candidate tree.
The quick landed smoke passed 13/13 tests in 256.9187 ms. Original provider
response and sanitized immutable transaction receipts are retained. This is real
protected integration proof, not product/device acceptance.

The first genuine installed-A #819 run `41262595666/1` checked exact candidate
`12887b28fab42c18cc5601c1a28165c0fee2d70c` on base `cf1e5ad7`. Custody checkout
took 145,404.861 ms; verification checkout took 146,858.238 ms, with one hydration
fetch and 19,244 required blobs (9,157,307,346 bytes), nonshallow. These are partial
checkout observations, not successful end-to-end acceptance or billed savings.

That run failed CLASSIFICATION with ENOENT before verification commands: the
supervisor changed cwd to `candidate` but forwarded relative `--workspace
candidate`, causing the child to resolve `candidate/candidate`. Its supervisor
terminal receipt (artifact `13066335151`) has SHA-256
`0de13cf2f6198134c8f717b75fbec1131e9446d5f44dd40339f281a62287169a`; the child
exited 1 and owned cleanup succeeded. The failed required decision remains failed.

The corrective adapter normalizes the workspace once, then uses that identical
absolute root for preflight, guardian cwd and child argv. A real-child regression
reproduces the original nested decision/ENOENT and proves the repaired invocation
writes its canonical decision in the intended repository. It still rejects a
forbidden control-plane candidate before executing tools. Existing source binding,
job-clock debit, timeouts, failure retention and protected merge authority remain
in force. A fresh prepared corrective PR must qualify and land before #819 retries.

The corrective PR [#828](https://github.com/Kgray44/treasurehuntSoT/pull/828),
original candidate `6fc44839424cf3d1e3ed18c0912322718a64db0a`, failed ordinary
run `41263942352/1`: 1,063 regression passes, nine failures and four skips. Its
original 241,274-byte log archive has SHA-256
`cadbbc5e63c7e2aca5d8b033d91f41104e3e637f7af65d627cc69af49e5bfd74`.
The missing historical script and unit-test payloads were test-data assumptions
outside the installed runtime reader predicate. No failed decision was waived.

The follow-up includes a 95,661-byte, 29-object blob-only test fixture with SHA-256
`36be0bca3bddeb464cecc110ef16befe48339c63aa841ec29a1f634fa68660b2`.
The importer verifies that digest, the exact object count/type/set and each
original revision/path identity. It imports no commits, trees, refs, ancestry or
release authority. R3 and R4–R8 synthetic tree construction permits missing
unread historical payloads while retaining their exact object IDs; production
admission and every positive/negative assertion remain unchanged. The local
selected-reader reproduction disables transport during testing. Its intentionally
omitted declared media pins are recorded separately from the hosted failures;
they cannot establish a passing full checkout or a qualification result.

All nine affected regressions subsequently passed against the existing full
object store in 215,801.4791 ms. Five adversarial manifest mutations were denied:
omitted/substituted origins, altered size, altered pack metadata and object-set
substitution. Independent review cleared the fixture-integrity and synthetic-tree
scope after pinning all 32 origin rows with canonical mapping digest
`3c434f3fe45d4ab0bbf9f620426f51ea861474ca0ed700ab4edd8487de2ab040`.
These focused development results prepare the next candidate; they do not replace
its required protected check.

The ordinary ten-minute objective and fifteen-minute governing ceiling remain
the performance target. A retains the installed job ceilings while debiting setup
and bounding execution; it does not claim those targets have already been met.
Any measured overrun requires an explicit candidate-specific disposition.

The task's single additional workspace has an explicit owner-authorized admission
exception. Both drive reserves and the twelve-GiB workspace peak remain in force;
the stored aggregate policy was not raised. Preserve receipts and retire the
workspace through the lifecycle manager when the modernization is complete.

## Narrow documentation transport evidence

The supervisor correction landed through #828 at protected main
`caf86f42461201db8e6fe88e46a69c7c9e347d25`. Candidate
`9dce420b88c00ab05460343825f67125dbcc703f` passed run `41266980290/1`,
including required decision `124734223684`; the landed smoke passed 21/21.
The subsequent #819 candidate `4a74675f93bcc7b98f5eddcb6e4801624dc86c71`
failed run `41268135076/1` at the unchanged ten-minute checkout ceiling.
Its original logs and failed decision remain retained. Its structured checkout
receipt was not uploaded by the installed workflow and is unavailable.

The additive transport profile covers regular documentation Markdown and the
exact document-index path while keeping the existing 635-file application
selection and commands. Verification retains all source/config/public/fixture
bytes and historical reader pins. Only unchanged archival media payloads are
omitted. Unknown reader, policy, extension, mode or source drift uses full checkout.
Finite #721/#776 routes retain their existing restrictions.

An immutable reviewed ancestor certificate pins allowed transport files by mode
and blob identity. The profile's own comparison permits one bootstrap certificate
literal to differ; all other code, mode and whitespace stay exact. A cold runner
explicitly fetches, verifies and retains that exact tree-pinned certificate blob.
Certificate-only readers cannot suppress an existing historical source reader.
Evidence-authority files have no drift exemption.

Custody uses complete Git ancestry/path metadata and the unchanged contracts,
exception registry and attribute bodies. A bounded child with no token or output
channel and all Git protocols disabled runs the original memoized campaign
comparison before any omission. Positive or uncertain reaped results use full
checkout before the original reservation executes. Global deadline, cancellation
or cleanup failure stops checkout. This precheck writes no reservation or decision.
Every checkout job retains its available exact receipt after every outcome.

Local development measurements bind these original source identities:

- At base `caf86f42` and candidate `4a74675f`, the exact required blob closure is
  9,157,454,315 bytes full versus 2,137,161,378 bytes selected, avoiding
  7,020,292,937 bytes. The reconstruction matches the original native manifest
  digest `6bc65659377baa09b727cd1d45bae6f11ae25776dde647c8f864455438eaa2fc`
  from failed whole run `41262595666/1`; its successful checkout aggregate is
  retained without changing that run's failed outcome. The 110 shared historical
  blobs total 47,642,355 bytes and were independently verified after bounded fetch.
- Formatted candidate `59873eb96b2e9700e25c6d255f6661d845cf4d9f`, tree
  `09ea6c3c7d6de86b21f645e37adab86f70ae7a1f`, is the exact formatting-only
  child of `4a74675f`. Its local selected verification transported 1,474,867,960
  pack bytes in 133,002.331 ms. The reviewed custody precheck preserved all 49
  metadata/attribute paths and 14 requested root inventories, transporting
  6,077,096 pack bytes in 32,095.7805 ms. These file-transport observations do not
  establish hosted throughput or billed savings.
- Full/selected plans and commands match. Sixteen direct filesystem-reader files
  pass the same 248 assertions in both layouts. Prisma and cold TypeScript pass
  both; the original-head formatter failure matches both and the corrected head
  passes. The complete corrected-head selection ran all 635 files: 4,489 passing
  assertions and seven existing pending cases. An initial repository-local temp
  configuration failed private-storage safety checks; the unchanged fifth batch
  passed with bounded external scratch, whose generated data was hash-preserved
  and whose directory was released. Original failed receipts remain retained.

Independent adversarial development coverage includes source/mode/blob drift,
positive and copied-contract campaign fallback, uncertain/failed probe outcomes,
cancellation and process cleanup, missing certificate denial, locked late
transport, immutable historical pins and failed-receipt upload conditions.
These development receipts provide preparation evidence. Protected qualification,
guarded integration and landed verification retain their existing authorities.

Independent source review cleared shadow commit
`cebc17eb9d6c79cdab72c7ad698592ce6f684f2f` for preparation of the ACTIVE
bootstrap. The immutable bootstrap contains ACTIVE with certificate PENDING;
its final child changes only the certificate literal. Installation follows the
ordinary protected check, guarded merge transaction and landed verification.
