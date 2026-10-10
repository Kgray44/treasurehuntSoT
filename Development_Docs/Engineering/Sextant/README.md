---
title: Sextant Phase 1 implementation and compatibility boundary
audience: product-engineering
status: current
canonical_for: sextant-phase1-implementation
last_reviewed: 2026-10-09
---

# Sextant Phase 1 — Set the Sextant

Phase 1 implements the capability/provider/permission/lease foundation under the [Sextant governing document](../../Governing/Project_Sextant_Device_Context_and_Hardware_Capability_System_Governing_Document_v1.0.md). It preserves accepted Chronicle behavior. It does not install new browser/native sensors, add a Player mechanic, implement AR/pairing, or certify physical hardware.

## Implemented contracts

| Module                                  | Responsibility                                                                                                                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/sextant/capabilities.ts`           | 28 version-1 product definitions; exact Wave 4 hardware/semantic ownership mapping; canonical value, unit and frame contracts; Drydock-readable projection and requirement validation |
| `src/sextant/contracts.ts`              | Independent support, availability, permission, calibration, quality, freshness and lifecycle dimensions; provider metadata and lifecycle interface; strict observation envelope       |
| `src/sextant/providers.ts`              | Validated provider registration, isolated explicit discovery and compatible candidates; immutable registered identity; production rejects synthetic providers                         |
| `src/sextant/permissions.ts`            | Injected platform request foundation; explicit purpose and app consent; single pending request; denial/retry/restriction/revocation/user-pause handling                               |
| `src/sextant/leases.ts`                 | Per-surface provider arbitration, ephemeral leases, semantic update classes, quality/frame/freshness gates, monotonic ordering, expiry and owned cleanup                              |
| `src/sextant/observations.ts`           | Strict semantic validation and provenance; confidence separate from uncertainty; explicit synthetic identity; current age projection                                                  |
| `src/sextant/landfall-compatibility.ts` | Wrappers around accepted Landfall foreground context/position acquisition plus pure transient projections                                                                             |
| `src/sextant/synthetic.ts`              | Deterministic explicit Device Lab push provider; no production auto-registration                                                                                                      |
| `src/sextant/foundation-scenarios.ts`   | Nine executable D0 foundation scenarios in the shared Sounding Line Device Lab                                                                                                        |

Product capability IDs (`sextant.heading.estimate`) are distinct from hardware IDs (`heading`) and architectural ownership IDs (`device.heading`). Every product definition maps to an existing Sextant-owned Wave 4 row. Parallax-owned world tracking, plane understanding and occlusion remain outside this registry. A definition means the semantic contract exists; it never means a native provider is installed or hardware is currently available.

Drydock can call `SextantCapabilityRegistry.project()` without receiving Zod internals or hardware inventory. `validateRequirement()` rejects unknown capabilities, unsupported semantic versions and absent fallback declarations. This is the authoring seam; later Drydock spatial publication validation remains owner work.

## Observation and coordinate design

Canonical device coordinates are right-handed: +X screen-right, +Y physical screen-top, +Z out through the display. UI rotation does not rotate this frame. Attitude uses normalized quaternions; linear acceleration uses m/s², angular velocity rad/s, magnetic vectors microtesla, pressure-derived relative elevation meters, and bounded heading degrees in [0, 360). Position uses labeled WGS84 latitude/longitude and horizontal uncertainty in meters. Provider adapters must convert before emission; native conversion/fusion belongs to later phases.

Frames are explicit: DEVICE, SCREEN_ADJUSTED, GRAVITY_ALIGNED, EARTH_MAGNETIC, EARTH_TRUE, LOCAL_ARBITRARY, WGS84 or NONE. Relative attitude cannot satisfy an absolute-frame requirement. An observation binds capability/version, provider/version provenance, monotonic timestamp, sequence, age, discontinuity, units/frame, quality/calibration, confidence, optional uncertainty, lifecycle and warnings. Unknown confidence stays null. Wall-clock audit data is optional and never drives ordering/freshness.

Providers use the broker's monotonic clock domain. Future native adapters must translate their clock into that domain rather than passing unrelated boot-time timestamps. Duplicate, regressing, future, malformed and wrongly framed samples are discarded. Consumer max age/minimum quality gates produce degraded events rather than delivering apparently trustworthy readings. A new or switched provider marks the first delivered reading discontinuous. The broker retains clock/lease and latest quality/calibration metadata, not a raw observation history. `snapshot(capabilityId, maxAgeMs)` derives freshness using the consumer's threshold; omitting that policy reports UNKNOWN freshness.

## Permission and lease use

Create one shared broker per active surface runtime. Platform permission requests are injected; Phase 1 itself does not prompt hardware or start hardware listeners. Requests require consumer, surface, meaningful purpose, explicit app consent and a user action for prompting. Existing grants still require purpose/consent. Denial does not repeatedly prompt; explicit user-initiated retry is required. Late asynchronous grants cannot undo revocation or pause.

Consumers request a capability, permitted frames, quality, maximum age, expiry and semantic update class. They do not choose a provider or arbitrary sample rate. The broker shares one provider start across consumers, selects the highest requested class and down-samples each consumer. Providers translate classes to safe sampling rates within their declared bounds. All provider permission requirements must be authorized before selection. Leases are foreground-only and ephemeral in this plateau; later phases may add governed background behavior.

Explicit release, consumer unmount, surface disconnect, permission revocation, user pause, backgrounding, expiry, hard failure and disposal terminate leases. Expiry also fires when the provider is silent. Voyage end/sign-out owners call `dispose()`. Returning to foreground does not silently reacquire leases. Errors in consumer callbacks and discovery are isolated. Failed or unclean providers are quarantined for the runtime; cleanup failure is reported, never silently accepted as success. Provider startup must honor AbortSignal and provider stop must settle; startup/cleanup are each bounded to five seconds and a lease is bounded to one hour; provider-specific operating-system resource ownership remains with its adapter and Sounding Line's resource governor.

Diagnostics expose only active/failed counts and lifecycle flags. They contain no raw observations, exact location, consumer purpose or device fingerprint. There is no persistence, telemetry sink, identity authority or progression writer in Sextant Phase 1.

## Accepted Landfall inventory and migration seam

| Existing acquisition/context seam                     | Phase 1 disposition                                                                                                                                                               | Later migration                                                                                                       |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `src/landfall/browser-context.ts`                     | Accepted consented 1 Hz heading/motion hints, visibility cancellation and pending-permission cleanup preserved; `LandfallForegroundCompatibilityAdapter` wraps the exact provider | Phase 2 web providers can replace acquisition behind compatibility tests; existing Player consumers are unchanged now |
| `src/landfall/browser-geolocation.ts`                 | Accepted position watch and observation meaning retained; `LandfallPositionCompatibilityAdapter` wraps the exact provider                                                         | Generic acquisition migrates deliberately; geography/arrival remains Landfall                                         |
| `src/landfall/native-context.ts`, `native-sensors.ts` | Accepted native context/fusion and source policy retained                                                                                                                         | Phase 4 introduces native Sextant providers; no premature provider removal                                            |
| `src/landfall/local-providers.ts`                     | Authored floor labels/packaged elevation retain original uncertainty and domain meaning                                                                                           | Landfall keeps geographic interpretation; no pressure sensor invented                                                 |
| `src/landfall/contextual.ts`                          | Context, region/level inference, hint expiry and completion boundaries retained                                                                                                   | Consumes future Sextant context through the defined adapter seam                                                      |
| `src/landfall/nearby-provider.ts`                     | Accepted domain-specific nearby evidence retained                                                                                                                                 | Generic hardware session lifecycle migrates separately from Landfall meaning                                          |

The wrapper returns original `ContextualEvidence` unchanged and a separate ephemeral Sextant projection. It preserves denial, consent, one-listener behavior, throttling, relative-alpha rejection, foreground cancellation and no automatic restart. It must not run beside another owner of the same target listeners. Existing product imports/routes are unchanged.

Legacy HEADING lacks reliable north-reference/calibration provenance, so its projection uses LOCAL_ARBITRARY and UNKNOWN quality with explicit legacy warnings. Original Landfall hint meaning is preserved. Legacy MOTION remains a boolean derived hint, not a raw acceleration vector. ELEVATION remains an uncertain absolute hint, not pressure-derived relative elevation or a verified floor. Receipt monotonic time is labeled as receipt time, never sensor capture time. Other domain/context evidence is not relabeled as hardware truth.

## Shared Device Lab and qualification

`npm run device-lab -- --project sextant` runs the nine D0 contracts through the existing platform runner. `npm run sextant:device-lab -- --scenario sextant.permission-revoked` selects one. Source-bound v2 receipts are written under `artifacts/sextant-device-lab`; each includes scenario identity/fingerprint, actual source/base, assertions, cleanup and future physical/field requirements. The source fingerprint includes Sextant source and its CLI. Simulation is explicit in every observation; production provider registration rejects it.

The nine scenarios cover supported/unavailable capability, denied/revoked permission, provider switch, stale/low-quality observations, consumer sharing and simulation identity. Original 27 Wave 4 declarations remain historical baselines; nine Phase 1 declarations are added, with executability registered in the separate owner pack. Later magnetic, gesture and physical scenarios remain unimplemented. D0 evidence cannot be promoted to D4/D5 by choosing a tier.

Sounding Line suite `unit.sextant` protects `sextant.phase1.foundation`; shared infrastructure and Landfall compatibility remain separately selected. [Phase 1 implementation receipt](Project_Sextant_Phase_1_Implementation_Receipt.md) records the acceptance boundary. Ordinary Sounding Line on the exact candidate remains the sole mainline decision.
