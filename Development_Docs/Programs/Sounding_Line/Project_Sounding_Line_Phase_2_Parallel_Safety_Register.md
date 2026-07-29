---
title: Project Sounding Line Phase 2 Parallel Safety Register
audience: engineering
status: current
---

# Parallel Safety Register

| Family                          | Status               | Boundary                            |
| ------------------------------- | -------------------- | ----------------------------------- |
| Sounding Line policy/runtime    | certified focused    | local marker and leases             |
| Harborlight Phase 4 unit/SQLite | certified focused    | isolated test state                 |
| Harborlight Phase 4 browser     | certified focused    | two named lane mirrors              |
| Build/MySQL                     | serial within family | build directory or external service |
| Legacy full/release             | emergency serial     | unchanged global harness lock       |

Unknown resources, ambiguous process identity, or missing receipts fall back to
serial handling or quarantine.
