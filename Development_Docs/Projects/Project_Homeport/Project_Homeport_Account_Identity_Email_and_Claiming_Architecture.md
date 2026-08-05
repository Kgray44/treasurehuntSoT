---
title: Project Homeport Account Identity Email and Claiming Architecture
audience: product-engineering
status: current
canonical_for: project-homeport-account-identity-email-claiming-architecture
last_reviewed: 2026-08-04
---

# Account identity, email, and claiming architecture

Wayfarer `AccountSession` remains ordinary identity authority. Personal Information owns canonical display name and
primary email; public Profile consumes only authorized presentation fields. Raw account enums and internal IDs never
enter ordinary UI.

Claiming preserves the existing guest Profile, invitations, memberships, Player history, Captain/Creator relationships,
artifacts, Memories, consent, timestamps, and Chronicle aliases. New-account claim and proof-based existing-account claim
are collision-safe and idempotent. Human states are Guest profile, Account setup required, Verification required, Active
account, Deactivation pending, Deletion scheduled, and Restricted account.

Primary email is normalized, case-insensitively unique, private by default, and never substituted for display name.
Registration, sign-in, resend, verification, email change, old-address notice, recovery, challenge expiry/consumption,
rate limits, sensitive reauthentication, and session rotation/revocation use enumeration-safe results. One-time material is
stored only as a hash. Delivery uses an interface with deterministic task-owned outbox, configured production adapter,
and truthful unavailable state; simulator controls never appear on ordinary pages.

Schema changes remain behind the architecture census gate and must be additive for SQLite and MySQL.
