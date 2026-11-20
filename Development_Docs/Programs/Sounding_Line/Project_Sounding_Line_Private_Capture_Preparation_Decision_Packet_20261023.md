---
title: Private capture preparation decision packet
audience: engineering
status: inactive-local-draft
canonical_for: sounding-line-private-capture-preparation-decision-20261023
last_reviewed: 2026-10-23
---

# Private capture preparation decision packet

This continuation is an inactive local draft from protected base
`b2d901af5646ce76b3b2bd5a88e1ad8563c2db57`. It does not install a policy, retrieve
real credentials, dispatch capture, upload, change custody grants or merge. The
working source is in the owned maintenance checkout; #776 is untouched.

## Native allocation decision

**BLOCKED: enforceable native write confinement is unavailable, and the full
conservative retained ceiling does not fit D: while preserving its reserve.**

All copies below are counted concurrently. No unproved cleanup, compression
ratio, sparse allocation, shared-cache mutation or remote upload frees capacity
in this model. The numbers are proposed hard ceilings, not measured successful
capture capacity. Hitting a ceiling must fail and preserve the original outcome;
there is no truncation, sample dropping, parameter sweep or automatic retry.

| Allocation | Ceiling on D: |
| --- | ---: |
| Source checkout | 2 GiB |
| Dependency install and generated clients | 6 GiB |
| Browser download/cache | 2 GiB |
| Production build | 8 GiB |
| Database and browser profiles | 2 GiB |
| Native temporary output | 8 GiB |
| Logs | 1 GiB |
| Host tools | 3 GiB |
| Capture producer output | 4 GiB |
| Ready copies plus untouched producer JSON | 8 GiB |
| Raw producer output | 4 GiB |
| Encrypted raw retention | 9 GiB |
| Encrypted current evidence | 9 GiB |
| Downloaded provider archive | 9 GiB + 32 MiB |
| Private decrypted view | 4 GiB |
| Metadata and journals | 64 MiB |
| **Proposed local concurrent peak** | **79 GiB + 96 MiB = 84,926,267,392 bytes** |

This table models a hypothetical native capture and private retrieval on this
local host. Every row is charged to local D: in the admission plan. The hosted
GitHub runner has separate checkout/cache/build/temp/capture allocations on its
own disk; no hosted writer or measured hosted capacity is established here.
Remote copies are additional to this local plan. A hosted stage cannot receive
local cleanup credit without a separately reviewed source-bound placement and
lifetime model. Sequential execution alone does not prove that retained copies
have stopped occupying space. This conservative table keeps all copies retained
and makes no reduction to fit the available drive.

