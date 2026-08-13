---
title: Project Deepwater Phase 4 Visual and Accessibility Report
audience: product-engineering
status: current
canonical_for: project-deepwater-phase-4-visual-accessibility-report
last_reviewed: 2026-08-12
---

# Project Deepwater Phase 4 visual and accessibility report

The matrix defines required observed states and interaction checks for each natural journey family. Screenshots are identified only by sanitized IDs and SHA-256 values in the runtime-evidence record; raw browser profiles, credentials, tokens, private content, and task-root paths are excluded.

| Family                          | Accessibility and responsive requirements                                | Required states                               | Route or surface references                                                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| DW-P4-JRN-ACCOUNT               | KEYBOARD, VISIBLE_FOCUS, REDUCED_MOTION, MOBILE, ZOOM_200                | READY, LOADING, ERROR, UNAUTHORIZED, RECOVERY | /, /account, /passport, /profile                                                                                                                 |
| DW-P4-JRN-PERSONAL-HARBOR       | KEYBOARD, TOUCH, MOBILE, ZOOM_200, REDUCED_MOTION                        | READY, EMPTY, ERROR, RECOVERY                 | /, /profile, /passport                                                                                                                           |
| DW-P4-JRN-PLAYER                | KEYBOARD, VISIBLE_FOCUS, MOBILE, REDUCED_MOTION                          | READY, EMPTY, LOADING, ERROR, RECOVERY        | /, /player, /player/library, /player/playthroughs/[playthroughId]/journal                                                                        |
| DW-P4-JRN-CAPTAIN               | KEYBOARD, VISIBLE_FOCUS, MOBILE                                          | READY, EMPTY, UNAUTHORIZED, RECOVERY          | /, /captain, /captain/library, /join/[token]                                                                                                     |
| DW-P4-JRN-CREATOR               | KEYBOARD, VISIBLE_FOCUS, MOBILE, REDUCED_MOTION                          | READY, EMPTY, LOADING, ERROR, RECOVERY        | /, /studio, /studio/exchange, /studio/tales/[taleId]/trials                                                                                      |
| DW-P4-JRN-COMMUNITY             | KEYBOARD, VISIBLE_FOCUS, MOBILE, TEXT_CONTRAST                           | READY, EMPTY, LOADING, ERROR, RECOVERY        | /, /community, /studio/exchange                                                                                                                  |
| DW-P4-JRN-WHOLE-PRODUCT         | KEYBOARD, VISIBLE_FOCUS, MOBILE, ZOOM_200, REDUCED_MOTION, TEXT_CONTRAST | READY, LOADING, ERROR, UNAUTHORIZED, RECOVERY | /, /player, /captain, /studio, /community, /profile                                                                                              |
| DW-P4-JRN-VERIFICATION          | KEYBOARD, VISIBLE_FOCUS, MOBILE, ZOOM_200                                | READY, LOADING, ERROR, UNAUTHORIZED, RECOVERY | /, /account/register, /account/verify                                                                                                            |
| DW-P4-JRN-RESTRICTED-OPERATIONS | KEYBOARD, VISIBLE_FOCUS, TEXT_CONTRAST                                   | READY, ERROR, UNAUTHORIZED, RECOVERY          | /admin, /admin/support, /api/helper/verification                                                                                                 |
| DW-P4-JRN-BRIDGEWATCH           | KEYBOARD, REDUCED_MOTION, RESPONSIVE                                     | READY, LOADING, ERROR, RECOVERY               | bridgewatch, GET /api/summary, GET /api/projects, GET /api/attention, GET /api/activity?since=..., GET /api/tests, POST /api/telemetry/heartbeat |

The target viewport set is desktop, tablet, mobile, and effective 200 percent zoom where the family applies. Reduced motion, keyboard focus, touch, empty, loading, error, unauthorized, and recovery remain distinct checks rather than visual styling claims.
