---
title: Development report and producer output retention repair
audience: engineering
status: implementation-candidate
canonical_for: development-report-producer-retention-engineering-20261021
last_reviewed: 2026-10-21
---

# Development report and producer output retention repair

Development-only Linux run `39696321296/1` failed after preparation passed. Its
selected browser child exited 1 and supervised cleanup passed. The published
diagnostic ZIP, artifact `12390909192`, contains an encrypted payload with one
360-byte raw hash/status manifest and `NO_FAILURE_ATTACHMENTS`. It contains no
original Playwright error, report, screenshot, video or trace. The original cause
remains UNKNOWN; the original failed run and artifact remain unchanged.

The audit independently verified the original artifact ZIP (2,783 bytes, SHA-256
`1412bbc244333a9a0ee0bfeefe05c08bec97137b5a6ceebf08916cc4284d12ba`) and provider
logs ZIP (47,062 bytes, SHA-256
`2492a3037e758a36f7a062ed8125a4187c76c525eaff1ffc0fdf3b6c74cbf68f`). It bound the
actual workflow to accepted source
`aaff919428ef9ab421579415ce3409949724760d`. No original report or producer output
survives through the published authorized recovery route. Private files may have
existed on the completed ephemeral runner; their former paths are not an
accessible recovery route. No key search, private-key access, decryption or new
browser attempt was used for that audit.

## Cause of the evidence gap

The development launcher unpipes child stdout/stderr from public workflow logs,
writes private redacted logs in finalization, and configures an original JSON
report outside the consumer workspace. The focused workflow uploads only the
existing collector's live encrypted pair. That collector captures recognized test
attachments and hashed failure/status metadata; it does not read the separate
original report or launcher output. Custom consumer files that are not attached
to Playwright also do not enter the attachment inventory. These explain the
retention gap, without establishing the original UI failure's cause.

## Prepared correction

Only the trusted development host opts into supplemental retention. After both
browser and server trees and streams are proven closed, it captures the exact
original JSON report when available and the bounded retained stdout/stderr of
those two producers. The private capture token retains its source binding in live
memory; JSON, clones and a different source cannot supply its bytes. Provider
repository, run, attempt and workflow source plus the exact selector are preserved
inside authenticated encrypted context. Captured buffers are copied so later
mutations cannot alter the recorded originals.

Report reads require a fresh, bounded, canonical private regular file owned by the
Linux executor, with one link and stable handle/path identity and timestamps.
The read allocates only the validated size and probes at most one extra byte;
growth cannot expand the read allocation. Missing, unsafe or unreadable reports remain explicit. Stream metadata preserves
original byte counts, full-stream hashes and completeness; incomplete retained
fragments never claim to be complete original streams. Existing limits remain:
1 MiB for JSON members, 16 MiB retained per producer stream, 64 MiB aggregate raw
diagnostics and the existing file/envelope caps. There is no automatic retry or
buffer increase.

The exact private launcher now resumes stdout and stderr after removing their
public pipes and installing private consumers. Its previous live-stream pause
predates this repair. An inert two-producer regression with 2 MiB on each of four
streams hit the unchanged 15-second exit deadline before this correction; both
owned trees and streams were then cleaned up and no producer bytes reached public
output. The corrected adapter completes the same fixed test with exact original
byte counts and hashes, proven producer closure and redacted private logs. This
establishes the adapter defect without attributing the old browser failure to it.

The same encrypted collector and live publication object still produce only the
existing `failure.encrypted` and `retention.json` pair. The workflow, public key,
encryption algorithms, exact-path upload and publication identity checks remain
unchanged. In the explicit development mode only, a missing reporter manifest can
be represented as incomplete empty attachment metadata while causal report/output
is retained. Generic collection keeps its previous behavior. Additional text does
not satisfy any missing screenshot, video, trace or error-context requirement.

Supplemental collection failure does not replace the actual child failure or
cleanup outcome. No diagnostic payload grants passing evidence, campaign custody,
consumer execution, retry authority or acceptance.

## Verification boundary

Five portable checks pass for exact bytes, source/attempt/selector
binding, cloned tokens, mutable input/output isolation, unclosed producers,
incomplete streams, malformed metadata, fixed limits and the exact private
launcher. Ten POSIX report-reader cases remain skipped on Windows. The wider
selected local checks report 22 passes, one failure and ten POSIX-only skips.
The one Windows
argv-quoting failure reproduces on unchanged accepted source; its assertion stays
intact. This is not a whole local-suite pass.

Both preparation and browser-run host paths retain the original private launcher
binding; the exact-adapter test imports an export alias. Explicit undefined-name
lint checks cover the complete host module, and the existing host plan/reuse and
trusted routing assertions remain intact.

Prepared Linux regressions run real inert Playwright workers for an early
configuration error and a test failure without attachments. Generated test-key
decryption must prove the exact original report and stdout/stderr bytes while
retaining `INCOMPLETE` attachment status. A real owned inert HTTP/proxy authority
case checks capture after producer closure and preserves failure, reporter and
cleanup behavior. Private report guards cover missing, symlink, hardlink, stale,
oversized, public-permission and non-file inputs. Deterministic real-file
growth, truncation and replacement at the read boundary must preserve the fixed
I/O bound and reject changed files. These tests do not launch a
product browser or use the owner's private key.

The first protected run `39714517395/1` on source
`375da5201710bf88fdd493b196e7cc91302e9522` passed all 855 Linux regressions and
13 rendered adversarial fixtures, including the POSIX guards and real inert
Playwright cases. Its original source, output and successful decision remain
preserved. That proof does not make a later source eligible for merge.

The candidate is reconciled to accepted main
`8e49351e62e1f32340109566557a824bfa74e14d` and retains all 38 accepted #786
inventory rows. Independent exact-source review, fresh normal protected Linux
qualification, protected merge and independent landed proof remain required. The
source-reader repair may qualify independently; merge still requires fresh
accepted main ancestry. The
sole consumer owner's attachment patch remains separately
reviewed and unapplied by this maintenance lane. A future browser attempt requires
its accepted route and exact source; this repair cannot recover the old cause.

Feature Catalog disposition: ordinary diagnostic retention correction; no new
major capability or important subfeature.
