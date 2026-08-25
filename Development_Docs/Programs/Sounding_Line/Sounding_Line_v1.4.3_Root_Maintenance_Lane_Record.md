---
title: Sounding Line Root Maintenance Lane Record
audience: engineering
status: current
canonical_for: sounding-line-root-maintenance-lane
last_reviewed: 2026-08-22
---

# Sounding Line Root Maintenance lane

## Purpose and boundary

`SOUNDING_LINE_ROOT_MAINTENANCE` repairs trusted control-plane infrastructure only. It is not a product lane, does not emit `RELEASE_GO`, and does not weaken branch protection. Its machine-readable policy covers the Nightwatch/Bosun and Sounding Line control planes, Baseline Certification, protected binding, the policy inventory, Deepwater inputs needed by certification, and their deterministic generated consequences.

The repair-route invariant builds its prerequisite set from the Baseline Certification implementation and protected workflow source references. Every discovered prerequisite is classified as `ORDINARY`, `VERIFICATION_MAINTENANCE`, `AUTHORITY_MAINTENANCE`, `ROOT_MAINTENANCE`, or `GENERATED_CONSEQUENCE`; an uncovered path fails with `CONTROL_PLANE_REPAIR_ROUTE_INCOMPLETE:<path>` before the configuration can certify.

## Trusted admission and binding

The lane is workflow-dispatch-only and accepts only a repository-owner dispatch. Its policy and classifier are read from the exact current protected base, then bind the exact PR number, base SHA, candidate SHA, candidate tree, sealed evidence, and synthetic protected merge tree. The policy from a candidate is never used to broaden that candidate's scope. Replay, stale base, changed candidate, changed PR, product paths, unknown paths, and ambiguous sealed evidence fail closed.

One sealed Root Maintenance dispatch can bind one protected merge. The protected binding leaves the existing Mainline Decision context and global branch protection unchanged.

### Binding-dispatch contract

The protected-binding dispatcher has an explicit `root_maintenance` evidence kind. It rechecks the live PR base/head relationship, reconstructs the synthetic merge identity, downloads the exact qualification artifact, and invokes the one trusted `root-maintenance-bind.mjs` helper from the qualified protected base. The helper recursively admits exactly one canonical `root-maintenance-envelope.json`, validates its policy, qualification, PR/base/candidate/tree identity and opaque string run ID, enforces replay rejection, then emits normalized input for the existing protected merge binder. Workflow PowerShell only orchestrates that handoff; it does not select, parse, or reinterpret Root Maintenance authority. It emits the unchanged `Sounding Line / Mainline Decision` context only for that root evidence kind; ordinary evidence continues through its existing binding path. The repair-route invariant verifies every lane's discovery, classification, admission, authorization, qualification, protected-binding, and merge-eligibility surfaces before Baseline Certification can pass.

### Owner-authorized Root Maintenance simplification cutover

The 2026-08-22 owner-authorized break-glass repair is limited to replacing the duplicated qualification-artifact selection and binding logic with the canonical envelope and helper described above. It is neither `RELEASE_GO` nor `BINDING_PASS`, does not alter branch protection, and expires when that single repair lands. The existing Ledgerlight canary PR #413 must subsequently requalify and bind through this normal path; no bypass is authorized for that canary.

## Bootstrap and break-glass boundary

The owner-authorized final root-control-plane bootstrap is the single exception needed to land this first lane: protected main necessarily lacks the policy and classifier that would otherwise authorize it. Its exact frozen base/head/tree, complete review, local certification, deterministic fixed point, and owner merge record are required before the exception may be consumed.

After this lane is on protected main, lower maintenance lanes cannot authorize repairs to themselves. If Root Maintenance itself is defective, only a new explicit repository-owner break-glass authorization may repair it; this is not a routine workflow route and must not be inferred from prior bootstrap authority.

## Deepwater capability-realization impact declaration

```json
{
  "disposition": "NO_REALIZATION_IMPACT",
  "affectedCapabilityIds": [],
  "affectedFeatureCatalogIds": [],
  "potentialLayerImpact": ["EVIDENCE_ONLY"],
  "affectedSurfaces": { "routes": [], "screens": [], "journeys": [], "apis": [] },
  "expectedTerminalRungEffect": "NONE",
  "evidenceRequiringRefresh": ["Nightwatch Baseline Certification", "Root Maintenance qualification"],
  "rationale": "Root Maintenance changes governed repository control-plane admission and evidence only. It cannot add, change, retire, or expose a product capability, Feature Catalog realization, route, screen, journey, or API."
}
```
