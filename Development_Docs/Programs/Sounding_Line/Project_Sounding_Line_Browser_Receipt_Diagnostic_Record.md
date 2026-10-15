---
title: Sounding Line browser receipt diagnostic correction
audience: engineering
status: focused-qualified
canonical_for: sounding-line-browser-receipt-diagnostic-correction
last_reviewed: 2026-10-15
---

# Browser receipt diagnostic correction

This separately authorized maintenance starts at protected main
`4baa39af82b78b50a46f590bc2acc2ff0b7597aa`, after lifecycle repair PR 724.
It corrects diagnostic attribution only. Product behavior, experience contracts,
planning, evidence reuse, command selection, repair accounting and protected
PASS/FAIL authority remain unchanged.

## Established defect

Parallax PR 722's ordinary invocation on candidate
`eaab702b6fc32e043855d536ebcc1efff5d3912e` against the above base failed preflight
before executing commands. Direct planning identified
`PRODUCT_EXPERIENCE_EXPERIENCE_DESIGN_REQUIRED`. Ordinary instead reported the
generic verification-command failure and attached historical root receipts:
a 53,962 ms browser execution and an earlier generic-suite PASS. Its catch
unconditionally read unbound files and could also replace the current failure
category with an older receipt's category. The observed preflight failure is
not a browser execution and does not establish a new capture failure.

## Correction

Ordinary mints its own invocation identity and advances a scope before every
executed verification command. Browser commands receive that scope through
their environment. Applicable experience verification clears earlier scope;
replay clears before initial I/O and advances again for each profile.
Receipts live under `artifacts/sounding-line/browser-diagnostics/<run>/<scope>`
and must match version, invocation, scope, base, candidate and plan digest.
There is no fallback to historical root files. Missing, malformed, foreign or
unreadable scoped receipts are null. Scoped write failures do not create new
acceptance outcomes. Existing standalone helpers keep their unbound paths.

The public fields `browserQualification` and `browserSuiteProfile` retain their
names. Product-experience diagnostics keep explicitly allowlisted fixed codes
and a `PRODUCT_EXPERIENCE_FAILURE` category; arbitrary suffixes and unknown
tokens are omitted. Historical consumer evidence is never deleted or rewritten.

## Qualification

Focused tests exercise the actual ordinary CLI with no prior receipt, old PASS
and old failure receipts; exact identity mismatches; invocation concurrency;
malformed and unwritable diagnostics; standalone compatibility; later setup
failure; replay phase transitions; actual suite setup failure; and private
error suffix removal. The production Next/Chromium fixture additionally proves
a genuine scoped browser failure remains visible while its historical receipt
bytes stay unchanged and all owned resources shut down.

The [independent source review](evidence/browser-receipt-diagnostics-20261015/independent-review.json)
approved the nine runtime/test/package/workflow files with no blocking findings.
Their source manifest is
`1173007dff040076977c4635187bc47beea9f53da0898f2559cc53c081534e48`.
Local Windows qualification passed all ten diagnostic regressions, all fourteen
lifecycle cases in an isolated repeat, eleven rendered tests, typecheck, focused
lint, privacy scan, documentation validation and nine feature-catalog tests.
The initial concurrent full run had 124 passes, one timeout and one failure in
the existing lifecycle cases; the unchanged lifecycle scope then passed 14/14.
The first privacy scan raced fixture removal and was repeated successfully
after tests ended. These local attempts do not constitute Linux acceptance.

[Focused Linux qualification 38685432244](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38685432244)
passed 25/25 tests in 17.646 seconds on candidate
`969881ba1628600e4f1c7365143343b49b6e0ca8`; the job completed in 135 seconds.
The nine reviewed source hashes above match the committed candidate bytes.
Real Next/Chromium capture produced four independently hash-verified artifacts;
cleanup took 33 ms. Its scoped failure remained `PRODUCT_FAILURE`, preserved
the historical receipt bytes and cleaned up in 32 ms. Both released their
ports and reaped their process trees. Active browser cancellation cleaned up
in 2040 ms. The uploaded archive digest was independently verified against
GitHub's immutable artifact digest. The [machine-readable Linux receipt](evidence/browser-receipt-diagnostics-20261015/linux-focused-qualified-38685432244.json)
binds the run, source manifest, artifact and observed cleanup facts. Its runtime
binding identities are synthetic fixture identities, not consumer evidence.

[PR 730](https://github.com/Kgray44/treasurehuntSoT/pull/730) tracks the final
accepted-main ordinary check and protected integration. The focused Linux job
emits no Mainline Decision. The accepted-main ordinary workflow remains the
final authority. No consumer acceptance is claimed.
