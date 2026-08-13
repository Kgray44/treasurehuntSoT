---
title: Project Admiralty Phase 3 Account and Security Operations Architecture
audience: engineering-security-quality
status: current
canonical_for: project-admiralty-phase-3-account-security-operations
last_reviewed: 2026-08-13
---

# Phase 3 account and security operations architecture

Admiralty routes authorization, CSRF, reason capture, recent assurance,
preview, confirmation, and receipts to Wayfarer. Wayfarer owns account and
session state. Implemented operations are session revocation and active-account
suspension; both invalidate affected assurance and persist a security event and
redacted administrative audit in the owner transaction. Role assignment and
reactivation are not exposed until their dedicated owner command contracts are
implemented with last-administrator and self-modification safeguards.
