---
title: Deepwater Capability-Realization Impact Declaration
audience: engineering
status: current
canonical_for: deepwater-capability-realization-impact-declaration
last_reviewed: 2026-08-13
---

# Deepwater capability-realization impact declaration

Use this declaration in current project design records, completion records, or
the project-owned governance metadata for every governed capability-impacting
change. It is consumed by Deepwater structural validation; it does not create
product or release authority.

```json
{
  "disposition": "ADDS_CAPABILITY | CHANGES_EXISTING_CAPABILITY | RETIRES_CAPABILITY | EVIDENCE_ONLY | NO_REALIZATION_IMPACT",
  "affectedCapabilityIds": [],
  "affectedFeatureCatalogIds": [],
  "potentialLayerImpact": [
    "DOMAIN",
    "SERVICE",
    "API",
    "PROJECTION",
    "UI",
    "DISCOVERABILITY",
    "STATE",
    "ACCESSIBILITY",
    "JOURNEY",
    "OWNER_ACCEPTANCE"
  ],
  "affectedSurfaces": { "routes": [], "screens": [], "journeys": [], "apis": [] },
  "expectedTerminalRungEffect": "NONE",
  "evidenceRequiringRefresh": [],
  "rationale": "Required, including for NO_REALIZATION_IMPACT."
}
```

Use stable Deepwater capability and Feature Catalog IDs. A declaration that
changes a capability must name it. A declaration that says
`NO_REALIZATION_IMPACT` must name no affected capability or catalog entry and
must state why the work cannot alter realization.
