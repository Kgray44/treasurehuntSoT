# Phase B-1 Security and Privacy

## Implemented controls

- Strict Zod schemas at lifecycle, binding, attempt, and protocol boundaries.
- Database-backed GM/Player sessions and existing CSRF checks on every mutation.
- Creator ownership checks for waypoint edits; publisher capability for publish/deprecate; Captain capability for diagnostics; session membership for Player attempts.
- Published-version immutability and exact version IDs in story bindings.
- Cryptographically random IDs, SHA-256 package/evidence digests, and hash-only future pairing secrets.
- Structured audit events for creation, edit, publication, deprecation, binding changes, attempts, and manual Captain actions.
- `Cache-Control: no-store` on APIs and a service-worker deny boundary for every sensitive/mutable route.
- CSP, clickjacking denial, MIME sniffing denial, same-origin referrer policy, and camera/microphone/geolocation/USB/serial denial.
- Restricted desktop command allowlist with sandboxed renderer; no generic shell or filesystem bridge.
- Evidence-bundle expiry/deletion fields; B-1 stores no frames, thumbnails, camera media, game data, or pairing secrets.

## Threat assumptions

| Threat                                   | B-1 treatment                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Malicious webpage calls future Companion | Web adapter is unavailable; future contract requires paired allowed origin and expiry             |
| Modified package                         | Publication stores SHA-256 hash, schema, and compatibility metadata; later runtime must verify it |
| Duplicate result                         | Stable story delivery idempotency key returns prior event; duplicate outcome is persisted         |
| Delayed/stale result                     | Current session stage and pending request are rechecked before delivery                           |
| Unauthorized mutation                    | Capability, ownership, CSRF, and server flag checks precede writes                                |
| Desktop command abuse                    | Only three validated commands cross the context-isolated preload                                  |
| Service-worker leakage                   | API/auth/Studio/Captain/Player/play routes are network-only/no-store                              |

## Privacy truth

The phrase “Inspect Surroundings” is a story interaction, not a claim of real capture. The UI identifies the deterministic mock. `capture: false` is returned by web and desktop capabilities. Real capture, model inference, OCR, object detection, game process inspection, memory reading, packet inspection, overlays, anti-cheat interaction, and automated gameplay are out of scope and absent.
