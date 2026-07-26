# Protected Media Derivative Policy

Raster policy v1 accepts detected PNG, JPEG, and WebP only. It never trusts filename extensions. It rejects malformed, oversized, over-dimensioned, or excessive-pixel inputs; materializes EXIF orientation; re-encodes separate WebP display and thumbnail objects; strips EXIF, GPS, device fields, and embedded thumbnails; verifies checksum and byte length; and requires a clean scan of each exact output.

Audio, video, document, and 3D public derivative processing remains unavailable unless a separately validated deterministic processor is added. This phase does not treat absence of a processor as successful sanitization.
