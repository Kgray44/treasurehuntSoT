---
title: Project Landfall Phase 4 integration manifest
audience: product-engineering
status: current
canonical_for: project-landfall-phase-4-integration-manifest
last_reviewed: 2026-10-04
---

# Hold the Bearing integration manifest

This manifest describes the implemented candidate on PR #677. Protected acceptance,
landed verification and Project Landfall closure remain pending. The [acceptance
matrix](Project_Landfall_Phase_4_Acceptance_Matrix.md) owns capability evidence and
external gates; the [native design](Project_Landfall_Phase_4_Native_Companion_Design.md)
retains exact development-run identities. Earlier Phase1–3 records remain historical.

| Surface                          | Integrated behavior                                                                                                                                                                                                                            | Authority and boundary                                                                                                                                                                                                         |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Canonical Landfall / One Voyage  | Native and web observations enter the existing physical/virtual domain, confidence gates and bounded canonical request path.                                                                                                                   | Current identity, membership, published pin, Worldspace and event sequence are requalified server-side. One Voyage remains the sole progression writer.                                                                        |
| Player Journal / embedded Chart  | One shared foreground controller consumes native location when available, readable fallback, released local search, optional sensor hints, provider status and prepared offline regions.                                                       | Deliberate consent; historical charts do not acquire sensors. Virtual Worldspaces never request physical location or radio evidence.                                                                                           |
| Android companion                | Origin-bound Activity/WebView, public OS location and sensor APIs, bounded Bluetooth/UWB sessions, CameraX/ML Kit QR and NFC reader, encrypted restart metadata and broad geofence reminders.                                                  | Configured HTTPS origin and main-frame bridge; debug loopback exists only for owned lab execution. OS wake/tap fidelity and distribution are independently qualified.                                                          |
| Apple companion                  | App-bound WKWebView, Core Location/Motion, deliberate Core Bluetooth, Nearby Interaction and installation acquisition, device-only encrypted metadata.                                                                                         | Matching HTTPS origin/domain, contextual permission and lifecycle stop. Unsupported Simulator radio/sensor physics remains explicit. Hosted macOS/Xcode execution is required.                                                 |
| Background / notification return | One bounded encrypted region, categorical wake journal, private generic reminder and authenticated opaque return handle. Android boot recovery rechecks consent/expiry before registration.                                                    | No callback, notification, token or saved region confirms arrival. The current server reauthorizes the return; fresh foreground evidence remains necessary. Actual registered-region wake/reboot/tap acceptance is still open. |
| Web / native offline             | Signed Ed25519 manifests and resource hashes precede bounded scoped AES-GCM storage. Native stores mirror metadata rather than map/resource bytes. Public shell caching excludes authenticated responses and external tiles.                   | Actor/Journey/edition/Worldspace/expiry binding; online revocation recheck, local clear and corruption rejection. Offline cached authorization cannot discover future remote revocation until reconnect.                       |
| Restart / reconciliation         | Native leases restore the fixed Journal path and existing encrypted repositories. The shared outbox reconciler acknowledges a lost server response through the actor-bound canonical receipt.                                                  | One expiring pending evidence item; no unlimited offline arrival queue, duplicate progression or second writer.                                                                                                                |
| Provider ecosystem               | Capability catalog, local authored lookup/routes/elevation, licensed configured server adapters and explicit optional device acquisition share status/preflight contracts.                                                                     | Client inputs cannot nominate remote URLs or credentials. Descriptors do not establish deployment availability; absent services report NOT_CONFIGURED or UNSUPPORTED.                                                          |
| Creator / Drydock                | Existing published definition, privacy, source-independence and fallback validation expose provider implications and capability availability. Device Lab receipts can be referenced at their actual fidelity.                                  | Authored context and simulations do not manufacture an effective physical verifier, public availability or field acceptance.                                                                                                   |
| Captain / replay / Lanternwake   | Existing sanitized canonical projections and progression presentation consume the same Landfall state.                                                                                                                                         | Native acquisition does not write a parallel history or expose raw trails to these surfaces.                                                                                                                                   |
| Admiralty / operations           | Bounded coordinate-free operational outcomes and recent configured-provider demand support current platform diagnostics and recovery.                                                                                                          | Process-local demand history is not a global uptime probe. Server configuration, device consent and release rollback are the implemented controls; no fleet native kill service is claimed.                                    |
| Device Lab / Sounding Line       | Canonical strict scenarios, provider executors, owned Android/iOS virtualization, hosted Windows/Linux/macOS transport, source-bound receipts and cleanup/fidelity enforcement. Ordinary Sounding Line consumes registered tests and evidence. | Lab transport is separate from protected testing authority. Exact-candidate ordinary qualification and protected merge are still required; physical and field evidence cannot be inferred from virtual devices.                |

## Data and release boundaries

Phase4 introduces no separate progression database, identity store, provider secret
store or Chronicle content model. Existing immutable published snapshots and actor
authorization remain the source of truth. The native private stores hold bounded
encrypted metadata; precise fixes, raw sensor/radio streams, pairing secrets and
decoded installation tokens remain transient. General Watchglass recognition and
a hypothetical Phase5 are outside this integration.

Unsigned Android lab packaging and ad-hoc Simulator builds prove source/toolchain
integration. They do not establish signed distribution, production origin setup,
licensed provider credentials, real-device qualification, field quality or owner
acceptance. The [operations record](Project_Landfall_Phase_4_Operations_Record.md)
documents configuration coupling, containment and recovery. The acceptance matrix
records unresolved local work separately from those external release gates.

## Qualification handoff

The final candidate must retain all Phase1–3 browser journeys, complete its selected
native/profile and provider matrices, reconcile security/privacy/performance results,
and satisfy ordinary protected Sounding Line against the actual base/candidate/tree.
This manifest becomes a closure record only with the completion receipt and accepted
capsule binding that qualification, protected merge and landed verification. Current
passing development runs do not substitute for that handoff.
