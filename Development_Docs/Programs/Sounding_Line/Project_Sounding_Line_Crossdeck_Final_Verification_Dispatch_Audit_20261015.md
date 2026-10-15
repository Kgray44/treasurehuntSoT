---
title: Crossdeck finite final-verification dispatch audit
audience: engineering-owner
status: proposed-inactive-awaiting-owner-decision
canonical_for: crossdeck-finite-final-verification-dispatch-audit-20261015
last_reviewed: 2026-10-15
---

# Finite dispatch audit

This read-only audit binds protected main `48296fbf23b8c90f5ebf9d20ebc85b9d8c824d85`,
frozen Crossdeck product `c9f7f90824bb6003f1ccbc2e93085a523d70fd3d` and inactive
PR 731 head `e56dbdd8723e92ce50631e660140e763ceffdc5b`. Approval is pending.
No runtime, workflow, approved registry, capture, review consumption or qualification
changed. [Source references](evidence/crossdeck-final-verification-dispatch-audit-20261015/dispatch-audit.json)
bind Git blobs and lines. The [complete amended decision packet](evidence/crossdeck-final-verification-dispatch-audit-20261015/exception.amended.proposed.json)
is inactive and grants no approval.

## Count and complete sequence

The second Product Experience pass can be the protected Mainline Decision's own
replay. A third full experience pass is not mandatory if no separate local ordinary
or capturing landed smoke is added. However, ordinary also runs mandatory technical
E2E suites that capture real media before its replay. A literal limit of two physical
browser captures is insufficient.

The proposed unit is **two whole-plan Product Experience passes plus all required
technical evidence inside one protected ordinary invocation**. Each experience pass
selects seven contracts, one generic profile and 32 contexts. This does not mean two
browser contexts or two screenshots. The known fresh route launches at least three
capture-producing browser-authority invocations: preparation, ordinary technical
E2E, and ordinary experience replay.

| Stage        | Allowed action and browser work                                                                                                                                                                        | Exact source on audited main                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Freeze       | First qualify/land the separate mechanism and reconcile accepted infrastructure into 721. Freeze the actual plan and protected base. Focused non-capturing checks and explicit `--plan true` are safe. | `ordinary.mjs:970-999`; `experience-prepare.mjs:49-65`                                        |
| Capture 1    | One main workflow `experience_mode=capture` calls the real runner once for the generic profile and complete 32 contexts.                                                                               | `experience-prepare.mjs:77-83`; `experience-browser.mjs:495-550`; ordinary workflow `:81-106` |
| Review 3     | Reserve/issue the original packet to the one remaining independent reviewer. Authenticated `review` and optional `verify` modes validate artifacts without a browser.                                  | `experience-prepare.mjs:103-150`; `experience-attestation.mjs:38-145`                         |
| Qualify      | One protected ordinary invocation executes selected technical E2E work, then its fresh 32-context experience replay. That replay is experience pass 2.                                                 | ordinary workflow `:212-217`; `ordinary.mjs:1080-1150,1286-1294`                              |
| Merge        | Exact qualified head, unchanged protected base and strict required Mainline Decision. Merge launches no capture; installed workflows have no push/merge trigger.                                       | ordinary workflow `:4-7`; `AGENTS.md:6-7`                                                     |
| Landed smoke | Compare landed/candidate trees and exact receipts; run bounded non-browser unit/input checks. A browser capture is not mandated by quick-smoke guidance.                                               | `AGENTS.md:7`; `.agents/product-experience-workflow.md:76-85`                                 |

All helper filenames above are under `scripts/sounding-line`; the ordinary workflow
is `.github/workflows/sounding-line-ordinary.yml`. No extra local manual capture
is included. The generic local-capture step in
`Development_Docs/Testing/Product_Experience/README.md:57-66` must be explicitly
displaced by the single trusted preparation pass for this campaign; prior local
attempts remain historical support. A local full `test:changed`, `test:release`,
`validate`, direct ordinary, or direct experience helper would add work.
Manual capture, `--replay`, `--run-server` and the exported capture API are real
entry points (`experience-browser.mjs:242,444-492`), not additional campaign slots.

## Technical media remains mandatory

