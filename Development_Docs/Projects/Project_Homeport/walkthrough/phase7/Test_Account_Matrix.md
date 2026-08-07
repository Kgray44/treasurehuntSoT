---
title: Project Homeport Phase 7 Test Account Matrix
audience: product-owner
status: current
canonical_for: project-homeport-phase-7-walkthrough-test-account-matrix
last_reviewed: 2026-08-04
---

# Test account matrix

| Alias                       | Capability or state            | Primary journeys           |
| --------------------------- | ------------------------------ | -------------------------- |
| `ANONYMOUS`                 | No account session             | N and public portions of O |
| `REGISTRATION_CANDIDATE`    | New synthetic account          | A                          |
| `RETURNING_FULL_CAPABILITY` | Player, Captain, Creator       | B, C, D, E, G, H, L, M, O  |
| `PLAYER_ONLY`               | Player only                    | F, K                       |
| `CAPTAIN_ONLY`              | Captain only                   | role-bound spot check      |
| `CREATOR_ONLY`              | Creator only                   | role-bound spot check      |
| `MODERATOR`                 | Moderator capability           | permission comparison      |
| `RESTRICTED_ACCOUNT`        | Suspended/restricted           | restriction spot check     |
| `EXPIRED_SESSION_ACCOUNT`   | Expiry variant                 | J                          |
| `RECOVERY_ACCOUNT`          | Password recovery              | I                          |
| `EMPTY_NEW_ACCOUNT`         | Governed empty Personal Harbor | H                          |

Passwords, reset links, invitation tokens, and other values are stored only in the external task-owned credential
handoff. Do not paste them into notes, screenshots, tickets, chat, or source control.
