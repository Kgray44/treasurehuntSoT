# Parallax Phase 1 — Establish the Frame

Implementation date: October 10, 2026. Product acceptance: pending representative-device owner walkthrough.

## Implemented plateau

A released Journal passage can invoke its immutable Spatial Moment in Chronicle Lens. Guided View opens first without asking for camera access. Supported foreground native companions offer explicit camera consent and render bounded local entities using ARKit or ARCore. Unsupported, denied, interrupted, unresolved, or failed providers return to the same authored clue in Guided View.

Picking, inspecting, and surface placement produce typed observations. The server verifies the published version, released passage, actor membership, operation, freshness, and retry identity. It stores an isolated `ParallaxObservation`; it never completes a Passage, grants an artifact, changes inventory, or writes a progression event. Normal One Voyage confirmation remains the completion path.

This is the Phase 1 runtime plateau. Spatial Studio, reusable Spatial Library, adaptive placement, discovery of hidden content, Reach manipulation, shared/persistent anchors, Crossdeck synchronization, Watchglass recognition, and Wakebook capture are later phases.

## Requirement coverage

| Phase 1 requirement                          | Implementation                                                                                                                                                                           | Verification                                                                                          |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Definition / Version / Attachment / Instance | Strict `src/parallax/contracts.ts`; immutable version content checksum; published attachment pins version and checksum; per-run instance binding                                         | Contract, tamper, hierarchy, scope and publication tests                                              |
| Entity / anchor / coordinate frames          | Meter units, unit quaternions, right-handed +Y up / −Z forward, hierarchical transforms, cycle/frame checks                                                                              | Composition/inversion and frame tests                                                                 |
| Sextant / Landfall seams                     | Sextant purpose-bound camera broker; existing native companion transport; explicit matching Landfall worldspace-to-local transform                                                       | Native bridge consent/denial and fixed-worldspace fallback tests                                      |
| Native world tracking / planes               | Foreground ARKit `ARSCNView`, ARCore `GLSurfaceView`, horizontal/vertical plane hit tests, actual native entity picking                                                                  | Android Java compilation; iOS companion build gate; physical qualification remains separate           |
| Lens core                                    | Released Journal entry, focus-managed dialog, Guided View, explicit camera action, tracking guidance, inspect and retry controls                                                         | UI tests and browser layout/keyboard review                                                           |
| Fixed / local / surface anchors              | Frozen authored intent; supplied worldspace transforms only; bounded local frames; surface placement increments anchor version                                                           | D0 anchor/placement/tracking packs and cancellation tests                                             |
| Interaction receipts / owner seam            | Actor/session/published version/entity/anchor/time/provider provenance, nonauthoritative only                                                                                            | Evidence and transactional service tests; API authorization/CSRF/size/retry tests                     |
| Guided fallback                              | Authored equivalent narrative and readable entities, keyboard controls, seated/silent operation, reduced motion                                                                          | Guided, replay, provider-denied/unavailable and lifecycle tests                                       |
| Drydock / immutable publication              | Real block parser validates capsules; published readers validate checksum/binding; existing Studio snapshot preserves capsule                                                            | Published synthetic Chronicle through real Drydock simulation engine; publishing/security regressions |
| Shared Device Lab D0                         | Eight Parallax owner scenarios registered in existing catalog and executed through shared runner                                                                                         | `npm run device-lab -- --project parallax` with source-bound receipts                                 |
| Privacy / security                           | No camera frames, mesh, images or world maps cross transport or enter durable observations; camera stops on close/background; strict bounded payloads; session/player cascading deletion | Strict schema, lifecycle, replay/progression isolation and migration checks                           |

## Publication contract and fixture

`presentation.spatialMoment` is an embedded immutable release capsule containing Definition, Version, and Attachment. It travels through the existing Chronicle draft, Drydock parser, source checksum, publication snapshot, and Player Journal projection. The capsule avoids a mutable runtime library lookup. Attachment overrides are limited to narrative copy; entity identity, placement, interactions, version, and checksum stay pinned.

`materializeSpatialVersion` validates authored content and computes its canonical checksum. `validateSpatialMoment` verifies that checksum and the passage binding. `syntheticSpatialMoment` and `syntheticPublishedChronicle` in `src/parallax/fixtures.ts` provide a bounded private fixture. `src/parallax/drydock.test.ts` reopens its serialized published snapshot, invokes Lens, emits a Guided observation, then completes through the existing canonical Drydock/One Voyage simulation inputs. It creates no live account or published production Chronicle.

