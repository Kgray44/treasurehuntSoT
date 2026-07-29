---
title: Project Sounding Line Phase 2 Rollback Instructions
audience: engineering
status: current
---

# Rollback Instructions

Stop new focused runs, retain their receipts, and use marker-verified cleanup
only after recorded listener identity has exited. Do not kill a PID based only
on a port, and do not delete an unmarked runtime. Restore ordinary validation
by omitting `SoundingLineLane`; it then requires the historical global lock and
port 3100. A source rollback is a normal reviewed Git revert; no database or
production data migration is part of this phase.
