---
title: Automated replay artifact folder correction
audience: engineering
status: current
canonical_for: automated-replay-artifact-root-causal-disposition
last_reviewed: 2026-10-21
---

# Source-bound defect and correction

Accepted source185f5fd368ec16a77cb5fe92e7813d7ca4ac6418 calls the current
publication validator before returning from automated-only evidence validation.
That validator requires paths below
`Development_Docs/Testing/Product_Experience/evidence/`. The trusted automated
replay producer writes below `artifacts/sounding-line/product-experience-replay/`.
This contradictory folder predicate rejects valid replay artifacts before their
file contents, paired receipts and journeys can be validated.

The correction retains a shared private artifact validator. Automated evidence
may additionally use the exact slash-terminated established replay prefix.
Publication and capture-identity validation still require the canonical
publication prefix. Every existing count, unique-ID, safe-path, extension, digest,
context-field and paired same-path consistency check remains shared. Exception
binding remains mandatory before artifact validation. The full evidence validator
continues to check source identity, actual file bytes, paired receipts, journeys,
accessibility, response timing, continuity and terminal cleanup.

## Focused reproduction

The regression in `tests/sounding-line/experience-capture-publication.test.mjs`
uses a unique temporary repository and synthetic PNG, WebM, ZIP, report and witness
files. It exercises `validateExperienceEvidence` with its actual file reader,
32 generic journey contexts, 6 paired contexts, and no independent-review claim.
The paired producer is injected with a synthetic runner: no application browser,
provider request, campaign reservation or consumer replay is executed.

On accepted source, the regression fails with the folder/context validation
error. With the correction, the same evidence passes. The same local descriptors
remain invalid for publication and capture identity. Negative cases retain
rejection of invalid folders/traversal/extensions, missing descriptors, excessive
counts, duplicate IDs, arbitrary aliases, conflicting or third paired aliases,
wrong exception/base/source/contract identity, mismatched file hashes or origin,
missing journeys, overflow, slow feedback, broken continuity, missing or stale
paired reports/witnesses, incomplete paired cleanup and stale runtime binding.
Rewritten fixture receipts are restored and the final positive validation passes.

Local Windows checks passed the new full-validator regression and four focused
current-admission/publication policy tests. The broader three-file check reported
82/85 passing: the two symlink fixture cases and their parent failed because the
host denied symlink creation with EPERM. Running that unchanged scope against
accepted main reproduced both permission failures. Those failures are retained;
they are not relabeled as a passing Windows suite. Linux qualification must
exercise the complete scope with the original assertions intact.

## Acceptance boundary

This is infrastructure correction with no product behavior or feature-catalog
capability change. Private diagnostics and decrypted stacks are not published in
this record. Local synthetic evidence establishes this validator boundary;
protected qualification and a landed smoke must separately bind the exact
reviewed candidate. This record does not declare that integration complete.

R25 run39622005087/1 remains failed and spent. No registry record, execution cap,
counter, expiry, historical artifact, product contract, media or E2E test changes.
This neutral correction supplies no successor allowance and dispatches no consumer
execution. Crossdeck #721 and downstream product acceptance remain separate.
