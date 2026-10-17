---
title: Automatic Product Experience Engineering workflow
audience: automation
status: current
canonical_for: product-experience-development-workflow
last_reviewed: 2026-10-11
---

# Product Experience Engineering

Apply automatically when changing UI, navigation, roles/modes, accessibility,
motion, device capabilities, loading/recovery, creator tools, or backend
projections consumed by people. Implementation includes design and experience
verification. An unspecified later polish project cannot discharge this task's
obligations. Use the smallest sufficient context and evidence; expand context
only to resolve an actual uncertainty.

The [Global Product Governance Standard](../Development_Docs/Governance/Voyagewright_Global_Product_Governance_Standard.md)
governs product quality. Sounding Line alone decides software qualification and
protected integration. Homeport owns screen/navigation contracts, Brightwork
owns visual families/references, Lanternwake owns substantial motion, and
domain owners retain their canonical data and progression authority.

1. Identify the human objective, natural entry, promised visible outcome,
   affected consumers and complete cross-project journey. Inspect relevant
   existing `testing/contracts.json` contracts and Homeport screen/journey IDs.
   Run `npm run experience:plan -- --base <protected-base> --candidate <commit> --plan true`.
   A services path does not exempt a user-facing projection. Unknown affected
   surfaces require an experience contract, not an exemption.
2. Extend the existing contract's `experience` field or register the new
   capability there. Preserve protected-base obligations. Name one experience
   integration owner, without transferring domain ownership. Define persona,
   goal, natural entry, visible outcome, states, roles, devices, accessible
   fallback, return/continuity, relevant timing boundaries, accepted reference
   paths and visible-control journeys. Do not use persisted enums or labels as
   evidence of a fulfilled role. Describe the intended hierarchy, composition,
   actions and state/transition design before implementing.
3. Build and run the actual application using Sounding Line's task-owned
   database, loopback ports and browser runtime. Provision synthetic persisted
   data and authorized persona fixtures. Do not use real private content or
   existing shared runtimes. The capture helper accepts an isolated storage
   state; authentication setup cannot replace the natural user journey.
4. Run `npm run experience:capture -- --base <protected-base> --candidate <commit> --url <owned-loopback-url> --output Development_Docs/Testing/Product_Experience/evidence`.
   Inspect populated, empty, adverse and recovery states required by the
   contract on its applicable devices. Inspect recordings for meaningful
   transitions; include reduced motion and actual timing boundaries where
   applicable. Screenshots, HTTP success, DOM presence and zero axe violations
   are supporting evidence rather than visual acceptance.
5. Give an independent subagent or supported isolated reviewer the generated
   bounded review packet: objective, contracts, accepted visual references,
   screenshots/recordings, necessary test evidence and source identity. Exclude
   the builder's rationale. Have it inspect the experience before source and
   record concrete observations for every required review dimension, evidence
   IDs and contract-bound findings. If a separate context is unavailable,
   record the limitation and block significant experience acceptance; never
   call self-review independent. Review identity fields record provenance;
   they are not a cryptographic authentication of the reviewer.
6. Consume confirmed blocking findings automatically. Repair the smallest
   supported scope, rerun focused tests, recapture affected states, and obtain
   re-review. `repairDisposition` returns `REPAIR_AND_RECAPTURE`,
   `VERIFY_FINAL_EVIDENCE`, or `BLOCK_WITH_EVIDENCE`. Stop repeated repair at
   three iterations or no material progress and report the unresolved finding.
   Do not hide controls, downgrade contracts or suppress evidence to pass.
   A later owner-directed continuation may be installed through a separate
   reviewed, protected source amendment. The protected-base
   `experiencePolicy.reviewContinuation` record authorizes only the named PR
   and contract's next cumulative review, iteration four, retaining the exact
   blocked third review and its finding IDs. Candidate declarations cannot
   grant this authority. Both previous findings must be resolved with current
   repair evidence; any unresolved fourth review stops with evidence, and a
   fifth review remains unauthorized. This is not a new round or a runtime
   exception. Fresh source-bound capture, independent review, authenticated
   submission, replay and ordinary protected verification remain required.
7. Assemble source-bound capture/review evidence at
   `Development_Docs/Testing/Product_Experience/candidate-review.json`.
   Commit the actual referenced artifacts. Record substantive dimensions,
   separate builder/reviewer contexts, packet digest, findings and repair
   evidence. Preserve baseline debt IDs, accountable repair owners and repair
   paths; unchanged debt is not permission for new regressions or a false
   completion claim. Sounding Line checks trusted requirements and replays
   visible journeys against the exact built candidate.
   A stable draft PR uses the existing ordinary workflow on protected main with
   `experience_mode=capture`, followed by authenticated `review` submission.
   Download and commit reviewed artifact paths and both immutable artifact IDs.
   [Operations](../Development_Docs/Testing/Product_Experience/README.md) defines
   the exact sequence. Preparation jobs issue no required mainline decision.
8. Complete focused development checks, documentation/catalog decisions and
   formatting before freezing one candidate. Obtain ordinary Sounding Line
   acceptance, merge through protection where authorized, and verify landed
   source. Keep IMPLEMENTED, CONTRACT_VALIDATED, INTEGRATED,
   VISUALLY_COMPLETE, JOURNEY_VALIDATED and READY_FOR_OWNER_WALKTHROUGH
   distinct. Only the owner may grant PRODUCT_ACCEPTED.

Pure backend, internal tooling and documentation changes with no user-facing
consumer need no screenshots or visual reviewer. Their ordinary focused
verification remains in force. A shared component or design-token change
selects its consumers; a multi-system change selects the entire relevant
experience. Existing source debt stays visible and accountable without making
unrelated work unmergeable.
