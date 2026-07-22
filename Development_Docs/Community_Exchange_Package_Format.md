# Community Exchange Package Format

Packages are schema-versioned, non-executable `FT Community Package` payloads. Their canonical manifest records package ID, release ID, package/release schema versions, semantic version, platform compatibility, ordered items, dependencies, licence/attribution snapshots, and a sorted file table (`path`, SHA-256, byte length, MIME). Canonical JSON sorts object keys and preserves array order; package checksum is SHA-256 over canonical manifest plus the sorted file digests.

Paths are normalized POSIX relative paths beneath `manifest.json`, `items/`, and `assets/`. Absolute paths, traversal, backslashes, duplicate normalized/case-folded paths, symlinks, archives, executables, HTML/script payloads, external 3D URIs, and undeclared/extra files are rejected. Development limits are 256 files, 64 MiB total, 16 MiB per file, and a 16 MiB manifest. Production limits are configuration, not package-controlled.

An archive is inspected before storage finalization. A package is valid only after path, size, type, manifest, file-table and checksum verification all pass. Scanner and storage results are represented through Sealed Hold ports; `not configured` is not clean.
