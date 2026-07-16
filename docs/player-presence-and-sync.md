# Player presence and synchronization

```mermaid
sequenceDiagram
  participant P as Player browser
  participant S as Server
  participant D as Database
  participant G as Command Center
  P->>S: heartbeat: device, route, visibility, acknowledged sequence
  S->>D: upsert PlayerPresence
  G->>S: GET status
  S->>D: load evidence and campaign sequence
  S-->>G: state, devices, last seen, lag
```

Connected means a non-disconnected heartbeat within 45 seconds. Recently lost means evidence within 120 seconds. Older evidence is stale; no evidence is unknown. A connected transport is never labeled “viewed.” Synchronized requires an active device whose acknowledged sequence equals the campaign sequence. Future production maintenance should expire records older than 30 days.
