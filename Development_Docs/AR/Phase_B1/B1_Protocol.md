# Phase B-1 Vision Protocol

Protocol version `1.0` is implemented in `src/vision/protocol.ts` with strict Zod schemas. Every envelope contains `protocolVersion`, `messageType`, `messageId`, optional `requestId`, `sessionId`, ISO timestamp, governed sender identity, and a message-specific strict payload.

The 27 messages cover Companion hello/capabilities/pairing/status; capture target and creator recording lifecycle; runtime scan start/progress/cancel/result/failure; build lifecycle; pause/resume; and diagnostic bundle request/availability. Capability negotiation describes capture, hotkeys, local inference, cloud build, offline packages, tray, diagnostic retention, hardware providers, supported protocol versions, and package schema versions.

Governed error codes distinguish unavailable/pairing/origin/capture/package/model/hardware/stale-stage/validation/mock/internal failures. Payloads reject unknown fields. The serializer parses before emitting, and the deserializer validates both envelope and the payload selected by `messageType`.

B-1 does not place raw frames or a model in protocol evidence. Runtime result evidence is a stable SHA-256 digest over deterministic, non-sensitive identifiers and the configured scenario. Contract tests round-trip every message family and reject invalid versions, malformed payloads, and extra properties.

Future compatibility is explicit: a Companion must negotiate protocol and package schema versions; a package mismatch is an incompatibility, not a silent fallback. The future localhost service must validate paired origins and expiring hash-only credentials before accepting capture commands.
