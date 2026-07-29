# Phase 4 Threat Model Update

The protected-media threat boundary treats original bytes, provider keys, encrypted envelopes, source filenames, EXIF/GPS/device metadata, private consent prose, and consuming-project private identifiers as confidential. Application delivery reauthorizes immediately before reading storage; public responses use opaque derivative identity only.

Controls include content-addressed private objects, scanner gating (`CLEAN` only), bounded raster decoding, metadata-free re-encoding, exact consent receipts, purpose/audience policy validation, opaque subject adapters, revocable grants, short public revalidation, no signed redirects, and withdrawal audit evidence. Unlisted and private responses use `private, no-store`.

Remaining external evidence is explicitly unvalidated: live ClamAV, S3/MinIO, AWS KMS, MySQL, alert transport, and Linux/systemd. Future Wayfarer and Harborlight convergence must retain the opaque-port boundary.
