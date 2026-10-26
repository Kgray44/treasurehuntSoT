---
title: Parallax shared-consumer compatibility preparation
audience: product-engineering
status: source-reviewed-runtime-interrupted
canonical_for: parallax-shared-consumer-compatibility-20261022
last_reviewed: 2026-10-22
---

# Shared-consumer compatibility

PR #776 remains the sole Studio integration candidate. The complete non-consuming
plan on published `28ece6275ad51a23008e1301964a3eb8a9c0ab8d`, against accepted
maintenance main `39b706ad3c9a2b8e1d589f71db909cf6c32c468b`, reached
`PRODUCT_EXPERIENCE_UNREGISTERED_SURFACE`: 173 paths, comprising 18 directly
changed surfaces and 155 other consumers. The original failed receipt remains
unchanged. The accepted source reader completed; the older buffer failure is not
the current blocker.

The working continuation retains the accepted graph, including its type edges.
It adds explicit experience declarations to the existing owning contracts and
executable browser checks. All 173 original paths now have source bindings.
This is a source-binding result, not runtime coverage or an accepted canonical
plan. All 501 original contract IDs remain; the single additive
`parallax.integration.pilot-owner-boundary` contract brings the total to 502.
The corrected working declaration has 32 experience schemas, including a distinct
owned Showcase facet on the existing motion-authority contract. Product and
Prisma source are unchanged.

## Review and executable scope

The existing #722 root/domain owner independently reviewed the bounded source
groups and their corrected selectors, identity/capability assertions and privacy
negatives. That source review is distinct from rendered Product Experience
review. Playwright enumerates 39 unique Chromium cases in six files; enumeration
does not execute them.

| Group        | Declared cases | Actual scope                                                                                                                                                                                               |
| ------------ | -------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account      |              7 | Four owner-read/Home-return combinations, two OS motion changes retaining unsaved value and focus, and anonymous denial.                                                                                   |
| Passport     |              6 | Pinned historical title, edition and checksum, owner-visible memory canary, empty archive, wrong-owner and anonymous denial, and parent/Home return.                                                       |
| Community    |              6 | Authenticated viewing Creator plus anonymous public/private projection checks; actual private Voyage Log revision, ownership denial and draft return.                                                      |
| Workspaces   |              6 | One canonical account across Creator, Captain and Player; private Chronicle ownership, unsaved form return, genuine unclaimed-guest and anonymous denial.                                                  |
| Availability |              2 | Explicitly enabled owned Showcase controls and return; separate non-owner and anonymous pilot denial and account recovery on desktop and phone.                                                            |
| Admiralty    |             12 | Bounded read/redaction and role partitions, lease/policy previews with no execution, real owner-consented/scoped/revocable support, and case-attached moderation preview with independent-reviewer denial. |

The Account motion cases are counted once. Player is baseline ordinary access;
the self-service activation function accepts only Creator and Captain. The
unclaimed guest fixture proves its actual Player/Creator capability difference
before asserting denial. The private Chronicle is witnessed in the Creator
library; no private-draft visibility is expected in the Player library.

The Admiralty facets separate read projections, privileged command previews,
support consent, queue navigation and moderation. Previews are not execution.
The support test checks the approved target and exact category, rejects an
unapproved category while the grant is active, then verifies owner revocation.
The moderation test rejects self-review before a valid distinct-reviewer preview.
The retained unreferenced `AdmiraltyConsole.tsx` is explicitly documented as legacy
source; the current account dossier is the active support interface. No rendered
legacy-console result is claimed.

## Source-bound development evidence

The first Account working snapshot completed an isolated production build and
seven browser cases: seven passed, zero skipped, unexpected, flaky or retried.
The exact Account spec hash is
`c0ee51bb0128d783fcf24fed6d35a9a88fed4c37c6e21b2097d2618b7189de27`.
The original prepared manifest hash is
`4eec4f4acccc1a005152c6a8ce94957801d91bc51c67c4bf63d390ebce858f00`.
The raw Playwright report hash is
`97cd5fbc532582c451c91645f4797d1daa5f1e2bb857575da7aeef96c4d02674`.
Browser/server cleanup passed, trees were reaped, streams closed, ports released
and the proxy closed. Windows guardian escalation is retained in the receipts.
This is `PASS_DEVELOPMENT_CASE_NOT_ACCEPTANCE`, with qualification false.

That producer used HEAD `28ece6275` plus its recorded working-source fingerprint;
the newly written tests were not committed in `28ece6275`. Its result is not
rebound to the expanded working freeze or a later published candidate. The
first combined 39-case freeze was independently source-reviewed and passed
TypeScript, lint and enumeration before its runtime execution below.

The first combined run completed all six files on one immutable prepared build:
Account 7/7, Passport 6/6 and Workspaces 6/6 passed; Community 0/6, Availability
0/2 and Admiralty 2/12 passed. The whole result is **FAILED: 21 passed and 18
failed**, with zero retries, skips or flaky cases. All owned runtime cleanup
passed. Preserve these results on their original freeze; subsequent corrections
do not turn this run green.

Original traces and independent source inspection support one bounded test and
metadata correction batch. Genuine streamed Next NotFound HTML may return 200;
the corrected HTML oracle requires the unavailable body, noindex, the streamed
404 digest and absence of protected content. JSON API denials retain their exact
status checks. Voyage Log and support tests now select the unique h1; capture
metadata uses unique actual main-content witnesses because its runner does not
support heading levels. Admiralty empty states use their actual scoped text and
bounded query. Phone recovery follows the existing visible Safe return to
`/account`, with no hidden click or timeout change.