Phase 2 supplies the Creator-facing Spatial Studio and Library. Phase 1 provides the versioned release contract and runtime rather than hiding a full spatial editor in a block inspector.

## Runtime behavior

Chronicle Lens entry controls and its modal stay on the live Journal React surface, outside the page-turn runtime’s imperative clones and inert source pages. Entries come only from released Journal passages; completed and historical entries remain replay-only. Page-turn control focus is restored after both runtime and rendered controls settle, preserving keyboard intent when a busy turn temporarily disables the initiating button. Same-page runtime refreshes retain that intent and cannot fabricate a new page-turn gesture. Pointer activation records the initiating control even on platforms that do not automatically transfer focus.

- Native startup requires supported world tracking, an explicitly granted camera permission, foreground availability, and an accepted provider session. Browser-only and old native companions retain Guided View.
- Native interaction becomes ready after three normal tracking samples. Limited/lost tracking blocks interaction; recovery preserves object/anchor identity. Interruptions and backgrounding stop the native session and select Guided View.
- Fixed-worldspace anchors require an explicit matching worldspace and frame transform from the owning integration. Coordinates are never fabricated from latitude/longitude. The current Lens uses Guided View when that transform is unavailable.
- Surface hit poses are converted from the AR plane-normal frame to the entity quad frame and composed with authored offsets. Unsafe/no-surface placement and stale or interrupted operations cannot produce a successful receipt.
- Local poses and camera resources are ephemeral. Phase 1 does not save a world map or claim placement survives another native session.
- Guided placement is a presentation interaction, with `mode: GUIDED` and no physical qualification. It cannot be confused with a successfully measured physical placement.

## API and durable data

`GET /api/player/playthroughs/:id/parallax?block=:blockId` returns only a released pinned Moment and its server-resolved binding, with private no-store headers. Completed/historical passages are replay-only. Preview Chronicles cannot submit durable evidence.

`POST` requires Player identity, Voyage membership, CSRF, a rate limit, strict receipt parsing and an 8 KiB evidence bound. Recording rechecks the active passage/version and accepted membership in the transaction. The session/actor/idempotency-key unique constraint accepts identical retries and rejects changed evidence. Response disposition is `OBSERVED_ONLY`, `progressionChanged: false`, and `physicalQualification: NOT_ESTABLISHED`.

SQLite and MySQL migrations add the observation table independently of progression tables. Evidence contains only the typed interaction receipt, with no raw imagery, mesh, spatial scan, or location history. Session and Player deletion cascade to observations. This is local presentation evidence, not a Watchglass certification, a Landfall arrival, or a new completion provider.

## Verification commands

```sh
npx vitest run src/parallax src/components/player/parallax 'src/app/api/player/playthroughs/[playthroughId]/parallax' src/device-lab/device-lab.test.ts --maxWorkers=1
npx vitest run src/chronicle/published-snapshot-security.test.ts src/chronicle/publishing-phase4.test.ts src/drydock/contracts/registry.test.ts --maxWorkers=1
npm run typecheck
npx eslint src/parallax scripts/parallax src/components/player/parallax 'src/app/api/player/playthroughs/[playthroughId]/parallax'
npm run device-lab -- --project parallax
# Use an owned, disposable database for migration rehearsal:
DATABASE_URL=file:/absolute/owned/parallax-test.db npx prisma migrate deploy --schema prisma/schema.sqlite.prisma
# From native/android, with JDK 17 and Android SDK configured:
gradle --no-daemon --max-workers=1 :app:compileDebugJavaWithJavac
```

D0 receipts are written beneath `artifacts/parallax-device-lab` and bind to actual source SHA/tree/fingerprint and dirty state. They explicitly report provider simulation and future native/device/owner gates; they do not claim D4/D5 proof. Native build evidence establishes compilation, not tracking accuracy on real hardware.

## Recorded software verification

The reconciled Parallax/Crossdeck tree passes 150 focused tests across contracts, runtime, Drydock, API, Device Lab, Lens, Journal, PageFlip, and Crossdeck service/API seams. An additional 104 publication, snapshot-security, and Drydock registry regressions passed during implementation. All eight shared Parallax D0 scenarios pass. Both Prisma schemas validate, and all 73 SQLite migrations apply to an owned disposable database. Focused lint, formatting, and documentation validation pass.

