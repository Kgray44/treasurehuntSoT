# Known limitations

- SSE fan-out is process-local; database replay is durable, but multi-instance production needs Redis/pub-sub.
- The Phase 3 preview is a sanitized state projection rather than a pixel-identical embedded Player Companion ceremony timeline; explicit replay targeting is not implemented.
- The full mutation workflow runs once in Chromium to avoid cross-project database contention; privacy, route protection, accessibility, and mobile behavior also run in WebKit.
- Windows LAN access is opt-in and may still require a firewall rule or network-policy change; localhost is the safe default.
- SQLite and MySQL schemas are intentionally parallel; schema edits must update both and add SQL to the connector-specific migration histories until a generation workflow is added.
- Final story content, private media, polished licensed audio, production monitoring, and deployment remain out of scope.
- Scheduling stores a future timestamp and stale-state evidence but has no background execution worker; scheduled actions require Game Master review and release.
- Recovery exposes only the latest safe single-step reversal. Full dependency-graph multi-event rollback is intentionally unavailable.
- Presence is durable per device but cleanup is documented rather than automated; production should expire records older than 30 days.
