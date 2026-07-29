---
title: Testing
audience: developer
status: current
canonical_for: testing-guide
last_reviewed: 2026-07-29
---

# Testing

Run focused unit or route tests while changing a domain. Before review, run
formatting, lint, type checking, unit tests, private-content scanning,
documentation validation, and Feature Catalog checks as the environment
permits. `npm run validate` is the repository's complete gate.

Browser tests require isolated database and runtime configuration. A skipped
external provider check is not a passing production proof. The
`P34-BME-20260729` risk acceptance is a blocked browser-matrix exception, not
a complete matrix pass; retain that distinction in validation evidence. Record
environment limitations in engineering evidence, not in current user guides.