Android’s final Java source compiles with JDK 17 and the declared Android SDK. The hosted iOS companion build, native tests, and permission-denial scenario passed in [Landfall Device Lab run 38032011931](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38032011931), bound to candidate `3bdfccd980d862d61f740222da4ace9de94eb27d`. The final iOS source and project/build inputs are byte-identical to that candidate. The Android texture change was compiled separately after that run. These are software/build results; physical tracking accuracy and owner acceptance remain unestablished.

The selected nested Playwright server configurations explicitly start from the repository root. Account-flow fixtures use the current exact field/action labels (sign-in, registration, verification, claim, email change, and recovery); their authentication, authority, timing, accessibility, and durable-receipt assertions remain intact. Focused production-browser checks pass for Admiralty Phase 1, all four Admiralty Phase 2 cases, both Admiralty Phase 3 cases, and Homeport Patch A’s owner-access regression.

The full selected generic cohort passes 24 production-browser cases. The existing Shipwright Phase 5 dedicated-fixture skip is retained. History and Artifacts are reached through current Chronicle Passport navigation; sign-in waits for the existing provider-readiness state. Shipwright Phase 2 seeds its missing synthetic Creator in the disposable SQLite fixture and closes the validation panel through its normal control before continuing Inspector work.

Homeport correction fixtures anchor active token, guest-session, export, and lifecycle deadlines to one preparation clock, while retaining historical source records and deliberately expired cases. Account journeys wait for the public provider-readiness state before entering credentials, and the review spoiler control is scoped to its accessible review form. Focused Round 1 journeys J–U pass with the normal production build, including export, reactivation, deletion cancellation, loading, review CRUD, motion, and the mobile sweep; their existing receipt and timing assertions remain intact.

All 14 Patch A journeys, all 23 Round 2 cases A–V, and all 21 Round 3 journeys A–U pass in focused production-browser runs. The inherited visual-inventory check validates the archived Homeport manifest against its original Git publication, including all 227 image checksums, 88-route census, contact sheets, and acceptance assertions; Brightwork's replacement corpus retains its separate pending-review status. Personal Harbor grids and the Passport action now reflow at 200% text zoom, with the unchanged overflow, keyboard, and accessibility checks passing. Slow-route fixtures prevent content prefetch from cancelling the intended delay, and motion probes sample mounted, rendered elements around actual user input. Reconciliation uses Node's `--import tsx` entrypoint without a CLI IPC socket.

All 15 original Homeport Phase 7 journeys pass in focused production-browser runs, including the final whole-voyage rehearsal. That rehearsal waits for completed sign-out and its public return-home state before checking the protected Account redirect; it cannot abort logout by navigating immediately after the click.

The account disclosure becomes inert and leaves the accessibility tree as soon as its retained visual exit begins. A focused regression verifies that keyboard and assistive navigation cannot reach the closing dialog; the exit animation remains intact.

Preference reconciliation ignores an initialization or focus read superseded by a newer same-tab save, account-scoped storage/broadcast update, later refresh, or account cleanup. Thirteen focused preference tests pass, including deterministic in-flight read races. The multi-tab browser journey verifies the second tab's authenticated public account control before measuring live synchronization.

Auth-route temporal receipts timestamp navigation-generation changes and loading visibility through the same DOM observer. A later polling sample cannot shorten the measured loading delay. The existing 480 ms assertion and the production 500 ms delay are unchanged.

Ordinary Sounding Line remains the protected-main integration gate, through [PR #692](https://github.com/Kgray44/treasurehuntSoT/pull/692).

## Product acceptance still required

On representative actual iOS and Android devices, the owner must walk through released publication → Guided Lens → explicit consent → local native placement → pick/inspect → tracking loss/recovery → Guided return → background/close cleanup. Include denial, low light, seated operation, sound off, reduced motion, and the historical-passage replay path. Retain source-bound evidence using shared Voyagewright Device Lab conventions. Record D4 qualification and owner acceptance separately from ordinary Sounding Line software integration.

Crossdeck Phase 1 is reconciled from protected main at `215beb2f81a7c9613993552b9f9999c00a4d34da`. Its devices UI, pairing and surface-identity models, APIs, and tests are preserved. Parallax's later shared-placement phases remain separate.