The accepted owned build explicitly enables the synthetic Animation Showcase.
Its new facet follows the real Home harness link, actual controls and Return to
harbor. Separate pilot checks retain genuine owner-only unavailability. No
normal-production disabled-lab result or owner-pilot workflow is inferred.
Support consent and pilot checks previously blocked by earlier selectors remain
unproved until the corrected run reaches their downstream assertions.

Nine new multi-system continuity fields were descriptive strings that the
capture runner cannot execute. Their corrected selector objects observe the
visible synthetic account aria-label at entry, outcomes and return. Separate
browser cases retain canonical ID/capability and privacy assertions; that label
alone does not prove account identity. Original trusted experience fields and
all prior contract obligations remain preserved. The corrected freeze04 passed
static checks, exact independent root review and a fresh production preparation.

## Second run and reviewed drafts-return correction

The second run on freeze04 is **FAILED / INCOMPLETE**: five of six files ran,
with 25 raw test passes, two test failures and 12 Admiralty cases not run.
Account 7/7, Passport 6/6 and Workspaces 6/6 have complete development passes.
Community passed its four public-profile/privacy cases. Its two private-log
cases reached the successful save, stored location and PRIVATE/DRAFT/unverified
assertions, then failed on the destination's duplicate h1/h2 title, `Your Voyage
Log drafts`. The following foreign/anonymous JSON denials remain unreached in
that run. The independently reviewed freeze05 adds only the destination's h1
level to the test and an unambiguous main/text/path return witness to metadata.
Full TypeScript, strict lint and all 32 schemas pass on those corrected bytes;
freeze05 has not run in a browser.

Availability's raw report records two passing tests and its original runtime
receipt records browser/server/proxy cleanup PASS and ports released. Its final
development-producer receipt is missing: the outer monitor recorded
`C_PROACTIVE_RESERVE_STOP`, minimum C: free space 12,353,642,496 bytes, below both
the 30 GiB floor and 32,346,472,448-byte proactive stop. This is a failed,
interrupted file, not a complete development pass. No skip, retry or flaky case
was reported. Admiralty was never started. Retain the collector's separate
INCOMPLETE/SETUP_FAILED status.

Windows System events independently show host hibernation spanning the
31-minute wall-clock gap in the final receipt write. Power-Troubleshooter
records sleep at 17:15:49.7331358Z and wake at 17:47:21.5137697Z; Kernel-General
records the resume clock change from 17:15:59.6282083Z to 17:47:19.500Z.
The outer execution file was created at 17:15:59.076Z and completed at
17:47:19.961Z; the aggregate timestamp follows at 17:47:19.971Z. The controller
was awaiting that small file write, with no stale-lock wait. The separate disk
allocator remains unknown; hibernation is not claimed as proof of that allocator.

The browser and server had already exited at 17:00:34.151Z. Independent process
and port checks confirmed closure. The stopped producer's empty lock was
preserved by moving it to task-owned incident originals, with timestamps and
hash retained. No private data, build, receipt or unrelated process was deleted.
C: later recovered and crossed the stop threshold again; a recovered sample does
not erase the failed minimum or admit a new local build. Local heavy runtime
work remains held. The existing protected-main focused-development workflow is
the available hosted continuation after reviewed source publication; it grants
no capture or qualification acceptance. Current Community, Admiralty and complete
Availability development proof remain outstanding.

The green Account receipt separately reports failure-collector retention
`INCOMPLETE`, issue `SETUP_FAILED`. The collector uses a Linux UID check whose
`process.getuid` API is absent on Windows; its original catch omits the exception
text. Treat this as a separate Windows collector setup limitation, not complete
retention or a failed browser case. No failed case required collection in this
green run. Raw private logs remain on D:; no unchanged rerun or protected
collector modification was made for this metadata.

## Isolation and proof boundaries

The sole writer/runtime moved to the task-owned D: checkout, preserving the clean
original C: checkout, compiled builds, receipts and object stores. Dependencies
were installed from the repository lock into physically contained D:
`node_modules`, using the same task's D: cache. The existing locked Chromium 1194
executables are reused read-only. Temporary output and receipts are task-owned.
Actual C: free space is monitored, with a 30 GiB floor and a proactive stop at
30 GiB plus 128 MiB. No disk-cleanup credit or unrelated-owner allocation is
claimed. Each further build/browser allocation requires admission.

All accounts, records, attached moderation targets and consent are synthetic and
isolated. No real private content, paid inference, camera, tracker, pilot-owner
provisioning or physical calibration is used. Current iPhone calibration remains
negative and unresolved. Provider configuration is not live-provider readiness.

Accepted Homeport reference images describe shared entry and recovery framing.
They are not invented Account, Passport, Community or Admiralty body baselines.
The new task bodies still need actual governed capture and fresh independent
rendered review. Existing full lifecycle, publication, media, authorization,
concurrency and owner obligations remain unchanged.

The [integration checkpoint](Protected_Integration_20261021.md) and
[evidence index](evidence/protected-integration-20261021/README.md) retain the
accepted maintenance, original failures and separate producer identities. Finish
the combined runtime checks, documentation and exact source publication before
the next canonical plan. Fresh governed capture, the cumulative #776 review
ordinal, authenticated submission, ordinary qualification, normal protected merge
and landed smoke remain required. No #721 finite authority or #725/#726/#741/#781
acceptance is borrowed.
