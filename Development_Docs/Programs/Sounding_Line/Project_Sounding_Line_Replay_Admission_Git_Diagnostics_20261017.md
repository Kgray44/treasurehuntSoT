---
title: Sounding Line replay admission Git failure observations
audience: engineering
status: implemented-awaiting-protected-qualification
canonical_for: sounding-line-replay-admission-git-failure-observations
last_reviewed: 2026-10-17
---

# Failed ordinary6 and retained evidence

Crossdeck [ordinary6 run39004965102](https://github.com/Kgray44/treasurehuntSoT/actions/runs/39004965102)
failed on candidate `7681d297f281ab03f30b4224b8288b7c942024c6`, tree
`471d8540d803344d1c7d7794fb641d47c3d01817`, protected base
`24fb189a90435ccb6021b63fd6953603ae090bc0`. Custody117315442535 passed;
focused117316423743 and Mainline117320859655 failed. Experience preparation
was skipped. The workflow completed FAILURE at2026-10-17T05:35:33Z.

The decoded original focused log is5337072 bytes, SHA256
`83ae533b3fe52e5e03768139922a8291749643dffd1c6883f16f5d93917dc740`.
Authenticated artifact12091437088 is664974 bytes, original ZIP SHA256
`9919037f8cdc51ed037afff0a1c800d6f22e6ac2c60e5ceaf6d4146b03972384`.
Its only member, ordinary-decision.json, is3995675 bytes, SHA256
`64606358a5501e2c2914bee8c31271446adafa7a9bc195b95cc435b2f97f6c85`.
Both originals and all read-only metadata/custody observations are retained
outside the worktree. No original was reformatted or replaced.

All38 technical browser cases passed across the required six suites. All eight
technical obligations were freshly satisfied and the canonical technical
finalizer had no errors or remainder. Formatting, lint, build, Prisma generation
and historical Experience validation passed. Current replay did not start:
the only failure observation is REPLAY_ADMISSION, Error, child exit1, with null
code/cause/syscall/signal. There is no current replay result or qualified seal.
R13 qualify `f45b983b4f17648cf9f0f982d81006c1883b3137` remains consumed.
Technical and historical passes do not make the whole failed decision acceptable.

# Demonstrated diagnostic gap

The installed #753 correction preserved completed technical observations and
the replay-admission stage/status. It still discarded the underlying command and
stderr. Admission Git helpers suppress stderr, while public failure observations
intentionally exclude arbitrary messages, stacks and arguments. The retained
exception therefore cannot identify a particular Git read or its underlying
cause. PRODUCT_FAILURE is the generic fallback classification and does not prove
a product assertion failure. The discarded hosted filesystem cannot be inspected.

A nonqualifying clean-source reconstruction of exact E/base passed257 Git reads,
including eight ancestry checks and three metadata merges. It called only source
recognition and planning: no admission claim, API, setup, product journey,
browser, replay or custody write. Receipt SHA256 is
`7025fefcdb0dcb34a78d67a6dc6c9ebbb41dd85857a7d47be0231f3a088124b3`.
This did not reproduce or clear the hosted failure. No speculative product or
source-composition repair is justified by these observations.

# Narrow correction and integration boundary

This change adds observation detail only: fixed admission substages and Git
operation identities, bounded public-source bindings and safe output identities.
It preserves the identical thrown error and existing privacy, typed denial and
deepest-stage semantics. Arbitrary error messages, stacks, raw paths/argv,
environment, URLs and credentials remain excluded from ordinary decisions.
Owned synthetic fixtures must demonstrate actual Git failure provenance and
privacy without invoking a consumer admission or product runner.

Observation scope follows only REPLAY_ADMISSION through asynchronous substages.
Details attach to the identical failed error, including safe provenance transfer
where an existing reader translates a Git failure to its unchanged typed denial.
A caught ancestry probe cannot label a later unrelated failure. Fixed component,
operation and public-source argument shapes bound diagnostic eligibility;
unrecognized calls retain their original behavior without diagnostic hashing.
Dynamic public-source arguments and paths receive digests; exact validated
revision SHAs and three fixed navigation-file identities support reconstruction.

Git execution options, stderr disposition, output limits and timeout remain
unchanged. A historically discarded stream is reported unavailable. Already
captured stdout/stderr receive byte counts and at most64 KiB prefix digests,
with explicit completeness flags. This does not restore previously discarded
stderr or recover ordinary6's historical exception. Only Git's defined ancestry
exit1 and metadata-merge conflict statuses receive their fixed classifications;
other failures remain unclassified.

All exception records, immutable proofs, source/contract identity rules, expiry,
budgets, history admission, current Experience replay, canonical finalizer,
qualified-seal and whole-workflow/Mainline guards remain unchanged. This creates
no finite successor, retry, refund, product repair or new consumer permission.
Require independent exact-source review, normal protected control-plane
qualification/merge and landed authority checks. Those checks cannot qualify
Crossdeck or establish the historical hosted cause.

PR721 remains draft at the preserved failed candidate. Existing #722 and
dependent spatial integration remain held until Crossdeck's actual protected
merge and bounded landed product verification. Further consumer work must
respect the owner's cause-establishment instruction and separately reviewed
finite authority. No provider, physical-device or owner acceptance is inferred.

Independent exact-source review passed on the final ten-file runtime/test vector,
freeze SHA256
`cc513ebfa348a9c4ec8710d98aec4155b27803e82080042c79bdb715e0f8a819`;
combined review receipt SHA256
`7eefdc758b046a1f4c45ec010c68fe1bd28e48541371c0baf1f0066b725943e9`.
Local Linux Node24.19.0 validation passed23/23 focused diagnostic tests and the
registered343/343 Sounding Line regression, with zero failures, cancellations
or skips. Changed-source lint/format, privacy scan, documentation validation and
9/9 feature-record tests passed. These are neutral infrastructure checks, not
current Crossdeck qualification or evidence of its underlying hosted cause.

This engineering record and its linked
[automation context](../../../.agents/replay-admission-git-diagnostics.md)
describe infrastructure observations, with no user-visible capability or feature
catalog promotion. Whole protected qualification, exact-head protected installation
and landed authority receipts remain pending until execution on the final reviewed
source.
