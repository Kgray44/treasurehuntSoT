# Known limitations

- SSE fan-out is process-local; database replay is durable, but multi-instance production needs Redis/pub-sub.
- Dedicated GM-only preview timeline, explicit replay targeting, and richer player presence are not yet implemented.
- The full mutation workflow runs once in Chromium to avoid cross-project database contention; privacy, route protection, accessibility, and mobile behavior also run in WebKit.
- Windows LAN access is opt-in and may still require a firewall rule or network-policy change; localhost is the safe default.
- SQLite and MySQL schemas are intentionally parallel; schema edits must update both and add SQL to the connector-specific migration histories until a generation workflow is added.
- Final story content, private media, polished licensed audio, production monitoring, and deployment remain out of scope.
