---
title: Local email testing
audience: product-engineering
status: current
canonical_for: local-email-testing
last_reviewed: 2026-08-05
---

# Local email testing

Set `HOMEPORT_TRANSACTIONAL_EMAIL_PROVIDER=SYNTHETIC_OUTBOX`, `HOMEPORT_SYNTHETIC_EMAIL_ADAPTER=TASK_OWNED_TEST`, `HOMEPORT_PHASE7_TASK_ROOT`, and a task-owned `HOMEPORT_SYNTHETIC_OUTBOX_PATH`. Never point the adapter at a shared or canonical directory. Read codes only from the task-owned private handoff/outbox used by the walkthrough harness; do not expose them in product UI, logs, committed evidence, URLs, analytics, or provider metadata.

Synthetic acceptance proves application lifecycle behavior only. It is not
Resend submission or inbox delivery. Switch to the selected real provider by
removing the synthetic override and configuring the server-only Resend variables
described in the [provider guide](../administrator/resend-configuration.md).

These instructions describe the Round 3 branch. They do not claim deployment,
live Resend delivery without a real inbox receipt, or owner acceptance.
