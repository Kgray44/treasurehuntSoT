---
title: Project Admiralty Phase 3 Privacy and Redaction Matrix
audience: engineering-security-quality
status: current
canonical_for: project-admiralty-phase-3-privacy-redaction
last_reviewed: 2026-08-13
---

# Phase 3 privacy and redaction matrix

Command previews, receipts, audit metadata, and operator UI may contain only
target identifiers, safe lifecycle state, bounded human reasons, correlation
IDs, and owner receipt IDs. They must never contain password hashes, session or
CSRF tokens, OAuth tokens, provider secrets, database credentials, private
Chronicle content, raw package payloads, or KMS material. Owner failures return
safe availability messages, not raw errors.
