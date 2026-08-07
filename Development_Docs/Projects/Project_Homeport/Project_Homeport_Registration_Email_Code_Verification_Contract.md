---
title: Project Homeport Registration Email Code Verification Contract
audience: product-engineering
status: current
canonical_for: project-homeport-registration-email-code-verification-contract
last_reviewed: 2026-08-05
---

# Project Homeport Registration Email Code Verification Contract

## Scope

Registration-to-verification lifecycle for a pending ordinary account.

## Required behavior

- Registration creates a pending account and a server-scoped verification challenge, then navigates to a six-digit code screen instead of treating the account as fully ready.
- Six random digits are hashed at rest, expire, rotate on resend, are single-use, and enforce bounded attempts and resend rate limits without leaking account existence or codes.
- Invalid, expired, rate-limited, unavailable, resend-available, verifying, and verified states are distinct and accessible; verification activates the account and reconciles ordinary workspace entry atomically.
- Verification codes never enter logs, committed evidence, database receipts, URLs, analytics, or provider metadata.

## Verification

- registration/code service units
- API rate/attempt/expiry/replay tests
- synthetic delivery flow
- desktop/mobile invalid/success journeys

## Truth boundary

This architecture contract does not prove implementation, migration, live inbox delivery, evidence acceptance, Sounding Line authority, publication, owner acceptance, merge, PR, or deployment.
