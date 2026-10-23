---
title: Development preparation postbuild timing candidate
audience: engineering
status: implementation-candidate
canonical_for: sounding-line-development-postbuild-timing-20261023
last_reviewed: 2026-10-23
---

# Development preparation postbuild timing

The existing preparation controller now records start and end observations for
the build-tree fingerprint, final dependency fingerprint and manifest write.
Each observation is an exclusive private output file named
`postbuild-verification-N.private.json`, with sequence 1 through 6. Each file is
at most 512 bytes, contains only fixed phase/event labels, development-only
classification, UTC time, elapsed milliseconds and outcome, and is flushed and
closed before execution proceeds. The start is durable before its operation;
the manifest end follows the existing manifest write, flush and close.

A start without an end identifies an incomplete observed phase. It does not
prove a hang, eventual success, cleanup, manifest validity or product acceptance.
The records contain no input paths, fingerprints, credentials, database contents
or error messages. Normal failure retention also includes completed observations
in its existing private receipt. A failed start prevents the operation; a failed
end prevents success; observation failure cannot replace an original operation
failure. Records never overwrite an earlier file.

The preparation hash, identity, dependency-link, resource and deadline gates are
unchanged. Tiny synthetic files exercise the real finalization path; forced
creation-owned stops exercise an incomplete observation in each phase. No
production build, full dependency benchmark, browser or capture is required to
validate this instrumentation locally.

The existing product preparation CLI has no postbuild resume mode. Its failed
partial output has no valid manifest and cannot be rebound or promoted by these
records. Observing these phases in a new product preparation still follows the
normal fresh preparation path, including its product build. This correction
does not enable replaying only the stopped product phase or reconstruct its
missing historical observations. It remains a local maintenance candidate.
