---
title: Embarkation - Independent Audit Publication
audience: product-engineering
status: current
canonical_for: refit-v1-embarkation-audit-publication
last_reviewed: 2026-09-24
---

# Embarkation independent audit candidate

This draft publishes the complete existing 35.8-second implementation on
`codex/refit-v1-embarkation`, based on the accepted Muster integration. It includes
the latest motion/fog/Stage C correction. Publication does not establish owner
acceptance, mainline reconciliation, broad acceptance or permission to merge.
The current local preview and its synthetic fixture remain intact.

## Reviewer map

- `src/animation/embarkation/`: director/lifecycle, WebGL renderer and shaders,
  authored program/camera/wind, deformable page and DOM materials, atmosphere,
  planar exterior water and moon registration, living light, audio, navigation,
  generic stage, inspector and focused tests.
- `src/components/muster/MusterRoom.tsx` and `muster.css`: mounted live Muster
  integration and material handoff. `src/app/layout.tsx` installs navigation capture.
- `src/muster/arrival.ts`, `arrival.test.ts`, `contracts.ts`, and
  `src/app/api/voyages/[voyageId]/muster/`: presentation state and arrival receipt.
- `src/components/homeport/AccountSurfaces.tsx`, `src/homeport/preference-runtime.ts`,
  and `src/wayfarer/profile.ts` / `profile.test.ts`: global quality/audio preferences.
- `src/app/dev/embarkation/`: guarded synthetic preview entry and its route tests.
- `public/images/embarkation/`: all 64 task-owned optimized textures and supporting
  derivatives, including the active Stage C water, pier and extended backing.
- `scripts/refit/*embarkation*`: ingestion, derivation, fixture preparation,
  inspection, recording, focused verification and evidence assembly. Python
  derivation uses OpenCV and NumPy; JavaScript uses the existing repository
  dependencies. No package or lockfile change is part of this candidate.
- This directory: current design, asset/provenance/coverage records and screening
  proof, with earlier initial/Delta 1/Delta 2 evidence preserved as history.

## Evidence boundary

[Current screening](preview.md) and [correction proof](correction-proof.json)
record the existing 28 focused tests, 11 browser scenarios, living/replay and
environment-handoff checks, scoped lint and typecheck. These are retained prior
results, not a new acceptance run during publication. The correction restores
fast event-age flight and downstream extinction, uses rear-origin traveling fog
banks, shares the moon/light/reflection state and separates planar water from
rigid Stage C scenery. The 35.8-second cut remains unchanged.

[The publication snapshot](publication-snapshot.json) verifies every one of the
76 source/asset revisions in the latest local screening candidate against the
working files at publication. It adds LF-normalized SHA-256 and Git blob IDs for
text files because repository attributes normalize line endings on commit.
It also lists captured runtime texture paths; all static texture paths exist.
The Chronicle cover is served by the existing authenticated Voyage cover route.
The snapshot is a source-preservation check, not evidence of perceptual quality.

Existing normal playback measured 35.898 seconds; frame time was 16.7 ms median,
50.0 ms p95 and 83.4 ms p99, with CPU render p95 of 13.2 ms. This is local
development/video evidence, not locked-60-fps or broad-device qualification.
Arbitrary replacement scenery needs its own registered mattes, and camera paths
outside the authored projection are unsupported. Silent recordings do not prove
auditory quality. Owner acceptance remains pending.

## Intentionally retained locally

- `.runtime/muster/`: isolated database, synthetic account/session tokens, media,
  fixture state and process metadata. These must not be committed or copied from
  the owner's live preview into another environment.
- `.runtime/embarkation/`: supplied and generated lossless masters, source PDF
  extraction, generated intermediate art, diagnostic captures, silent recordings,
  logs, historical candidate ZIPs, one-off editing helpers and process metadata.
  Current safe evidence is represented by the records in this directory; raw
  runtime contents remain local and have not been deleted.
- The supplied Downloads ZIP/PDF and local attachments: retained sources, not
  runtime deployment inputs. Their derivative provenance and master hashes are
  recorded in the asset manifest. Re-derivation needs those local inputs; runtime
  review uses the committed derivatives.
- `.env` files, credentials, caches, `node_modules`, generated Prisma state and
  build output: excluded. Existing dependencies remain in the tracked lockfile.
- Unrelated generated migration-matrix drift: retained in the working tree.
  Only the Embarkation inventory rows are part of this publication.

Do not run fixture preparation or mutation-oriented verification against the
owner's running port 3138/database. Use a separately owned checkout and fixture
for independent execution. This publication did not reseed or reset the preview.
