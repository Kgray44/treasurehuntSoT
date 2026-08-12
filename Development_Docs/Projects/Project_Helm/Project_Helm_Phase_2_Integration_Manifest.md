---
title: Project Helm Phase 2 Integration Manifest
audience: product-engineering
status: candidate
canonical_for: project-helm-phase-2-integration-manifest
last_reviewed: 2026-08-10
---

# Project Helm Phase 2 integration manifest

## Pre-integration state

| Field                  | Value                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| Original base SHA      | `4a0f803a8ac4c238dc875da07df3cf0d1a5c81a3`                                                        |
| Branch                 | `codex/project-helm-phase2-read-the-deck`                                                         |
| Owned worktree         | `C:\Users\kgray\AppData\Local\ForeverTreasureCompanion\treasurehuntSoT-helm-phase2-read-the-deck` |
| Candidate commit       | Not yet created                                                                                   |
| Protected integration  | Not yet requested                                                                                 |
| Current mainline state | `NOT_INTEGRATED`                                                                                  |

## Intended additive surface

The candidate adds the Platform-owned `MembershipPresenceDevice` source with
paired SQLite/MySQL migrations; authenticated Player heartbeat transport;
privacy-safe Captain operational, crew, event, and Library projections; and
Sounding Line ownership/contract/registry coverage. It preserves the Phase 1
Captain authority and ordinary Player membership models, Captain commands,
TaleSession lifecycle/progression, and the compatibility-only aggregate
heartbeat field.

## Integration requirements

Before this manifest can be promoted to an acceptance record, the exact
candidate must have clean governed unit, component, and browser receipts,
pass protected integration against the current approved base, and demonstrate
that the accepted merge tree matches the validated candidate tree. No record
in this branch claims those future facts in advance.
