---
title: Bounded source snapshots and contained Windows build links
audience: engineering
status: implementation-candidate
canonical_for: sounding-line-source-snapshot-windows-links-repair-20261021
last_reviewed: 2026-10-22
---

# Bounded source snapshots and contained Windows build links

Two source-bound infrastructure failures prevent existing Parallax development
preparation. They do not establish a product defect or authorize consumer
qualification. The original failed outputs remain retained privately and failed.
The implementation candidate is reconciled to accepted main
`90bff6ec281d79a6788c8270a8a3d67fd8257010`, retaining all 38 accepted #786
inventory rows and the separately accepted diagnostic-retention repair #789.
The base also includes neutral expiry-routing repair #790, accepted at exactly
this main through its one-time human-approved merge exception. Its unchanged
registry, live campaign expiry and historical test clocks remain accepted base.
The exception applies only to #790; this reader requires fresh normal protected
qualification and ordinary merge eligibility.
Exact-source review and normal protected qualification bind
this candidate, and merge still requires fresh accepted main ancestry.

## Complete Git object transport

On the diagnosed immutable candidate
`871431cd0827d42551c8a8b9d2d7fde5e16c1f77`, unchanged source selection includes
3,946 entries with 172,504,656 bytes of framed Git output. The largest individual
blob is 19,284,170 bytes. The original single `cat-file --batch` exceeds the
134,217,728-byte per-call limit and fails with `ENOBUFS`. The diagnosed accepted
base `aaff919428ef9ab421579415ce3409949724760d` selects 2,312 entries and
90,593,533 framed bytes, so that smaller snapshot does not expose the aggregate
failure.

The correction retains every selected object, including aliases and historical
JSON, with the same complete entries, insertion order and UTF-8 decoding. Exact
`--batch-check` requests contain at most 512 objects and respect a metadata byte
budget. Their validated sizes determine complete-object payload batches within
the unchanged 128 MiB per-call limit. Each payload header, object identity, type,
declared body length, final newline and total output length must match. Missing,
malformed, misordered or oversized objects remain terminal. There is no retry,
input filtering, buffer increase or partial snapshot return. A single framed
object exceeding the limit remains unsupported and fails closed.

A fixed real-Git synthetic repository contains two independent 70 MiB JSON bodies.
The accepted original reader fails once at its real default cap. The patched
reader returns both complete bodies in order, matching the independent
deterministic input, with two bounded payload reads. Small fixed-budget regressions
also exercise real Git overflow, aliases, empty and opaque bodies, metadata
partitioning, exact-budget boundaries, malformed framing, late missing objects and
unchanged native error identity without retries. A separate read-only comparison
passed on the diagnosed candidate: its entire entry inventory and all 3,946
ordered bodies match independent complete Git reads of 3,657 distinct blobs.
Both metadata and payload phases request every selected object exactly once,
including aliases, and retain the original 172,504,656-byte framed denominator.
This preliminary proof binds the working source and does not claim final freeze
or protected qualification.

The diagnostic observer recognizes the new exact metadata operation only for
`PRODUCT_EXPERIENCE`, with the existing object-ID stdin grammar. Other components,
custom formats and private command shapes retain their previous behavior. This
observation supplies no execution or qualification authority.

## Native Windows dependency junctions

The original Windows development preparation completed its setup and Next build
children and supervised cleanup, then rejected Next-generated absolute directory
junctions for Prisma Client, pino and sharp. Each reported target was a canonical
strict descendant of that same workspace's physical `node_modules`. The failure
occurred before a prepared manifest or browser cases.

The correction accepts absolute links only on Windows when the literal is already
canonical, the target is a real directory, strict dependency containment holds and
canonical realpath equals the target. Native copy explicitly creates a junction.
Existing relative-link descriptors remain unchanged. POSIX absolute links,
dependency-root links, prefix siblings, external or redirected targets, dangling
links and Windows non-directory targets remain rejected. Original source-link
identity, timestamps and before/after literal guards remain in force.

Native synthetic tests compare original, immutable prepared and runtime-copy
fingerprints, require identical link literals, and verify dependency sentinel
bytes and permissions remain unchanged. Fingerprinting, copying and immutability
all reject unsafe targets. Retargeting within owned dependencies changes the reuse
fingerprint. Installed dependency fingerprints before and after execution and
all owned-process cleanup checks remain unchanged.

## Evidence boundary

The first protected run `39714164483/1` on source
`79edd5830b0319d583d7fc2a14e1543cca9d636d` failed one of 853 regressions, with
851 passes and one platform-only skip. The unchanged R3 admission test correctly
rejected an extra `experience:test` script entry: its historical frozen package
permits only `test:sounding-line` to inherit the protected base. The correction
restores only that redundant script edit and retains both new regression files in
the canonical command. The original R3 positive admission and all three rejection
assertions then pass unchanged at the one-field correction
`951fe1156e9a50c2e6d1649375be4e6dfc77946a`. The failed head and run remain failed
and preserved; fresh qualification must bind the reconciled source.

These are development infrastructure corrections. Native Windows fixtures are not
an actual consumer build or product experience review. Protected Linux
qualification, independent exact-source review, actual protected merge and landed
verification remain required. Matching pre-existing Windows baseline failures
must be recorded without weakening their assertions or treating the whole local
suite as passing. The selected local candidate checks report 128 passes, 12
failures and one POSIX-only skip. The unchanged accepted source closure reproduces
the same 12 Windows failures among its original 123 cases; the candidate adds 17
passing regressions and the POSIX-only case. Lint and formatting pass. No old
failed consumer run becomes accepted, diagnosable or
unspent because these corrections exist.

The separate development diagnostic retention repair #789 is accepted in the
current base and retains original reports and closed producer output privately
through encryption. Its runtime, private launcher and test registrations remain
intact in this composed candidate. The consumer owner controls its separate
test-attachment patch and development attempts; this repair neither applies nor
executes them.

The corrected reader source `1ee701d62b8af34bb0a8522adb9cd3361a0eb223` passed
normal run `39718154197/1` on the previous accepted base, with 852 of 853
regressions passing, one platform skip and all 13 rendered fixtures passing.
That original success is preserved. It does not qualify the newly composed
candidate on accepted #789; fresh exact-source review and protected checks remain
required.

Feature Catalog disposition: ordinary infrastructure corrections; no completed
major capability or important subfeature changes.
