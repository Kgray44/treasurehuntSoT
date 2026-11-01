# Source, preparation and transport shadows

These components depend on the incremental evidence model. They have no
production call sites, issue no certificate, and grant no reuse, qualification,
review credit or merge authority. Their focused tests run in `test:sounding-line`;
an existing source-snapshot test checks that each new test is registered once.
The existing checkout profiles, preparation commands and Mainline Decision retain
their authority. Protected integration and native activation remain outstanding.

| Component                      | Current behavior                                                                                                                                    | Activation boundary                                                                                                                                                                 |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `source-batch-shadow.mjs`      | Compare complete tree/blob batches with original outcomes; return the original outcome references unchanged.                                        | Independent production equivalence and adversarial review before replacing a read.                                                                                                  |
| `selected-source-shadow.mjs`   | Propose a versioned read set from both dependency closures, all changed/deleted paths, installed readers, root policy and original historical pins. | Authenticated complete source/read closure and independently certified materialization; production remains full.                                                                    |
| `preparation-reuse-shadow.mjs` | Compare a strict metadata schema for two fresh preparations. This does not measure or package either preparation.                                   | Native preparation payload authentication, receipt custody, external isolation and cache equivalence. No hosted preparation certificate or cache producer exists in this component. |
| `bounded-media-shadow.mjs`     | Retain bounded streamed bytes and private receipts; verify an opaque local handle by rereading raw bytes and both initial/terminal receipts.        | Provider-authenticated expectations and external isolation. Caller-declared hashes cannot establish provider identity.                                                              |

## Source comparison

The comparison bounds requests at 8,192, revisions at 16, total entries at
100,000, each read at 8 MiB, and tree/blob payloads at 64 MiB. Unsupported quoting,
pathspec syntax, malformed metadata, missing parents, source-reader failure and
bad blob hashes remain unavailable. An original failed query retains its exact
error object and is never retried or upgraded to a successful comparison.

At local source `35c454c2262da1d03cf9431c1c43a31491b23636`, the comparison covered
321 original queries over immutable revisions
`b20199feee2a82129f1527a9c0099eca5c98be5a`,
`5fce13d00211d45116cc93ae143f24889834380c` and
`3f1eddb1f990ecad9b5a119236d73bdd0c9ecdbd`. All 309 successful outcomes matched;
12 original failures retained their identity. The individual reads took
56,788.4301 ms; five batch reads and comparison took 1,443.5384 ms. Both paths ran
in this local experiment. Production reads replaced: **zero**. These sequential
Windows observations do not establish hosted runtime or billing savings.

## Selection and preparation

The selected-source proposal checks inventory and graph digests without treating
them as authentication. It preserves base bytes for deletions and both sides of
mode/content changes. An unknown closure, source/graph mismatch, missing reader,
changed historical pin or exceeded bound returns `FULL_SNAPSHOT`, with no partial
proposal. Complete commit/tree metadata and disabled late transport remain
mandatory. Mathematical closure over caller-supplied data is not a completeness
certificate for actual filesystem readers.

Preparation comparison explicitly names the policy's immutable dependency,
Prisma-client, Chromium, WebKit or SQLite-baseline layer and every required
identity family for that layer. All run-owned shared exclusions, including
build output, workspace, mutable database, browser context/profile and ports,
are rejected. Existing build reuse within an authorized source-bound owned
runtime remains separate; no shared-build permission is introduced.
The policy's existing `candidate-pending-protected-mainline-acceptance` status is
unchanged; these records do not activate that policy or any cache.

The comparison also covers source identities and 13 fingerprints: source
closure, controller, policy, commands, inputs, dependencies, toolchain, browser,
environment, fixture, schema, profile and coverage. Output inventory/content
identities, file counts and byte counts remain separate. Different prepared bytes,
including nondeterministic output, are reported rather than normalized away.
Original and fresh run/candidate identities remain distinct. An opaque original
native-context proof can corroborate that context only; it cannot authenticate
the supplied preparation record or cached outputs. Every result still says
`RUN_FRESH_PREPARATION` and `NOT_ISSUED`.

## Private byte retention

The transport bounds a response at 256 MiB, private copies at 64 KiB, reads at
65,536, the stream deadline at 120 seconds and reader cleanup at one additional second.
Blocking filesystem operations still require the existing owned external supervisor.
It creates exclusive files, checks directory/file identity, bounds content length
and handles cancellation, hot empty streams, truncation and digest mismatch.
Initial receipts remain `INCOMPLETE`; a failed stream retains its prefix and
separate terminal/private failure record. Error records contain bounded own
string fields, with omissions explicit; they do not claim a complete serialized
exception. Recognized native lazy stacks require the original accessor,
prototype, unchanged formatter and bounded data properties. Caller-defined
getters and substituted formatters are not executed.

The entire retention directory is private. Neither its payloads nor its original
error records belong in product output. Successful write hashes describe write
observations; the opaque verifier independently rereads the raw file and exact
initial/terminal bytes. A changed or missing receipt invalidates that local
handle even if the payload bytes still match. A serialized copy is not a handle.
These checks do not authenticate a provider or prove external runtime isolation.
Generated archive declarations around the 2 GiB and 4 GiB boundaries are explicitly
rejected before reader acquisition by this lane's fixed 256 MiB cap; they are not
silently truncated or admitted through partial verification.

At source `dbca7289daa9094fe2ffc8b0abf15676349670ba`, a local comparison used the
unchanged retained artifact `13080399234` from run `41298652051/1`: 3,756,836 bytes,
SHA-256 `6503755918c74c46aa8f70b214095f5d7a73a8cad67da0f66359b686fc135c4a`.
Whole-response buffering took 7.5421 ms. Streamed disk retention took 31.7993 ms,
with 64 KiB input/copy chunks and exact raw-byte readback. This is a bounded-memory
tradeoff with additional disk I/O, not a speedup or a new native transport
authentication. The later receipt-custody strengthening has separate focused
tests; this original measurement remains bound to its original source.

## Whole retained archives

The separate read-only `attestation-archive-shadow.mjs` experiment accepts an
already-retained regular file up to 5 GiB. This does not increase the media
retainer's 256 MiB cap or implement a larger downloader. It hashes the complete
file in reusable 64 KiB buffers before seeking the directory. Bounds are 16 MiB
for that directory, 32 MiB total metadata reads, 16,384 members and 8 MiB for a
selected manifest and its compressed payload. ZIP64 is explicitly unsupported.
Traversal, duplicate/aliased selected members, symlinks/non-files, overlapping or
hidden regions, local/directory disagreement, CRC failures and unconsumed
compressed bytes are rejected. Native read and close failures remain separate
originals. Blocking filesystem calls require the owned external supervisor.

At source `2e14f39b75e7814266ba9d65f8c09fea12354495`, the first, middle and last
checkpoint members of retained artifact `13080399234` matched Python `zipfile`
byte-for-byte and the accepted reader semantically. Every lookup hashed all
3,756,836 archive bytes. Measured metadata reads were 66,645 bytes; lookup times
including inflation and CRC were 4.2874, 6.3983 and 44.2280 ms. These small-file
observations do not prove multi-GiB compatibility, ZIP64 support, hosted speedup,
provider provenance or a reuse certificate. The existing attestation loader and
all historical archive bytes remain unchanged.

Format reference: [PKWARE APPNOTE](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT).
