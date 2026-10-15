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

The [first authenticated Library browser receipt](evidence/sc-00c/20261015-legacy-working-first-pass/README.md) passed its working-versus-release journey on `99dddac7`, but visual review found generic detail copy that implied an immutable version must be selected even when a typed working document exists. The receipt is preserved as a local pass with an open copy finding; it does not qualify a later wording change.

The [corrected-copy browser receipt](evidence/sc-00c/20261015-legacy-working-copy-pass/README.md) passed 1/1 with valid source binding on `59bb1506`. Its visually inspected Library detail distinguishes the read-only fixture preview, separate mutable working document, and pinned immutable releases without claiming an SC-01 Manager action. This closes the local copy finding on that source. Combined SC-01/SC-02 presentation, independent visual review, protected qualification, and owner acceptance remain pending.
