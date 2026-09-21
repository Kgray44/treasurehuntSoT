# Project Sealed Hold Phase 4 Test Plan

This plan is closed against the implemented request/grant workflow. It uses only task-owned SQLite databases, local provider roots, a synthetic JPEG, port 3114, and short-lived browser/worker processes.

- Focused contracts: purpose/audience escalation, source/aggregate/final-derivative consent binding, image metadata stripping, delivery headers, withdrawal idempotency, owner-route CSRF, backup and key-lifecycle coverage.
- Durable workflow: authenticated registration, association, source-bound consent, queued build, blocked-consent state, exact final consent, grant reconciliation, display readiness, and opaque public delivery.
- Access and privacy: owner access; anonymous denial; public opaque delivery; no storage key or source identity in API headers/body, browser DOM, browser storage, console artifacts, or reports.
- Browser acceptance: mobile portrait, reduced motion, keyboard focus, Axe with zero serious/critical violations, withdrawal denial, source retention, and source/derivative quarantine denial.
- Restart proof: the first worker composition creates durable blocked state; a fresh composition reconciles the exact final-consent grant. Idempotent job/grant keys and persisted operation state prohibit duplicate derivative/grant creation.
- Regression: one complete repository Vitest run plus targeted reruns; Phase 3 private-content/operations coverage remains included in the repository suite.

External-provider and cross-project convergence checks remain intentionally outside local closure: production MySQL, S3/MinIO, ClamAV, KMS, alerting, Linux service supervision, and live Wayfarer/Harborlight handshakes.
