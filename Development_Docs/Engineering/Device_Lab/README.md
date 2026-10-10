---
title: Voyagewright Device Lab shared infrastructure
audience: product-engineering
status: current
canonical_for: voyagewright-device-lab-implementation
last_reviewed: 2026-10-09
---

# Voyagewright Device Lab

Spatial Infrastructure Increment 0 extracts reusable verification infrastructure from the accepted Landfall Phase 4 lab. Sounding Line remains the verification and mainline acceptance authority. This layer does not implement Sextant, Crossdeck, Parallax, or their sensor semantics.

## Implementation inventory

| Shared path                                | Responsibility                                                                                     | Landfall compatibility                                                                                  |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `src/device-lab/device-profile.ts`         | Checked Android/iOS provisioning and profile selection                                             | Original module re-exports the same API and error identifiers                                           |
| `src/device-lab/receipt.ts`                | Existing v1 receipt/target/evidence contracts and fidelity validation                              | Original scenario module retains Landfall action typing and exports the shared receipt API              |
| `scripts/device-lab/host.ts`               | Host/tool discovery and bounded trusted binary calls                                               | Original script re-exports the same API                                                                 |
| `scripts/device-lab/source.ts`             | Exact commit/tree and source fingerprints                                                          | Original script re-exports the API; new fingerprints also include shared scripts and spatial registries |
| `src/device-lab/registry.ts`               | Validated Wave 4 catalogue, ownership, capability references, D0–D5 mapping                        | Historical scenarios retain original IDs and definitions                                                |
| `src/device-lab/scenario-pack.ts`          | Atomic project registration with owner/version/tier checks                                         | Landfall runtime/actions remain project adapters                                                        |
| `src/device-lab/runner.ts`                 | Bounded execution, explicit assertions, source/scenario binding, cleanup and v2 platform envelopes | Does not rewrite v1 receipts                                                                            |
| `src/device-lab/landfall-compatibility.ts` | Read-only namespaced view of an existing v1 receipt                                                | Retains the original receipt, physical requirements and evidence class                                  |

Landfall-specific provider assertions, One Voyage authority fixtures, browser/native drivers, platform builds, owned ADB controls and physical qualification remain in their accepted project paths. Their existing resource ownership and cleanup behavior are preserved. They are adapters, not generic sensor semantics owned by Device Lab.

The [Sextant/Parallax correction receipt](Sextant_Parallax_Correction_Receipt.md) records a shared TypeScript/Java/Swift boundary fixture and explicitly separates native compilation/lifecycle proof from D4/D5.

## Commands

- `npm run device-lab -- --catalog` validates and lists the Wave 4 declarations and tier descriptions.
- `npm run device-lab -- --project landfall --platform provider` delegates to the accepted complete Landfall provider corpus.
- `npm run device-lab -- --project landfall --platform android --scenario gps-perfect-walk --profile primary-phone` uses the existing configured native backend.
- `npm run landfall:device-lab -- --platform provider` remains supported unchanged.

Both Landfall command paths retain `artifacts/landfall-device-lab`, existing option validation, exit codes and receipt version. A catalogue listing is not a scenario execution and does not produce passing evidence. Unknown project names fail closed. No live emulator, phone or field evidence is produced merely by this extraction.

## Future project packs

Load `loadDeviceLabRegistry()`, construct `DeviceLabScenarioPacks`, and register an owner pack with explicit executable definitions and adapter factories. A definition binds its scenario/version to a catalogue declaration and supplies description, protected assertion IDs, fixtures, eligible execution tiers, profiles, timeout, expected artifact kinds, future gates and Sounding Line test references.

`runDeviceLabScenario` requires exact source identity, base commit, tier, host/runtime, profile and capability snapshot. The runner rejects unbound identities before adapter allocation. Unsupported tiers, profiles or capabilities never execute. A pass requires all protected assertion IDs, required artifacts, no unsupported capabilities, successful execution and clean cleanup. Simulation cannot become physical proof by selecting a physical tier absent from the executable definition.

Adapters acquire mutable resources through the existing Sounding Line/project resource governor. The shared runner creates no independent lock system. Adapters must settle on abort, clean only their owned resources, and report remaining resources. Timeout, malformed results, missing assertions and unconfirmed cleanup fail closed; an executor still live after timeout is explicitly reported as unsettled. Recovery remains the owning resource governor's responsibility.

Execution registration is separate from mainline acceptance. The runner never emits a release decision. Each owner must register real suites/tests/contracts through Sounding Line, supply genuine platform adapters, and meet required D4/D5 continuation gates. The original 27 Wave 4 entries remain baseline declarations; Increment 0 does not claim their product implementations. [Sextant Phase 1](../Sextant/README.md) adds nine separate D0 declarations and executable owner scenarios, bringing the current catalogue to 36 entries.

## Evidence compatibility

Existing evidence files and scenario fixtures are preserved byte-for-byte in the repository. New Landfall executions retain version 1 and historical error vocabulary; their fingerprints now cover the generalized inputs. New project executions use a version 2 platform envelope with owner, source/base, scenario fingerprint, tier, capabilities, assertions, artifacts, future gates, privacy and cleanup disposition.

A projected historical receipt is a read-only view. Its namespaced ID does not mean the similarly named Wave 4 scenario has been implemented or registered. Physical requirements remain required even after a simulation pass.

## Verification

The shared infrastructure suite is `unit.device-lab`, protecting `device-lab.shared-infrastructure`. Impact mappings include the neutral source/scripts and the Wave 4 scenario registry; shared changes also select accepted Landfall lab evidence. Historical Landfall suite/contract identity remains unchanged.

Focused development checks cover registry rejection paths, atomic registration, source/scenario binding, unsupported targets/profiles/capabilities, assertion failure, timeout, cleanup, identical compatibility exports and immutable receipt projection. The full accepted Landfall provider corpus and existing lab tests protect the extraction.

Final mainline acceptance is the ordinary `Sounding Line / Mainline Decision` on the exact PR candidate. See the [Increment 0 implementation receipt](Spatial_Infrastructure_Increment_0_Implementation_Receipt.md) for scope and development evidence.
