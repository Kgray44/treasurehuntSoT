---
title: SC-00C typed legacy Environment Library projection
audience: product-engineering
status: implementation-in-validation
canonical_for: parallax-sc-00c-legacy-working-environment-projection
last_reviewed: 2026-10-15
---

# Typed legacy Environment Library projection

SC-01's typed legacy catalog and API source `6be365f2ebdedf3c57df8b53c10e0c99f50f5d0d` supplies an optional mutable schema-one working document separately from positive immutable releases. The SC-00C Library projection now uses `working.content` for an owned Environment's current name, description, origin, fixture preview, dimensions, and search. It uses only explicitly known `working.metadata` for collection, favorite, and tags. When no working document exists, it may display the latest positive release without labeling that release as a current working pin. `workingRevision` is reported only when a working document exists; `immutableVersions` remains the independent release list.

The new focused test gives an owned working document different name, description, origin and organization metadata from its positive release. It checks the working view, search, exact release reference, no synthetic `current` property, and unchanged checksums of both records. Built-in release and archived legacy fallback tests remain. Four projection tests, changed-file lint and full TypeScript passed on the isolated D: branch. This is contract and host-side projection proof; it does not establish a rendered combined Library, SC-01 Manager, protected qualification, or owner acceptance.
