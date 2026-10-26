---
title: SC-07A pinned Environment ownership revocation evidence
audience: product-engineering
status: isolated-test-pass-pending-protected-qualification
canonical_for: sc-07a-pinned-environment-ownership-revocation-20261015
last_reviewed: 2026-10-15
---

# Pinned Environment ownership at review and submission

Test-only source `4fd031c23faf6553c2430649dbf56648f6acf7db` adds an isolated integration case for a saved Scene whose pinned Environment becomes unavailable to its Creator after a successful server package review. The test transfers the synthetic Environment to another account, then verifies both a fresh review and a submission using the earlier review digest refuse the dependency. No Community listing is created and the private Scene remains saved. This checks the authorization boundary again at submission rather than treating a prior package review as enduring permission.

The [complete SC-07A isolated integration run](isolated-integration.log.txt) passed **6/6** on that committed source after bootstrapping a fresh task-owned SQLite database from checked-in migrations. TypeScript and targeted lint passed. This is server and database evidence for a synthetic ownership change; it does not prove third-party media redistribution rights, rendered Creator behavior, formal Product Experience review, protected qualification or owner acceptance.
