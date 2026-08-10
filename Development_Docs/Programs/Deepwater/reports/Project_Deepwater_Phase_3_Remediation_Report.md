---
title: Project Deepwater Phase 3 Remediation Report
audience: product-engineering
status: current
canonical_for: project-deepwater-phase-3-remediation-report
last_reviewed: 2026-08-09
---

# Project Deepwater Phase 3 remediation report

## Queue

The queue preserves every Phase 2 finding and adds the source-bound semantic-edition-comparison finding. Owner, external-provider, owner-acceptance, and active-fragment boundaries remain explicit.

| Finding                                              | Owner       | Category                     | Status   | Slice or boundary               |
| ---------------------------------------------------- | ----------- | ---------------------------- | -------- | ------------------------------- |
| DW-FIND-CATALOG-SURFACE-FT-005                       | One Voyage  | ALREADY_CLOSED_BY_MAIN       | CLOSED   | DW-P3-SLICE-CATALOG-PLAYER      |
| DW-FIND-CATALOG-SURFACE-FT-007                       | Helm        | ALREADY_CLOSED_BY_MAIN       | CLOSED   | owner/external                  |
| DW-FIND-CATALOG-SURFACE-FT-009                       | Drydock     | DOCUMENTATION_RECONCILIATION | ASSIGNED | owner/external                  |
| DW-FIND-CATALOG-SURFACE-FT-010                       | One Voyage  | DOCUMENTATION_RECONCILIATION | ASSIGNED | owner/external                  |
| DW-FIND-CATALOG-SURFACE-FT-011                       | Shipwright  | DOCUMENTATION_RECONCILIATION | ASSIGNED | owner/external                  |
| DW-FIND-CATALOG-SURFACE-FT-012                       | Drydock     | DOCUMENTATION_RECONCILIATION | ASSIGNED | owner/external                  |
| DW-FIND-CATALOG-SURFACE-FT-013                       | Drydock     | DOCUMENTATION_RECONCILIATION | ASSIGNED | owner/external                  |
| DW-FIND-CATALOG-SURFACE-FT-014                       | One Voyage  | DOCUMENTATION_RECONCILIATION | ASSIGNED | owner/external                  |
| DW-FIND-CATALOG-SURFACE-FT-015                       | Wakebook    | ALREADY_CLOSED_BY_MAIN       | CLOSED   | DW-P3-SLICE-CATALOG-PLAYER      |
| DW-FIND-CATALOG-SURFACE-FT-016                       | Landfall    | ALREADY_CLOSED_BY_MAIN       | CLOSED   | DW-P3-SLICE-CATALOG-PLAYER      |
| DW-FIND-CATALOG-SURFACE-FT-017                       | One Voyage  | ALREADY_CLOSED_BY_MAIN       | CLOSED   | DW-P3-SLICE-CATALOG-PLAYER      |
| DW-FIND-CATALOG-SURFACE-FT-018                       | One Voyage  | ALREADY_CLOSED_BY_MAIN       | CLOSED   | DW-P3-SLICE-CATALOG-PLAYER      |
| DW-FIND-CATALOG-SURFACE-FT-019                       | Wakebook    | ALREADY_CLOSED_BY_MAIN       | CLOSED   | DW-P3-SLICE-CATALOG-PLAYER      |
| DW-FIND-CATALOG-SURFACE-FT-020                       | One Voyage  | ALREADY_CLOSED_BY_MAIN       | CLOSED   | DW-P3-SLICE-CATALOG-PLAYER      |
| DW-FIND-CATALOG-SURFACE-FT-021                       | One Voyage  | ALREADY_CLOSED_BY_MAIN       | CLOSED   | DW-P3-SLICE-CATALOG-PLAYER      |
| DW-FIND-CATALOG-SURFACE-FT-023                       | One Voyage  | ALREADY_CLOSED_BY_MAIN       | CLOSED   | DW-P3-SLICE-CATALOG-ONE-VOYAGE  |
| DW-FIND-CATALOG-SURFACE-FT-025                       | Harborlight | ALREADY_CLOSED_BY_MAIN       | CLOSED   | DW-P3-SLICE-CATALOG-HARBORLIGHT |
| DW-FIND-EDITION-COMPARISON-SEMANTIC-UNDERUTILIZATION | Tideglass   | OWNER_PROJECT_WORK           | ASSIGNED | owner/external                  |
| DW-FIND-HOMEPORT-OWNER-DECISION-PENDING              | Homeport    | OWNER_ACCEPTANCE_REQUIRED    | ASSIGNED | owner/external                  |
| DW-FIND-TRANSACTIONAL-EMAIL-HEALTH-PROJECTION        | Wayfarer    | OWNER_PROJECT_WORK           | ASSIGNED | owner/external                  |
| DW-FIND-VERIFICATION-PROVIDER-REALIZATION-GAP        | Watchglass  | EXTERNAL_DEPENDENCY          | ASSIGNED | owner/external                  |

## Registered slices

| Slice                           | Owner       | Class | Status            | Branch                                     |
| ------------------------------- | ----------- | ----- | ----------------- | ------------------------------------------ |
| DW-P3-SLICE-CATALOG-PLAYER      | Ledgerlight | B     | MAINLINE_ACCEPTED | codex/deepwater-phase3-catalog-player      |
| DW-P3-SLICE-CATALOG-ONE-VOYAGE  | One Voyage  | B     | MAINLINE_ACCEPTED | codex/deepwater-phase3-catalog-one-voyage  |
| DW-P3-SLICE-CATALOG-HARBORLIGHT | Harborlight | B     | MAINLINE_ACCEPTED | codex/deepwater-phase3-catalog-harborlight |
