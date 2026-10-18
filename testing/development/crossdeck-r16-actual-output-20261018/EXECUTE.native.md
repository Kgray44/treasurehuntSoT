# Authorized native actual-output diagnostic

Owner: existing coordinator `01a13dd0-e3e1-7409-ab2a-b078e08ff0e1`.
Cloud remains the sole #721/#772 source and qualification owner. This is an
isolated, project-local validation against the already preserved original.
Do not dispatch, rerun, merge, move a protected ref, or change either PR.

The cloud proxy refused the approved original ZIP download with CONNECT 403.
This procedure does not transfer that ZIP or change the network policy.

Use a new private working directory outside the repository, its Git directories,
and the original-preservation directory. Retrieve this bundle from the exact
GitHub commit supplied with the handoff and verify its file pins. Source
retrieval may use local authenticated GitHub tools; no credential is relayed.

Prepare isolated source checkouts with raw Git bytes (no CRLF conversion):

| Role | Required HEAD |
| --- | --- |
| Original authority | `ea0918e0eb176507fe7cf8a41490ada9c51d0852` |
| Reviewed repair | `8a035ecb6a3ee4a941cbbe0f29b57362e164e01f` |
| Original candidate | `b1f06c10d3f2709cda366c266137fc38f4eb1df4` |

Materialize all `scripts/sounding-line` source in the two authority checkouts.
Use Node **24.19.0**, the repository-pinned runtime, and existing lock-compatible
dependencies prepared separately in these isolated roots. No browser, server or
database is needed. Candidate objects must already be local; do not use or alter
an active unpublished checkout. The helpers perform immutable Git reads only.

The original ZIP must be exactly **543,172,413 bytes**, SHA-256
`7f7006aa7fb39ed52a871015205285438fb26286ee6f6a9acb7195f1f6df7dd2`,
artifact **12136707006**, failed run **39125943388**, attempt **1**. Resolve its
actual filename from the preserved native custody manifest.

Run the setup helper with concrete native paths, recording the exact command,
start/end times, runtime versions, stdout, stderr and exit code:

```text
python prepare_native_actual_output.private.py --archive ORIGINAL_ZIP --original-authority-root EA_ROOT --repair-authority-root REPAIR_8A_ROOT --candidate-root C16_ROOT --output NEW_PRIVATE_SETUP_ROOT
```

Setup verifies the whole original before ZIP reads; checks every central-directory
member, streamed CRC and hash; refuses unsafe or duplicate paths; measures disk
headroom; extracts exclusively into a new directory; projects only exact C16
canonical preimages; and emits `replay-configuration.private.json` with concrete
paths and a pinned extraction manifest. Stop if setup fails. Preserve all outputs
and the original unchanged; do not overwrite or retry a failed directory.

Pin the concrete configuration and run:

```text
node replay_actual_publication.unexecuted.private.mjs NEW_PRIVATE_SETUP_ROOT/replay-configuration.private.json
```

This must reproduce the original exact unreferenced-output guard under both
original and unchanged repaired publisher code; preserve all 527 original staged
files; copy exactly the required 25 JSON plus 298 unique media files through the
production declared-copy boundary; retain the 204 auxiliary WebMs as encrypted raw
diagnostics; exercise before/after-rename rollback with a genuinely changed
tracked target; and complete strict publication. It does not rerun a browser or
producer, invent a database URL, rewrite witnesses, or qualify the product.

Return to this existing cloud task the exact source/bundle/configuration pins,
commands and process receipts, setup receipt, `terminal.private.json`, and
`actual-publication-proof.private.json` on success or `failure.private.json` on
failure. Include file sizes and SHA-256 and preserve their original bytes. A
private compressed report through the already approved task channel is suitable;
never relay an account token. Keep extraction, raw/encrypted outputs, source
snapshots and all journals on the native host for independent verification.

A pass establishes this diagnostic boundary only. The cloud must independently
verify the result and then complete a source-bound successor, fresh current
capture and review, technical/browser/replay evidence, qualified seal, protected
#721 merge and actual landed verification before releasing existing #722 and
spatial dependents.
