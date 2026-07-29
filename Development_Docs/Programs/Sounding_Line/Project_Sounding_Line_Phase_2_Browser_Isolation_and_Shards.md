---
title: Project Sounding Line Phase 2 Browser Isolation and Shards
audience: engineering
status: current
---

# Browser Isolation and Shards

Only Harborlight Phase 4 browser work is certified parallel: fixed lanes
`harborlight-a` and `harborlight-b` own separate mirrors, SQLite copies,
Chromium trees, artifacts, storage state and loopback listeners. They accept
only the Phase 4 spec and ports 3101--3199.

Normal validation retains its historical 3100 lock. Playwright and the
recorder reject a dynamic port unless the reviewed lane identity is present.
