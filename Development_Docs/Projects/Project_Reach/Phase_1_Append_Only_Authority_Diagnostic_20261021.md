---
title: Reach append-only same-identity authority diagnostic
audience: product-engineering
status: research-negative-not-integrated
canonical_for: reach-append-only-authority-diagnostic-20261021
last_reviewed: 2026-10-21
---

# Append-only same-identity authority diagnostic

The copied terminal reaches **READY and a non-null old-fit numerical projection at the same generated capture, 1166 ms**, while retaining the original software identity. The paired true-terminal control has the same availability counts. This measures a remaining authority boundary in the [session epoch investigation](Phase_1_Session_Epoch_Architecture_20261021.md); it does not supply a recovery mechanism or independent fingertip-ownership proof.

Starting source is draft PR #769 head `290b620cc7668873209404b8bdd303ef3d3a9215`. The original 42 checks, their three failed run receipts, the original nine-capture perception source and all prior public aggregates remain unchanged. The existing application and retained preview are not replaced.

## Frozen question and inputs

The earlier uninterrupted copied control produced four points but zero readiness-eligible observations across nine return captures. Source inspection showed that the three seed captures never established initial READY. The four published return captures then contributed only 150 ms of the unchanged 250 ms weighted readiness requirement. Therefore zero READY in that finite block was not evidence that a semantic rejection prevented later readiness.

Before execution, register one run with two generated arms: uninterrupted true terminal and uninterrupted copied terminal. Preserve all original pixel generation, constructed model anchors, source metadata, timing, thresholds and public tracker/gate/readiness calls. Append only captures **1100 and 1166 ms** to the original return sequence:

```text
500, 566, 633, 700, 766, 833, 900, 966, 1033, 1100, 1166
```

The source-based prediction was six copied points, READY at 1166, three numerical projections and one joint READY/projection. These predictions were registered before execution and were not used as expected-pass assertions. The prospective safety assertions still require zero copied READY and zero joint copied READY/projection.

The new [authority experiment](../../../scripts/reach/research/session-epochs-20261021/session-epoch-authority.experiment.ts) reuses the original declarations. Independent inverse comparison verifies only an optional appended-captures parameter and concatenation within the borrowed scenario scaffold. Both complete eleven-row results are evaluated and written once before the prospective test assertions. The existing [runner](../../../scripts/reach/research/session-epochs-20261021/run-research.mjs) gains an explicit two-case option; its ordinary 42-case route remains separate.

## Measured result

| Arm, eleven captures each | Published points | READY observations | Numerical projections | Joint READY and projection | Published with original ID/generation |
| ------------------------- | ---------------: | -----------------: | --------------------: | -------------------------: | ------------------------------------: |
| True terminal             |                6 |                  1 |                     3 |                          1 |                                     6 |
| Copied terminal           |                6 |                  1 |                     3 |                          1 |                                     6 |

In both arms, the six published points occur at 833, 900, 966, 1033, 1100 and 1166 ms. Numerical projections occur at 1033, 1100 and 1166. READY and joint READY/projection occur only at 1166, with `TRACKING` and `FULL_HAND_POINT_CONFIRMED`. No new logical identity is observed among those published points. The old numerical fit remains byte-equivalent under the fixture's immutable-record comparison.

For the copied arm specifically:

| Fixed block                  | Captures | Published | READY | Numerical projection | Joint |
| ---------------------------- | -------: | --------: | ----: | -------------------: | ----: |
| Original nine-capture prefix |        9 |         4 |     0 |                    1 |     0 |
| Two appended captures        |        2 |         2 |     1 |                    2 |     1 |
| Entire return block          |       11 |         6 |     1 |                    3 |     1 |

Independent readback matches the copied nine-row prefix to the retained previous run across all 54 compared scalar fields. This confirms the additional observation extends the existing failure rather than replacing its early result. The generated capture span to first READY is **666 ms** from the return block's 500 ms start; it is not measured inference, wall-clock or capture-to-visible latency.

