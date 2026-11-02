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
Simultaneous transport, reader cancellation, lock release and file-close failures
retain separate stage-labelled original errors in process and bounded private
descriptions on disk. Receipt-write failures remain separate originals. Reader
cancellation unresolved at the one-second cleanup cutoff is explicitly recorded
as unresolved, fails the operation and grants no reuse; later completion is not
claimed.
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
retainer's 256 MiB cap. It hashes the complete
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

The separate `retainLegacyArchiveTransportShadow` lane now spools a supplied
response up to 5 GiB, with 64 KiB copies, at most 100,000 reads and a ten-minute
hard maximum. The media entry point cannot select those larger limits. Each lane
requires its own opaque readback handle; a copied receipt or cross-lane handle
cannot verify. Only the current read holds a cancellation callback, avoiding a
pending abort-promise reaction per chunk. These remain unhooked transport
experiments with declared expectations; neither supplies provider authentication
or changes the production downloader.

At source `e33d07d37450fc90e65732c5f3bb8a507a2334a0`, one generated stream
successfully retained and independently reread 4,294,967,297 bytes. Both hashes
were `3b65f13ee9a355239cf074c8c7221fea68873fd481d0166e57337f2a38b4da06`.
Retention took 15,308.097 ms and readback 4,372.413 ms, with 65,538 reads and one
65,536-byte generator chunk. RSS sampled at every generator pull and after
retention/readback reached 78,962,688 bytes; this is not an external process peak
measurement. This generated byte stream is not a valid-ZIP or native-provider
claim. A whole-response buffering baseline was not run at that size. Interrupted
declarations around 2 GiB and 4 GiB preserve failed prefixes; the separate media
lane still rejects those declarations before acquiring its reader.

## Preparation content rehashing

`preparation-content-shadow.mjs` independently hashes complete source and
destination layer directories. It bounds content to 2 GiB, metadata to 32 MiB,
entries to 200,000 and reads to reusable 64 KiB buffers under a 60-second local
deadline and the external owned-process guardian. Regular files must have one
link; symlinks, Git stores and directory aliases fail closed. Inventories include
file modes and empty directories. Descriptor/name identity, whole-tree membership
and timestamps are checked before and after reading. Separate read and close
failures preserve both original errors. Comparison rereads both directories;
serialized observations cannot stand in for opaque in-process handles.

At source `7ea3fe47ca6b64d9db111453d89224971af650b6`, the existing local Prisma
client contained 18 files and 45,402,804 bytes. Its private owned copy and both
independent rehashes matched inventory SHA-256
`5e67be52c40df0825ea0b9c000d8ea945bec378f080dccb884729eb3104f8b7d`.
The initial read took 847.776 ms, copying 24.564 ms, and destination measurement
plus both comparison rereads 603.037 ms. These are local existing-output
observations, not two fresh preparation runs or hosted savings. A declared layer
does not prove data classification, native publisher provenance, installed input
identity, expiry, revocation or external isolation. No certificate is issued;
normal fresh preparation remains required.
