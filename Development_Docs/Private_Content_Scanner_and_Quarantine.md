# Private Content Scanner and Quarantine

**Status:** provider contract and deterministic synthetic fixture scanner implemented; ClamAV is implemented-external-unconfigured and never asserted clean when absent.

## States and invariant

The authoritative scan vocabulary is `PENDING`, `SCANNING`, `CLEAN`, `SUSPICIOUS`, `MALICIOUS`, `FAILED`, and `NOT_CONFIGURED`. Only `CLEAN` may be promoted for delivery. `NOT_CONFIGURED`, `FAILED`, and `SUSPICIOUS` never normalize to `CLEAN`; all non-clean results remain unavailable with opaque denial.

`PrivateContentScan` stores object, provider, state, safe code, and timestamp. `PrivateScannerProvider` reports health and a result with provider/version. `SyntheticPrivateScanner` is deterministic fixture coverage only. `UnconfiguredPrivateScanner` truthfully returns unhealthy/unconfigured and `NOT_CONFIGURED`.

## Required pipeline

An asset is received into private staging, bounded media validation occurs, a durable scan job is queued, then a clean result permits immutable promotion/finalization. Suspicious or malicious data moves to the separate quarantine namespace. Failed/time-limited scans retry under the durable-job policy; cancellation/restart recovery must retain the non-clean state.

Authorized override requires a distinct privileged authorization decision and audit record; it must not overwrite scanner evidence. Quarantined object metadata and bytes are not returned to ordinary callers.

## Media validation boundary

Current v1 payload validation allowlists image (AVIF/GIF/JPEG/PNG/WebP), audio (MPEG/Ogg/WAV), video (MP4/WebM), PDF, GLB/glTF, and generic binary metadata, with PNG/PDF/GLB magic checks where defined. Deeper bounded decoders and scanner execution remain required before this record can claim complete media acceptance coverage. No final 3D renderer is included.