The checked workflow's experience-preparation job currently selects
ubuntu-latest. The [official standard-runner reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
lists 14 GB SSD for that hosted Linux label. That published specification is
distinct from measured free bytes on an actual invocation; no invocation was
started here. It cannot admit this proposed retained model. Hosted execution
requires its own actual-capacity preflight, enforced write confinement and
reviewed placement/lifetimes, or an explicitly approved runner redesign. The
[larger-runner reference](https://docs.github.com/en/actions/reference/runners/larger-runners)
describes additional capacities; account access, cost and any workflow change
need a separate owner decision. This draft neither selects nor installs one.

C: has a proposed additional allocation of zero only if an enforceable host
boundary denies every producer write outside the owned capped D: volumes. TEMP,
TMP, TMPDIR, USERPROFILE/HOME, npm/Playwright caches, Next output, SQLite,
browser profiles, logs, staging, download and private-view paths all need explicit
mapping. Environment variables and a Windows Job Object do not establish that
filesystem confinement. No such native boundary was installed or proved here.

Admission uses live free bytes separately on both drives, includes the entire
peak above, and rejects a projected value at or below 30 GiB (32,212,254,720
bytes). The host ReserveGuard preflight was invoked with this full estimate and
rejected it. No native producer was started. The precise live guard receipt and
shortfall are retained with the local source freeze. At 2026-10-23T05:41:14.5169683Z,
C: had 55,952,826,368 free bytes and D: had 111,251,247,104. The proposed
D: allocation would leave 26,324,979,712 bytes. Strict reserve compliance
would require at least another 5,887,275,009 free bytes on D: for this
unchanged ceiling; that capacity alone would not resolve confinement. This is
headroom for the dedicated storage owner's inspection only, not deletion
authority. No unrelated material is eligible for deletion to satisfy this plan.

A future accepted host adapter must enforce the cap below the native filesystem
writer, deny escape paths, and provide a creation-bound capability tied to the
exact volume identity, limit, process tree and source/run/session. Its actual
used bytes and both host free-space values must be monitored at most one second
apart while writers run, plus before every bounded stage. Detection stops only
owned writers, records observed peak and preserves cleanup/retention failures.
A monitor alone cannot bound writes between samples or constrain external apps.
The production native-admission function therefore always rejects. A separate
fixture realm proves pre-write limits and peak/stop semantics for synthetic
writes; its result cannot admit native capture.

Native ceilings may be narrowed only by a source-bound measured closure plus
independent review. Alternatively a separately authorized confined host with
sufficient reserved capacity is needed. Creating/mounting a volume, changing a
quota, account, ACL or runner is an approval-requiring installation action.

## Implemented private retrieval and adapters

The inactive retrieval implementation accepts an explicit HTTP transport and
credential callback. Tests provide only synthetic responses and generated keys;
there is no ambient credential lookup or network fallback. Metadata is bounded,
the requested repository/artifact/workflow/run/attempt and trusted actor are
checked before download, redirects require an exact approved HTTPS origin, and
the API Authorization header is not sent to the blob host. There is one request
sequence and no retry. [GitHub's artifact API](https://docs.github.com/en/rest/actions/artifacts?apiVersion=2022-11-28)
documents the authenticated redirect route and Actions read permission.

Downloaded encrypted bytes are streamed into one fresh owned file with a byte
ceiling. The actual file is rehashed through the same handle used for archive
validation. Metadata is checked again after transfer; changed/expired provenance
cannot mint the authenticated packet capability. Caller binding and nested
provenance are cloned and frozen before exposure. A monotonic elapsed deadline
is polled through synchronous archive reads, hashing, inflation and CRC loops;
late completion is rejected. This cooperative deadline cannot preempt a single
blocked native filesystem or zlib call. The owned fixture-test runner provides
a separate creation-owned outer process deadline. Archive cleanup verifies owned
file/directory identities and never recursively deletes unknown contents.

Cancellation retains a disposal observer for a request that ignores its signal
and later produces a response. The caller waits through a bounded cleanup drain;
late body cancellation/finalizer failures are combined with the original abort.
A still-unsettled request or finalizer is reported as incomplete cleanup, never
as success, while its registered observer remains to cancel a later body. A
locked late body is also a cleanup failure. This does not forcibly terminate an
arbitrary transport implementation that ignores cancellation.

The ZIP/ZIP64 reader validates central/local agreement, integer ranges, single
disk layout, exact member closure, regular-file attributes, signed descriptors,
nonoverlapping contiguous regions, actual expanded sizes and CRC32. Only opaque
parts, encrypted index and retention metadata are admitted. Deflate output is
bounded and trailing compressed data is rejected. No archive path is extracted.
Members are read lazily with a fixed per-member limit; the whole archive is not
loaded into memory. Corrupt CRC, traversal/duplicate names, links, missing parts,
ZIP64 overflow and declared expansion bombs are negative fixtures.

The digest check follows the downloaded-byte model in the
[official artifact client](https://github.com/actions/toolkit/blob/main/packages/artifact/src/internal/download/download-artifact.ts).
The deflate reader uses the
[Node 24 bounded convenience API](https://nodejs.org/download/release/v24.18.0/docs/api/zlib.html).
Synthetic ZIP64 fixtures establish parsing behavior at small sizes; they do not
prove native throughput or a successful multi-gigabyte capture.

The generated-key reviewer/verifier adapters require approved separate roles,
authenticate capture and independent review packets, and retain the original
artifact/media, semantic journey, substantive review, paired-witness, trusted
attestation and exception-custody validators. Explicit baseline-revision reads
remain separate; a missing current private file never falls back to historical
plaintext. Private plaintext views and encrypted download files close in finally
paths. Failure and cleanup remain separate facts. The production public entry
points remain disabled, and the adapters cannot reserve custody or mint a
protected integration decision. Post-action and post-cleanup cancellation reject
a late result. Original policy actor restrictions, first-attempt exception rules
and inner capture/review source/exception identity remain mandatory.

## Recipient and access proposal

No real key ID or fingerprint is selected. The required identity is SHA256 over
the approved RSA public key's DER SPKI; the protocol currently requires at least
3072 bits and RSA-OAEP-SHA256 with its versioned purpose label. The real policy
digest must include that fingerprint, approved producer/reviewer/verifier
principals, exact blob origins, retention and storage limits. Generated fixture
fingerprints are never approval candidates.

| Role | Required live capability | Boundary |
| --- | --- | --- |
| Capture producer | Existing protected workflow identity and public recipient key; existing upload runtime credential only when upload is authorized | No private key or decrypt permission in candidate execution |
| Artifact retrieval | Repository-restricted, short-lived GitHub App or fine-grained Actions read credential, supplied privately by the trusted helper | Never in argv, candidate environment, output, logs or redirected requests |
| Independent reviewer | Authenticated owner-approved principal, private decrypt access and capture-bound media review context | Principal must be independent of capture/build context; existing substantive review and custody rules remain mandatory |
| Verifier | Separately approved trusted verifier principal with read/decrypt access to exact capture and review packets | Cannot self-authorize source, custody or protected acceptance |
| Private key custodian | Approved private helper under a dedicated OS identity; approved key store/file ACL or reviewed nonexportable-key bridge | Key material is not exposed to the agent or product process; only the trusted helper decrypts |

The fixture adapter's actor parameter is test configuration. A production helper
must replace it with a live authenticated principal capability; a caller-provided
string or JSON access flag is not authorization. Public repository readers can
still download ciphertext. Key control and private helper access provide the
confidentiality boundary; encrypted publication does not establish authorship.

The helper should use an owner-approved encrypted-at-rest private volume outside
all candidate checkouts with restrictive verified ACL/owner identity, no inherited
candidate access, and bounded plaintext/file counts. Each invocation has a fresh
directory, explicit handles and cleanup identity. Every success, validation
failure, cancellation and review/verifier exception closes the view and download.
Cleanup failure preserves the primary error, blocks completion, and requires a
private recovery disposition; it does not recursively erase foreign files.
No secure-erasure claim covers filesystem journals, pagefiles or storage backups.

Requested retention remains 90 days. Actual provider expires_at and authorized
access must be checked on each real retrieval. Old artifacts/failed receipts are
preserved; there is no fallback to old plaintext for new publication.

## Actions requiring explicit approval

1. Select and independently verify the real recipient public key/fingerprint,
   custodian and named reviewer/verifier access policy.
2. Create/import or access a real private key, mint/connect live credentials, or
   test real decrypt/access. No secret should be pasted into chat.
3. Install a confined volume/quota, OS identity/ACL, private helper or runner;
   approve its capacity and custody/cleanup behavior.
4. Activate policy or production code, dispatch one consumer capture, upload,
   consume finite custody authority, qualify, publish a PR or merge. Each remains
   subject to its existing explicit scope and source-bound authorization.

No action in that list was performed. Completing these preparation fixtures is
not permission to activate them. Normal Linux/protected qualification and exact
landed verification remain later obligations. This partial capability warrants
no Feature Catalog fragment update.

## Local verification and decision

The retained preparation-fixtures-04 run passed 26 of 26 tests against core02
code, with owned process-tree and stream cleanup passing. The later allocation
limit snapshot correction and its new mutation regression supersede that source;
the final evidence manifest binds the subsequent focused result to core04.
It covers the strict archive cases, metadata changes/expiry, immutable provenance,
allocation at nonzero/external-growth usage, original validators, wrong inner
source/exception, plan actor policy, exception attempt and late cancellation.
The 19 protocol and 3 original-validator checks were repeated once when the
allocation dependency changed, with unchanged tests and limits. Those exact
receipts remain retained. For the historical core03-to-core04 rebind of these
19+3 checks, the allocation delta only snapshots caller caps inside the synthetic
fixture; original protocol/capture entry points do not reach that fixture. The
later core05 provider repair is separately exercised by its 30 focused checks.
It is outside the imports of those 19+3 original scopes. The final manifest
states both narrow reuse boundaries.
Every failed original remains retained.

Core01 independent static review requested corrections. Core02 closed those
findings; a later review found the fixture's mutable allocation-limit object.
Core04 snapshots that object and adds the regression, preserving the earlier
source freezes and its 27/27 receipt. A separate review then identified the
late-response disposal gap. Core05 supersedes the provider and its tests with
bounded late disposal, timeout/finalizer accounting and no-retry controls. The
final evidence manifest records the resulting review and focused receipt with
exact code hashes. A passing local fixture or static review does not
establish live authentication, real private ACL/key custody, measured native
peak, protected qualification or landed acceptance.

Preparation decision: **INACTIVE LOCAL DRAFT; NATIVE CAPTURE BLOCKED**.
No production activation, real API/key access, capture/upload/dispatch, grants,
PR, push or merge was performed. Host reserve checks cover this owned writer's
bounded steps; they are instructions and monitoring, not an OS quota, and do not
control external applications, cloud jobs or processes that did not load them.
