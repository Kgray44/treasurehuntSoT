# Known limitations

- The repository is public. Final story, riddles, personal material, surprise content, production credentials, and private media remain intentionally blocked.
- SSE fan-out and interactive rate-limit counters are process-local. Database replay is durable, but multi-instance production needs shared pub/sub and rate limiting such as Redis.
- Chronicle media uses one local filesystem root. Multi-instance production needs shared object storage; antivirus scanning, resumable large uploads, and asynchronous processing remain hardening work.
- An isolated MySQL 8.0.46 migration/runtime/restore rehearsal passed in Phase 2. Production deployment proof remains separate, and legacy persistence
  removal remains blocked by a one-release observation window.
- The full shared-database mutation workflow runs once in Chromium. Privacy, access gates, the role gateway, accessibility, reduced motion, and mobile behavior also run as read-only WebKit coverage.
- Captain scheduling persists timezone-aware future state but has no background launch worker; the Captain must explicitly launch a ready or scheduled voyage.
- SSE access revocation is rechecked on its heartbeat interval, not through an immediate cross-process revocation broadcast.
- Final designer-authored Rive artwork, licensed audio, real private content, production monitoring, CI hosting, and deployment remain later release work. Current visual assets use documented local development samples and original SVG/CSS/Lottie fallbacks.
- The future vision provider remains deliberately inactive. Scoped helper pairing, a versioned verification contract, strict rejection rules, and a simulator exist, but the application does not capture camera frames or claim recognition accuracy.
- Windows LAN access is opt-in and can still be blocked by the host firewall or network policy; localhost is the safe default.
