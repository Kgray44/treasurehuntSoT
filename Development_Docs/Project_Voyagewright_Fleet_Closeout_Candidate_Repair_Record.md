---
title: Voyagewright Fleet Closeout Candidate Repair Record
audience: product-engineering
status: candidate-repair
canonical_for: voyagewright-fleet-closeout-format-repair
last_reviewed: 2026-08-30
---

# Voyagewright fleet closeout candidate repair record

Both failed documentation-closeout candidates are terminal evidence and will
not be rerun. They used protected base
`ae159019eeab36c54a3fb358b73ffef1b4cd420f` on PR #627:

| Candidate                                  | Ordinary Sounding Line run | Preserved failure                                                                                                                                                       |
| ------------------------------------------ | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fa0d35fed7020f516d1878ca29a2d7d19a75ea45` | `33339783264`              | Prettier drift in `admiralty.json`, `captain.json`, and `project-drydock-phase4.json`.                                                                                  |
| `bb5e13e506f7fcc5da3f16074f9c3450c7cff5d2` | `33339880404`              | Prettier drift in `project-shipwright-phase5.json`, this Wakebook closeout record, the Tideglass Phase 4 integration manifest, and the public feature-status reference. |

Each trusted focused verifier stopped before product checks with
`SOUNDING_LINE_PRODUCT_FAILURE:VERIFICATION_COMMAND_FAILED`. The second
candidate was a limited formatting repair and did not re-run the first
candidate; its independent failure revealed the remaining changed-path drift.

The next superseding candidate applies canonical Prettier formatting to every
changed text path, then regenerates and revalidates the catalog and document
index. It changes no product behavior, acceptance claim, authority boundary,
or failed-candidate history.