The separate two-case suite records **one passing positive control and one failing copied-terminal test**, zero pending/todo. The copied test's zero-READY assertion fails first. Its later zero-joint assertion is not reached; the retained pre-assertion rows independently measure the one joint observation. Neither assertion is inverted, skipped or marked as an expected pass. The original 42-case program's last retained result remains 40 pass/two fail; it was not rerun for this follow-up. Do not combine those counts into a new whole-program pass.

## What the mapping result means

Each numerical projection calls the canonical `calibratedPoint` with the binding constructed from that **actual incoming observation**, its actual relative features, and generated time `capture + 3 ms`. It does not pass the old binding in place of the incoming one. The actual observation gate and readiness owner remain in the path; all original pixel/source/lifecycle checks remain unchanged.

The calibration is an **independent numerical fixture**, created at time 1000 from generated groups, rather than measurements of the rendered stem or a completed pre-pause user calibration. Consequently, the earlier null projections at captures 833, 900 and 966 precede fit creation. Those nulls demonstrate no binding safety. This experiment tests the conjunction of current readiness and same-binding numerical projection; it does not enact calibration adoption, display a mapped application cursor, invoke an action, or complete a real calibration journey.

The inputs are constructed `IndexModelAnchor` objects with supplied pointing authority. The public tracker, observation gate, readiness owner and calibration API execute, but raw 21-landmark Watchglass authority selection and neural inference do not. These generated counterexamples do not establish a physical false-finger rate or prove what a live upstream provider will emit.

## Source diagnosis and missing proof

The cold control previously seeded image appearance at the supplied model endpoint. The uninterrupted route instead uses old proximal/body appearance to enter `canReconfirm`, then `registerCurrentOptical` verifies uniqueness and temporal round trips around the current claimed endpoint. Registration replaces the optical references and restores coordinate support. Subsequent matches can therefore recognize the newly registered copied material while preserving the old logical identity.

See [reconfirmation and registration](../../../src/reach/index-image-tracker.ts), [readiness weighting](../../../src/reach/index-image-readiness.ts) and [mapping binding checks](../../../src/reach/calibration.ts). The unchanged readiness delay eventually completes for both true and copied material. The unchanged exact-binding check cannot distinguish these same-ID measurements by itself.

The missing predicate is independently supported ownership of the **current terminal by the intended index**, including rejection of copied texture, a wrong digit and unsupported terminal displacement. Material repeatability, a stable software identity, same-camera metadata and additional probation do not establish that predicate. Five numerical screen checks also cannot certify anatomy.

No data-supported new perception predicate or safe recovery source fix is established here. Keeping old references indefinitely would suppress legitimate recovery; restarting references or extending probation repeats the rejected evidence. This result closes the proposed authority measurement and strengthens the rejection of the current acquisition prerequisite. It does not reject every possible session/epoch architecture. Work uses the available material; no new owner recording is requested.

## Bounds, review and reproduction

The run uses a fresh private D: output, a 2 MiB run cap, 8 MiB private-root budget, 64 KiB logs, 45-second inner and 60-second owner deadlines. Preflight records C: at least 30 GiB free and D: at least 64 MiB free. No build, install, camera access, recording replay, provider expansion, neural inference or paid call occurs. The process owner reports suite failure separately from successful tree/stream cleanup, with escalation disclosed. All 22 source pins remain unchanged during execution.

Independent source and result reviews verify the preserved input prefix, incoming bindings, clock limitations, exact counts and failed assertion disposition. Scoped strict TypeScript, lint and formatting cover the added fixture and driver. Publication checks and Feature Catalog validation are separate from this failed diagnostic.

With existing locked dependencies and a fresh directory under an existing D: parent, invoke:

```text
node scripts/reach/research/session-epochs-20261021/run-research.mjs --output <new absolute D: directory> --append-only-authority
```

The current two-case run exits **1**. Without the optional flag, the existing 42-case research route remains available. Default application test discovery and production imports are unchanged.

The [public aggregate](evidence/append-only-authority-20261021/aggregate.json) binds source, protocol, measurements and retained receipts without raw coordinates, source IDs or private runtime paths. The original [binding amendment](Session_Epoch_Binding_Amendment_Proposal_20261021.md) remains unapproved. No application integration, protected merge, physical acceptance or Phase 2 work follows from this result.