The [read-only frozen-source projection](evidence/crossdeck-final-verification-dispatch-audit-20261015/frozen-source-projection.json)
selects six suites: Crossdeck refit, recovery, Phase 1, Phase 2, Homeport Phase 2
and Reach laboratory. Its historical base is explicit; it is not a current executable
candidate or qualification. Recompute/freeze the actual plan after reconciliation.
Unexpected selection holds for review; do not silently drop required tests.

On a complete fresh successful projected run, frozen source explicitly requests
at least 69 screenshots, six videos and six traces before experience replay:
refit 34 screenshots, recovery 11, Homeport 20 and Phase 1/2 four. These are
source-derived counts, not observed execution. Explicit refit/recovery recordings
remain active despite default-capture settings being off. Failure media and global
retain-on-failure recording may add more. Reach's extra screenshot helper is
conditional on `REACH_CAPTURE_ROOT`.

Exact c9f7f908 sources under `tests/e2e`:
`crossdeck-experience-refit.spec.ts:27-72,87-274`;
`crossdeck-refit-recovery.spec.ts:50-106,148-357`;
`homeport-phase2.spec.ts:189-190,260-690`;
`crossdeck-phase1.spec.ts:17,145-160`;
`crossdeck-phase2.spec.ts:26,318-332`; `reach-laboratory.spec.ts:24-31`.
All selected tests and media stay intact. Ordinary may reuse only normally valid
obligations (`ordinary.mjs:646-707`); no cache hit is assumed or manufactured.
Final experience replay is outside that cache and fresh on every ordinary invocation.
Generic setup performs database/build work, with no browser fixture arguments
(`browser-suite-profiles.mjs:26-40`). Separate synthetic control-plane fixtures
are not consumer evidence or permission to run the frozen product again.

## Binding and mainline serialization

Raw c9f7f908 has merge-base 4baa39af with current main and does not descend from
48296fbf. It cannot be dispatched as the current final candidate. Land the approved
mechanism and reconcile accepted infrastructure first, without product/configuration,
dependency or history drift. Compute the actual new full source digest and plan.

Pin that installed base through preparation, review, ordinary and merge.
Manifests require equal base and source/contract digests
(`product-experience.mjs:620-625`; `experience-attestation.mjs:38-53,99-103`).
Strict protection also requires an up-to-date branch. Any protected-main advance
can invalidate provenance even when product bytes stay fixed; hold this finite
campaign rather than automatically reconcile/recapture. Other work may remain
isolated while this integration lane is serialized.

The full digest includes scripts, tests, package/configuration and testing registries
(`product-experience.mjs:395-420`). Changes after capture invalidate its packet.
Only allowed evidence/record commits with unchanged digest and exact reviewed bytes
may follow capture. Preserve all eleven prior attempts and immutable history blobs;
append new verification and technical events separately and truthfully.

## One-use, failure and exact review reuse

Reserve capture, review 3 and ordinary execution before their work with authenticated
monotonic custody bound to the exception digest, current base/source/contract and
run ID/attempt. A consumed reservation is not refunded for failure, cancellation,
missing uploads or expiry. Failed preparation, technical suite, final replay, later
final-job step or invalidated packet stops; it authorizes no new ordinary run,
capture or reviewer.

Keep 721 draft through its last evidence commit, verify the remote head, then choose
one protected final trigger. Ready, synchronize, reopen and manual dispatch can each
launch ordinary; concurrency queues rather than deduplicates (workflow
`:5-7,45-47,131`). Reject reruns/extra triggers before browser work. Project
configuration has no retry override; its locked runner defaults retries to zero.
There is no hidden automatic replay loop.

Failed/cancelled preparation artifacts cannot establish trusted capture:
attestation requires a successful run (`experience-attestation.mjs:51`).
The identical sealed accepted review-3 packet may be non-executingly revalidated or
republished until expiry, with the same successful capture/artifact identities and
bindings. That is neither another independent review nor an ordinary rerun.
Changed review bytes, expiry, lost/invalid provenance or blocking findings stop;
review 4 and a new repair remain forbidden. Do not issue generated stage-2
review-packet files to another reviewer.

Expiry remains `2026-10-22T23:59:59Z`. All product evidence, independent review,
ordinary protection and separate owner acceptance gates remain. Exact amended owner
approval and separately reviewed/qualified enforcement are required before execution.
