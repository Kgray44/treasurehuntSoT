---
title: Project Deepwater Phase 3 Utilization Report
audience: product-engineering
status: current
canonical_for: project-deepwater-phase-3-utilization-report
last_reviewed: 2026-08-09
---

# Project Deepwater Phase 3 utilization report

## Decision boundary

All 55 governed capabilities received an operation, safe-metadata, state, recovery, and consumer saturation review against accepted source `9de00293c73c2d4aea49dc5d2e7a2a4a0515afe1`. Realization and utilization remain separate dimensions.

## Result

- Backend operations or governed capability dimensions reviewed: 349
- Meaningful operations still finding-blocked: 4
- Safe metadata families still finding-blocked: 10
- Phase 3-discovered findings: 1

| Capability                                    | Owner              | Realization         | Utilization           | Operations | Disposition                  |
| --------------------------------------------- | ------------------ | ------------------- | --------------------- | ---------: | ---------------------------- |
| DW-CAP-ACCOUNT-DATA-EXPORT                    | Wayfarer           | FULLY_REALIZED      | FULLY_UTILIZED        |          3 | SATURATED                    |
| DW-CAP-ACCOUNT-EMAIL-CHANGE                   | Wayfarer           | FULLY_REALIZED      | FULLY_UTILIZED        |          4 | SATURATED                    |
| DW-CAP-ACCOUNT-LIFECYCLE-DEACTIVATION         | Wayfarer           | FULLY_REALIZED      | FULLY_UTILIZED        |          5 | SATURATED                    |
| DW-CAP-ACCOUNT-SESSION-ROLE-SYSTEM            | Wayfarer           | FULLY_REALIZED      | FULLY_UTILIZED        |          5 | SATURATED                    |
| DW-CAP-ARTIFACT-CABINET-ACHIEVEMENTS          | Wayfarer           | FULLY_REALIZED      | FULLY_UTILIZED        |          6 | SATURATED                    |
| DW-CAP-ARTIFACT-REVEAL                        | One Voyage         | FULLY_REALIZED      | FULLY_UTILIZED        |          5 | DOCUMENTATION_RECONCILIATION |
| DW-CAP-ASSET-LIBRARY-MEDIA-PIPELINE           | Shipwright         | FULLY_REALIZED      | FULLY_UTILIZED        |          5 | DOCUMENTATION_RECONCILIATION |
| DW-CAP-AUTHORITATIVE-PROGRESSION              | One Voyage         | FULLY_REALIZED      | FULLY_UTILIZED        |          5 | DOCUMENTATION_RECONCILIATION |
| DW-CAP-CAPTAIN-VOYAGE-OPERATIONS              | Helm               | FULLY_REALIZED      | FULLY_UTILIZED        |          5 | DOCUMENTATION_RECONCILIATION |
| DW-CAP-CHRONICLE-ARTIFACT-DEFINITIONS         | Drydock            | FULLY_REALIZED      | FULLY_UTILIZED        |          5 | DOCUMENTATION_RECONCILIATION |
| DW-CAP-CHRONICLE-PASSPORT-PUBLIC-PROFILE      | Wayfarer           | FULLY_REALIZED      | FULLY_UTILIZED        |          5 | SATURATED                    |
| DW-CAP-CINEMATIC-RUNTIME                      | Lanternwake        | FULLY_REALIZED      | FULLY_UTILIZED        |          6 | SATURATED                    |
| DW-CAP-COMMUNITY-BACKUP-RESTORE               | Harborlight        | INTERNAL_BY_DESIGN  | INTERNAL_ONLY         |          3 | INTERNAL_OR_DEPRECATED       |
| DW-CAP-COMMUNITY-EXCHANGE                     | Harborlight        | FULLY_REALIZED      | FULLY_UTILIZED        |         12 | DOCUMENTATION_RECONCILIATION |
| DW-CAP-COMMUNITY-HARBOR-DISCOVERY             | Harborlight        | FULLY_REALIZED      | FULLY_UTILIZED        |         10 | SATURATED                    |
| DW-CAP-COMMUNITY-OPERATIONS-HEALTH            | Harborlight        | FULLY_REALIZED      | FULLY_UTILIZED        |          3 | SATURATED                    |
| DW-CAP-COMMUNITY-WORKER-SCHEDULER             | Harborlight        | INTERNAL_BY_DESIGN  | INTERNAL_ONLY         |          5 | INTERNAL_OR_DEPRECATED       |
| DW-CAP-COMPATIBILITY-OBSERVATION              | Platform           | DEPRECATED          | NOT_APPLICABLE        |          3 | INTERNAL_OR_DEPRECATED       |
| DW-CAP-COMPLETE-PRODUCT-SURFACES-STATES       | Homeport           | FULLY_REALIZED      | FULLY_UTILIZED        |         10 | SATURATED                    |
| DW-CAP-CREATOR-STUDIO                         | Shipwright         | FULLY_REALIZED      | FULLY_UTILIZED        |          5 | SATURATED                    |
| DW-CAP-DEVELOPMENT-OPERATIONAL-TOOLING        | Breakwater         | INTERNAL_BY_DESIGN  | INTERNAL_ONLY         |          5 | INTERNAL_OR_DEPRECATED       |
| DW-CAP-DOCUMENTATION-GOVERNANCE-CATALOG       | Ledgerlight        | INTERNAL_BY_DESIGN  | INTERNAL_ONLY         |          5 | INTERNAL_OR_DEPRECATED       |
| DW-CAP-FINALE-CHAMBER                         | One Voyage         | FULLY_REALIZED      | FULLY_UTILIZED        |          5 | DOCUMENTATION_RECONCILIATION |
| DW-CAP-GLOBAL-SHELL-WAYFINDING                | True North         | FULLY_REALIZED      | FULLY_UTILIZED        |          7 | SATURATED                    |
| DW-CAP-GOOGLE-GITHUB-AUTHENTICATION           | Wayfarer           | FULLY_REALIZED      | FULLY_UTILIZED        |         11 | SATURATED                    |
| DW-CAP-GOVERNED-VERIFICATION-CONTROL-PLANE    | Sounding Line      | INTERNAL_BY_DESIGN  | INTERNAL_ONLY         |          8 | INTERNAL_OR_DEPRECATED       |
| DW-CAP-IMMUTABLE-PUBLISHING-EDITIONS-FORKS    | One Voyage         | FULLY_REALIZED      | PARTIALLY_UTILIZED    |          5 | OWNER_PROJECT_WORK           |
| DW-CAP-INTEGRATED-WHOLE-PRODUCT-VOYAGE        | Homeport           | PARTIALLY_REALIZED  | FULLY_UTILIZED        |         44 | OWNER_ACCEPTANCE_REQUIRED    |
| DW-CAP-INVITATION-CREW-LIFECYCLE              | One Voyage         | FULLY_REALIZED      | FULLY_UTILIZED        |          5 | DOCUMENTATION_RECONCILIATION |
| DW-CAP-PERSONAL-CHRONICLE-HISTORY             | Wayfarer           | FULLY_REALIZED      | FULLY_UTILIZED        |          5 | SATURATED                    |
| DW-CAP-PERSONAL-HARBOR                        | Wayfarer           | FULLY_REALIZED      | FULLY_UTILIZED        |          9 | SATURATED                    |
| DW-CAP-PLATFORM-ADMINISTRATION-SUPPORT-ACCESS | Admiralty          | FULLY_REALIZED      | FULLY_UTILIZED        |          9 | SATURATED                    |
| DW-CAP-PLAYER-JOURNAL                         | Wakebook           | FULLY_REALIZED      | FULLY_UTILIZED        |          5 | DOCUMENTATION_RECONCILIATION |
| DW-CAP-PLAYER-LIBRARY-VOYAGE-LIFECYCLE        | One Voyage         | FULLY_REALIZED      | FULLY_UTILIZED        |          5 | SATURATED                    |
| DW-CAP-PRIVATE-BACKUP-RESTORE                 | Sealed Hold        | INTERNAL_BY_DESIGN  | INTERNAL_ONLY         |          3 | INTERNAL_OR_DEPRECATED       |
| DW-CAP-PRIVATE-CHRONICLE-PROTECTION           | Sealed Hold        | FULLY_REALIZED      | FULLY_UTILIZED        |          9 | SATURATED                    |
| DW-CAP-PRIVATE-PROVIDER-HEALTH                | Sealed Hold        | FULLY_REALIZED      | FULLY_UTILIZED        |          3 | SATURATED                    |
| DW-CAP-PRIVATE-REPAIR-OPERATIONS              | Sealed Hold        | SECURITY_RESTRICTED | INTENTIONALLY_PARTIAL |          4 | INTERNAL_OR_DEPRECATED       |
| DW-CAP-PUBLIC-ORIGIN-TRUST-BOUNDARY           | Security           | INTERNAL_BY_DESIGN  | INTERNAL_ONLY         |          3 | INTERNAL_OR_DEPRECATED       |
| DW-CAP-REALTIME-PRESENCE-REPLAY               | One Voyage         | FULLY_REALIZED      | FULLY_UTILIZED        |          5 | DOCUMENTATION_RECONCILIATION |
| DW-CAP-ROLE-AWARE-NAVIGATION-SHELL            | True North         | FULLY_REALIZED      | FULLY_UTILIZED        |          4 | SATURATED                    |
| DW-CAP-ROLE-GATEWAY-WORKSPACE-ROUTING         | True North         | FULLY_REALIZED      | FULLY_UTILIZED        |          5 | SATURATED                    |
| DW-CAP-ROUTE-REACHABILITY-GRAPH               | True North         | FULLY_REALIZED      | FULLY_UTILIZED        |         10 | SATURATED                    |
| DW-CAP-SECURITY-PRIVACY-PLATFORM              | Security           | SECURITY_RESTRICTED | INTENTIONALLY_PARTIAL |          7 | INTERNAL_OR_DEPRECATED       |
| DW-CAP-SHIPS-LOG                              | Wakebook           | FULLY_REALIZED      | FULLY_UTILIZED        |          5 | DOCUMENTATION_RECONCILIATION |
| DW-CAP-SIDE-QUEST-LEDGER                      | One Voyage         | FULLY_REALIZED      | FULLY_UTILIZED        |          5 | DOCUMENTATION_RECONCILIATION |
| DW-CAP-STORY-BLOCK-SYSTEM                     | Drydock            | FULLY_REALIZED      | FULLY_UTILIZED        |          5 | DOCUMENTATION_RECONCILIATION |
| DW-CAP-TIDEGLASS-SEMANTIC-EDITION-COMPARISON  | Tideglass          | INTERNAL_BY_DESIGN  | INTERNAL_ONLY         |          6 | INTERNAL_OR_DEPRECATED       |
| DW-CAP-TRANSACTIONAL-EMAIL-DELIVERY           | Wayfarer           | BACKEND_ONLY        | PARTIALLY_UTILIZED    |          4 | OWNER_PROJECT_WORK           |
| DW-CAP-UNIFIED-CHRONICLE-PLATFORM             | Platform           | FULLY_REALIZED      | FULLY_UTILIZED        |          5 | SATURATED                    |
| DW-CAP-UNIFIED-IDENTITY-SESSION-AUTHORITY     | Wayfarer           | FULLY_REALIZED      | FULLY_UTILIZED        |          7 | SATURATED                    |
| DW-CAP-UNIVERSAL-LANGUAGE-DESIGN-SYSTEM       | Universal Language | FULLY_REALIZED      | FULLY_UTILIZED        |          6 | SATURATED                    |
| DW-CAP-VERIFICATION-PROVIDER-FRAMEWORK        | One Voyage         | PARTIALLY_REALIZED  | PARTIALLY_UTILIZED    |          5 | EXTERNAL_DEPENDENCY          |
| DW-CAP-VOYAGE-CHART                           | Landfall           | FULLY_REALIZED      | FULLY_UTILIZED        |          5 | DOCUMENTATION_RECONCILIATION |
| DW-CAP-WAYPOINT-REFERENCE-LIBRARY             | Drydock            | FULLY_REALIZED      | FULLY_UTILIZED        |          5 | DOCUMENTATION_RECONCILIATION |
