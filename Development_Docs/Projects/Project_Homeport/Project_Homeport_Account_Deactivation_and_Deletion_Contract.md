---
title: Project Homeport Account Deactivation and Deletion Contract
audience: product-engineering
status: current
canonical_for: project-homeport-account-deactivation-deletion-contract
last_reviewed: 2026-08-04
---

# Account deactivation and deletion contract

Deactivation is reversible and separate from deletion. It requires a dedicated warning, optional reason, sensitive
reauthentication, confirmation, active-Chronicle resolution, session revocation, public-Profile hiding, workspace
suspension, notification, audit, and a centralized 30-day reactivation period.

Deletion uses stronger danger treatment, export recommendation, reauthentication, typed confirmation, a scheduled
30-day cancellation window, session revocation, notifications, Profile removal, provider unlinking, and an idempotent due
processor. Creator ownership, Captain Voyages, Player history, Community reviews, collections, artifacts, Memories,
consent, moderation, security audit, and any financial retention are explicitly reassigned, anonymized, tombstoned, or
retained according to authority; relational history is never blindly hard-deleted.

The ordinary owner re-review fixture never destroys its only primary account. Cancellation and due processing use fresh
destructive clones. Failed jobs remain visible and retryable without partial silent success.
