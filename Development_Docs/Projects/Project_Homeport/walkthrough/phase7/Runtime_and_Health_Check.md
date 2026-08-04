---
title: Project Homeport Phase 7 Runtime and Health Check
audience: product-owner
status: current
canonical_for: project-homeport-phase-7-walkthrough-runtime-health
last_reviewed: 2026-08-04
---

# Runtime and health check

The handed-off application must be available at `http://127.0.0.1:3717/`. Engineering status is obtained with:

```powershell
$env:HOMEPORT_PHASE7_TASK_ROOT = 'C:\Users\kkids\AppData\Local\ProjectHomeport\phase7-019fcdf5-8104-7593-a660-9992d08737be'
npm run homeport:phase7:walkthrough:status
```

Accept the runtime only when status reports healthy HTTP, an owned PID, port 3717, the final publication commit, the
expected branch, fixture `homeport-phase7-integrated-v1`, and the final walkthrough clone. Ports 3718 through 3720
must not retain Phase 7 listeners. The status output is bounded and must not display credentials or token values.

If the source SHA or ownership is unexpected, stop and ask engineering to rebuild/reprepare. Do not continue with a
stale or unowned process.
