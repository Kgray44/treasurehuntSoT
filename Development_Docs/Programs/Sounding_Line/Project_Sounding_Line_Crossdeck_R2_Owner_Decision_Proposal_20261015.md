---
title: Crossdeck R2 finite verification owner decision proposal
audience: engineering-owner
status: proposed-inactive-awaiting-owner-decision
canonical_for: crossdeck-r2-owner-decision-proposal-20261015
last_reviewed: 2026-10-15
---

# Pending owner decision

**KG decision: PENDING.** This is a proposal-only engineering record for review. It grants no execution authority and changes no installed exception, validator, workflow, custody ref or consumer branch. The proposed unique exception ID is `PE-X-CROSSDECK-FINAL-VERIFY-20261015-R2`, with proposed namespace `sounding-line-exceptions/PE-X-CROSSDECK-FINAL-VERIFY-20261015-R2`. Neither is implemented or reserved.

The [Section 24.2 temporary-exception rule](../../Governance/Voyagewright_Global_Product_Governance_Standard.md#242-temporary-exceptions) requires an exact rule, reason, affected scope, risk, controls, owner approval, expiry and removal plan. Those fields appear below and in the [unchanged inactive proposal snapshot](evidence/crossdeck-r2-owner-decision-proposal-20261015/inactive-proposal.snapshot.json). The snapshot is supporting engineering evidence, outside the active `testing/` registry. Its SHA-256 is `84c97c516822f7bedc724598205cb32cefaeae72fa0649660739b5a772e638dd` (52822 bytes). The original local JSON and failed artifacts remain unchanged.

| Decision field                     | Current value                                                      |
| ---------------------------------- | ------------------------------------------------------------------ |
| Proposed owner                     | Kgray44 / KG                                                       |
| Owner approval                     | **PENDING_NEW_EXPLICIT_KG_DECISION**                               |
| New direct human decision ID       | Not supplied                                                       |
| New approval time / proof          | Not supplied                                                       |
| Coordinator                        | `01a13dd0-e3e1-7409-ab2a-b078e08ff0e1`                             |
| Owner implementation chat          | `01a13d1d-9489-73f3-94df-1122ba234d14`                             |
| Authorization for this publication | Coordinator's bounded documentation handoff only; no R2 activation |
| Expiry                             | **2026-10-22T23:59:59Z**, unchanged; no extension approved         |

# Exact rule and proposed exception

The standing [Product Experience workflow](../../../.agents/product-experience-workflow.md) stops repeated repair at three iterations or no material progress. Crossdeck's eleven historical repair/recapture attempts remain an explicit overrun. The [original finite control-plane record](Project_Sounding_Line_Crossdeck_Final_Verification_Proposal_20261015.md) allowed one preparation; its custody rule is `failedCancelledMissingOrAmbiguous=STOP_WITH_CONSUMED_RESERVATION`. That preparation failed and is consumed. Existing helper-repair authorization supplies no consumer retry or refund.

The proposed R2 exception would grant exactly one distinct final-verification sequence for the same frozen product and contracts after the helper correction. It would require a new direct, source-bound KG decision and a separate independently reviewed protected authority amendment before any consumer reconciliation or execution. Changing only an ID, namespace, approval date or registry metadata cannot authorize it. The original installed record remains byte-identical, including its declared ACTIVE status; immutable custody consumption prevents reuse. A future protected transition could retain it as historical consumption without deleting or refunding it.

The requested decision would cover only the narrow authority amendment needed to enforce the bounded grant below, with all acceptance and permission boundaries retained. It would not authorize product repairs, automatic retries, an additional review round or a security/privacy exception.

# Consumed predecessor and failure evidence

Protected [preparation run 38760343298](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38760343298), attempt 1, concluded **failure** after 25 of 32 context results. The fresh reduced-motion context reused sign-in cookies but skipped declared device registration and purpose setup; preserved media shows authenticated “Reconnect this device” before the Journal witness timed out. This is classified as a preparation helper fixture setup defect, not established product failure. The remaining seven contexts are unverified. Partial diagnostic artifacts are not trusted accepted capture evidence. The [source-bound failure classification](evidence/context-setup-replay-20261015/failure-classification.json) preserves the installed gate rejections.

| Predecessor identity   | Exact value                                                                       |
| ---------------------- | --------------------------------------------------------------------------------- |
| Exception ID           | `PE-X-CROSSDECK-FINAL-VERIFY-20261015`                                            |
| Record content digest  | `bf11c0852ca133e6446216d1268c091d2fb4a7c2535523a5921253883ec050b0`                |
| Protected base         | `9983c900875ffa116e7945318823e93e6e94348b`                                        |
| Consumer candidate     | `f000118d1cddeb5f0e6f79c59c9ef076862de93a`                                        |
| Consumer tree          | `c3523d02e5c6a62485cfc521dfae557535577ec5`                                        |
| Source digest          | `9ec365cdf6b880982344d2ea513da82824c6d2c6d0743a17fb89c180afe67ce4`                |
| Contract digest        | `8c8d5ddbc67e23f784e4465067973e2eb9d5f3d8d95bf44c646de4079cdb306d`                |
| Prepare ref            | `refs/tags/sounding-line-exceptions/PE-X-CROSSDECK-FINAL-VERIFY-20261015/prepare` |
| Prepare commit         | `2706b52f12fc167434b03ff8e6fb7d3198db8d62`                                        |
| Run / attempt / result | 38760343298 / 1 / failure                                                         |
| Disposition            | `CONSUMED_FAILED_IMMUTABLE_NO_REFUND`                                             |

| Diagnostic artifact                   | ID          | Original SHA-256                                                   |
| ------------------------------------- | ----------- | ------------------------------------------------------------------ |
| Partial capture; not accepted         | 11985629215 | `fd37ca0660cb16da4d08f42027b567e02444c051e1b90f485b3e74aef3e84516` |
| Lifecycle diagnostics; not acceptance | 11986936084 | `a5389f04dca104282e52e08ab4ffdaa36d47a1244903432d6c42ae08cb148324` |

Only the predecessor prepare ref exists. Capture, review-submit, completed review 3, qualify and qualified seals were not issued. The installed successful-reservation gate rejects `PRODUCT_EXPERIENCE_EXCEPTION_RESERVED_RUN_NOT_SUCCESSFUL`; trusted artifact admission rejects `PRODUCT_EXPERIENCE_ATTESTATION_PROVENANCE_INVALID`. R2 must preserve these facts, the failed artifacts and their original identities. It must not reinterpret the earlier cancelled lifecycle capture or this failed preparation as successful.

# Honest history and one-use budget

| Accounting fact                                            | Count / boundary                              |
| ---------------------------------------------------------- | --------------------------------------------- |
| Historical repair/recapture attempts                       | 11, unchanged                                 |
| Failed finite verification preparations                    | 1, original run 38760343298                   |
| Total prior executed attempts                              | **12 = 11 + 1**                               |
| Next preparation, only if authorized and actually executed | Becomes total 13                              |
| Completed independent product reviews                      | 2                                             |
| Proposed remaining independent review                      | Ordinal 3, once, after new successful capture |
| Review 4 / new product repair                              | 0 / 0                                         |

The versioned successor history would retain legacy repair count 11 and separately expose the failed verification preparation, aggregate prior total 12 and any actual new execution. Review ordinal 3 is not an attempt counter.

| Proposed entitlement                                                 | Limit                                                             |
| -------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Original protected preparation                                       | 1                                                                 |
| Remaining independent review 3                                       | 1                                                                 |
| Authenticated review submission                                      | 1                                                                 |
| Protected ordinary Mainline Decision invocation                      | 1                                                                 |
| Whole-plan Product Experience replay inside that ordinary invocation | 1                                                                 |
| Selected technical E2E screenshots, videos and traces                | All mandatory obligations retained inside the ordinary invocation |
| Additional local consumer captures / local full ordinary or release  | 0 / 0                                                             |
| Reruns / refunds / product repairs / review 4                        | 0 / 0 / 0 / 0                                                     |
| Capturing landed smoke                                               | 0; only bounded non-capturing smoke after successful integration  |

Preparation plus ordinary replay are two proposed Product Experience passes. Mandatory technical E2E media is additional work within the single ordinary invocation; this proposal makes no “two physical captures” claim. Any failed, cancelled, ambiguous, missing-publication, rerun or expired R2 attempt would stop with consumption preserved.

# Landed helper and provisional source binding

[Helper PR #737](https://github.com/Kgray44/treasurehuntSoT/pull/737) landed at 2026-10-15T16:25:14Z. Its independent review approved the exact source and verified three source hashes and 32 browser artifact hashes. [Protected Linux qualification](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38767584721) passed 164 Sounding Line regressions, 12 rendered fixtures, all required repository checks and Mainline Decision. Landed non-capturing smoke passed 4/4. The [landing receipt](https://github.com/Kgray44/treasurehuntSoT/pull/737#issuecomment-6196988234) distinguishes helper proof from consumer acceptance.

| Binding                                  | Exact value                                                        |
| ---------------------------------------- | ------------------------------------------------------------------ |
| Landed helper / projected protected base | `670706e875eeac61031f08f69595db2dc9a81879`                         |
| Landed helper tree                       | `e55b4f39b7595002fe5f546fe0c995fba06a73db`                         |
| Independently reviewed helper candidate  | `249aabcd0f8b03e7eb9ca14b5cdda94dd31d304e`                         |
| Helper qualification run                 | 38767584721                                                        |
| Projection input consumer                | `f000118d1cddeb5f0e6f79c59c9ef076862de93a`                         |
| Temporary projected candidate            | `91bc38e88dc3ec3584405772651efe82c86cdd28`                         |
| Temporary projected tree                 | `cbe67dfa4190b829e8e9b380b7aeb5df09d36f93`                         |
| Post-helper projected full source digest | `1ddab2add6abd9659e8140d498c84bbb4af8434cf359ea6c40164b218122e54a` |
| Unchanged projected contract digest      | `8c8d5ddbc67e23f784e4465067973e2eb9d5f3d8d95bf44c646de4079cdb306d` |

This is a **read-only temporary Git projection**, not a current remote #721 head, final consumer freeze, published consumer commit or executable R2 binding. It overlays the landed helper delta onto the failed candidate's frozen runtime without changing a consumer worktree or branch. Canonical `planProductExperience` and `selectAffectedTests` used projected Git inventory; actual consumer `buildPlan` filesystem validation remains required at any separately approved freeze. The helper base was protected main when projected; this document does not reserve that base against future changes.

Future validator/authority script changes affect the full source digest again. The separately approved authority amendment would therefore need protected installation before a fresh actual base/head/tree/source/contract/selected-plan freeze. Any changed base or full source invalidates earlier bindings. The new exception record's own content digest must also be bound separately. Neither this projection nor the old source digest can authorize a later run.

# Frozen scope and preserved ledger identities

The frozen product reference remains `c9f7f90824bb6003f1ccbc2e93085a523d70fd3d`. Configuration, dependencies, seven contract objects and all immutable ledger blobs remain fixed except the already enumerated protected-base runtime normalization. The snapshot contains the complete frozen configuration blobs and runtime override list; no additional runtime override is proposed here.

| Frozen product tree | Identity                                   |
| ------------------- | ------------------------------------------ |
| `src`               | `0a455ccc3653b4fc672fa038b849f0392889b007` |
| `public`            | `c83c10066b6513478c9e4398f39b1f19b1c45678` |
| `prisma`            | `a6352d94b93ffe8a12636f38b054a98a627fa4e4` |

| Immutable history path                                                                                                                 | Git blob                                   | SHA-256                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------ |
| `Development_Docs/Testing/Product_Experience/evidence/crossdeck-refit-b53291133625/repair-ledger.json`                                 | `16a58def6f5c63af155af67e4f06d615b055ae36` | `d9d411dc943a0238ad48c03db34087006a43c645140216a1f73af4dc4ec014a3` |
| `Development_Docs/Testing/Product_Experience/evidence/crossdeck-refit-reach-entry-restoration-20261012/correction-ledger-current.json` | `c2dfed3b053d484a1522d57e269eade9530bb405` | `d65447ca9e1d71b3734a203649031b2f27bb9aa4c21d962182b46a1411c0cfcb` |
| `Development_Docs/Testing/Product_Experience/evidence/crossdeck-refit-reach-entry-restoration-20261012/terminal-capture-receipt.json`  | `d995554f708a2d5b3134912e46d2f8f74cdf3b4d` | `93f5c64f35365ab5ad4b8dd9c5d78f7fbf483eff7e525dfc277b98a5c84c5368` |

There are seven contracts, 14 declared route entries, nine journeys and 32 device/role/motion contexts. The original route entries include query-specific synthetic fixture destinations; they are not 14 distinct route templates.

| Contract                                    | Journey                                           | Role      |
| ------------------------------------------- | ------------------------------------------------- | --------- |
| `reach.phase1.foundation`                   | `absolute-calibration-and-recovery`               | ANONYMOUS |
| `reach.phase1.foundation`                   | `relative-movement-and-check`                     | ANONYMOUS |
| `reach.phase1.foundation`                   | `camera-unavailability-and-conventional-recovery` | ANONYMOUS |
| `crossdeck.refit.published-lens`            | `published-clue-inspect-return`                   | PLAYER    |
| `crossdeck.phase2.continuity`               | `contextual-connect-return`                       | PLAYER    |
| `homeport.shell.crossdeck-access-recovery`  | `player-entry-account-recovery`                   | ANONYMOUS |
| `homeport.shell.crossdeck-companion`        | `companion-context-exit-return`                   | PLAYER    |
| `homeport.shell.crossdeck-companion-mobile` | `companion-context-exit-return`                   | PLAYER    |
| `crossdeck.refit.companion`                 | `companion-purpose-return`                        | PLAYER    |

The affected route entries are:

- `/account/devices`
- `/account/devices?voyage=00000000-0000-4000-8000-00000000cd11`
- `/devices/companion`
- `/devices/companion?voyage=00000000-0000-4000-8000-00000000cd11`
- `/devices/pair`
- `/devices/reach`
- `/forgot-password`
- `/player/library`
- `/player/playthroughs/00000000-0000-4000-8000-00000000cd11/journal`
- `/player/sign-in`
- `/player/sign-in?returnTo=%2Fdevices%2Fpair`
- `/sign-in`
- `/sign-in?returnTo=%2Faccount%2Fdevices%3Fvoyage%3D00000000-0000-4000-8000-00000000cd11`
- `/sign-in?returnTo=%2Fplayer%2Fplaythroughs%2F00000000-0000-4000-8000-00000000cd11%2Fjournal`

The six mandatory selected browser suites remain:

- `tests/e2e/crossdeck-experience-refit.spec.ts`
- `tests/e2e/crossdeck-phase1.spec.ts`
- `tests/e2e/crossdeck-phase2.spec.ts`
- `tests/e2e/crossdeck-refit-recovery.spec.ts`
- `tests/e2e/homeport-phase2.spec.ts`
- `tests/e2e/reach-laboratory.spec.ts`

The snapshot retains the full projected unit-test selection as well. No suite, role, device, motion context, witness, technical media or substantive review dimension may be suppressed to fit the budget.

# Successor lineage gate and compensating controls

A proposed successor would be admissible only with a new verified direct KG decision and exact predecessor identity bindings. Its complete campaign audit would retain the original epoch, all eleven repair/recapture attempts, the failed preparation and any later attempt. Only the exact explicitly approved predecessor could be recognized as historical consumed entitlement for a distinct successor. Unknown/new failures, reruns, ambiguous or incomplete history would remain terminal. No new-approval-date filter, generic failed-run exclusion or namespace escape is proposed.

The compensating controls would retain:

1. Protected-base-only approved registry and validator authority; candidate metadata, environment and evidence refs cannot authorize or enlarge the grant.
2. Exact frozen product/configuration/dependency/contracts/history identities, the new record content digest, full source/base/head/tree and complete selected plan in authenticated immutable capture, review and qualification seals.
3. Fresh successful actual journeys for every context, all 17 review dimensions, separate builder/reviewer provenance, no new blocking finding, all mandatory E2E media and an ordinary protected PASS. A consumed review reservation is not a completed review.
4. One protected original run per entitlement, atomic create-only custody refs, original successful run/artifact provenance, complete paginated history, duplicate/rerun rejection and exact final remote-head readback before the one final trigger.
5. Existing privacy, authorization, accessibility, timing, continuity, credential stripping, isolated synthetic runtime, protected merge and owner product-acceptance boundaries. No branch-protection or broader permission change is requested; existing trusted guard write scope is not expanded.
6. A pinned protected base throughout any approved preparation, review, qualification and strict merge. Base/source/contract/evidence invalidation stops without automatic new capture, refund or retry.

# Risk, expiry and removal

The proposal would allow another bounded verification after an exhausted history and a failed finite preparation; there is still no accepted current consumer packet and the seven uncompleted contexts remain unproved. Helper qualification does not establish Crossdeck, Parallax, physical-device or owner acceptance. Additional source or base invalidation could terminate a newly approved sequence without acceptance. The controls above preserve that risk instead of hiding it through reset counters or a fresh namespace.

Expiry remains **2026-10-22T23:59:59Z**. An expired exception is blocking; this proposal supplies no extension. After successful protected Crossdeck integration or expiry, any approved successor would be retired through a separate normal protected record transition. The predecessor record, failed run/artifact identities, ledgers and create-only refs remain historical evidence with no deletion, rewrite or refund. Security and privacy violations cannot be authorized by this exception.

Until a new exact KG decision exists, R2 stays **PENDING, INACTIVE, UNIMPLEMENTED and UNRESERVED**. This documentation branch is not to be merged as activation. Any later authority amendment and consumer execution remain separately gated.
