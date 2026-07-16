# Known limitations

- SSE fan-out is process-local; database replay is durable, but multi-instance production needs Redis/pub-sub.
- Dedicated GM-only preview timeline, explicit replay targeting, and richer player presence are not yet implemented.
- Automated E2E currently covers security smoke paths; the complete manually validated GM-to-player flow needs stable database fixtures.
- WebKit managed browser was not installed in this Windows validation run.
- SQLite and MySQL schemas are intentionally parallel; schema edits must update both and add SQL to the connector-specific migration histories until a generation workflow is added.
- Final story content, private media, polished licensed audio, production monitoring, and deployment remain out of scope.
