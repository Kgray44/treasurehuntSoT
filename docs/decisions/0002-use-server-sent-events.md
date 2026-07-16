# ADR 0002: Server-Sent Events
Date: 2026-07-16 · Status: accepted

Context: progression is server-to-player and ordered. Decision: SSE with event IDs, heartbeat, reconnect, Last-Event-ID/query recovery, and snapshot reconciliation. Alternatives: WebSockets and polling. Consequences: simpler proxy/runtime behavior; multi-instance fan-out later needs shared pub/sub.
