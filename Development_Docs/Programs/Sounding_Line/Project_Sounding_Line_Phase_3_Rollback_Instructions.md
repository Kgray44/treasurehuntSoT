---
title: Project Sounding Line Phase 3 Rollback Instructions
audience: engineering
status: current
---

# Rollback

Stop selecting Phase 3 commands and return to the unchanged Phase 2 runtime and `npm run validate`; do not delete historical evidence. Quarantine any incomplete journal by marking its cleanup status accurately. The historical store is additive and outside product databases, so rollback does not modify application data, migrations, leases, or the global release lock.
