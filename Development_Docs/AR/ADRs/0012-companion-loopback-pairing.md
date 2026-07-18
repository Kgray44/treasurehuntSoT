# ADR 0012: Challenge-authenticated loopback Companion pairing

Status: accepted for Phase B-2

## Context

Browser/PWA surfaces need the same local capture core as the desktop application. A generic localhost API would let unrelated websites probe or operate capture. Browsers cannot add an Authorization header during the WebSocket upgrade, and putting a bearer token in the URL would leak it into logs and diagnostics.

## Decision

Bind an HTTP/WebSocket service only to `127.0.0.1`. Accept only exact configured origins. Pairing is an explicit two-surface ceremony:

1. an allowed browser origin creates a short-lived pending request;
   the browser includes a newly generated ECDSA P-256 public key;
2. the desktop Companion displays the origin and a random code;
3. the user enters that code in the browser;
4. the Companion returns an origin-bound, expiring pairing ID;
5. the WebSocket sends a fresh challenge;
6. the browser proves possession by signing the challenge, pairing ID, origin, and protocol with ECDSA P-256/SHA-256;
7. every command then uses a unique request ID and strictly increasing sequence.

Persist only the public key, expiration, approved origin, device identity, bounded replay metadata, and revocation state. Keep the private key in browser session memory only. Reject used challenges, invalid signatures, duplicate request IDs, non-increasing sequences, stale sessions, incompatible protocols, oversized messages, disallowed origins, and rate-limit violations.

Desktop integration bypasses browser pairing but still uses the same protocol schema and coordinator allowlist through private IPC.

## Alternatives considered

- Wildcard CORS or unauthenticated localhost: prohibited.
- Bearer token in WebSocket URL: rejected because URLs are routinely logged.
- Long-lived pairing code: rejected because it is replayable and brute-forceable.
- Automatic origin approval: rejected because capture must not begin without visible user awareness.
- Remote/LAN binding: outside B-2 and requires a separate threat model.

## Consequences

Pairing can expire and be revoked without restarting the Companion. A captured authentication proof cannot be replayed on a new connection because the challenge changes. The Companion stores no symmetric pairing secret. Loss of the browser's in-memory private key requires a new explicit pairing ceremony.

## Security implications

The browser protocol exposes typed capture operations, managed artifact preview/delete, status, privacy, and diagnostics only. It exposes no arbitrary file path, command execution, shell, full-resolution frame stream, or unrestricted preview endpoint.

## Compatibility implications

Capture protocol 2.0 is negotiated explicitly. B-1 protocol 1.0 remains intact for its deterministic development verifier and is not silently upgraded.
