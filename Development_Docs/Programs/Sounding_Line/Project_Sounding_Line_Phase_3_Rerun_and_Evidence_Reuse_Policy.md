---
title: Project Sounding Line Phase 3 Rerun and Evidence Reuse Policy
audience: engineering
status: current
---

# Rerun and reuse policy

Repair input includes original plan/results/root and blocked nodes, repair diff/contracts/fixtures/infrastructure/policy, and original valid evidence. Output lists invalidated/reusable/mandatory rerun/newly selected/retained evidence with a new plan digest and explanation. A failed root always reruns after repair; dependencies invalidated by repair and descendants blocked by it rerun after restoration. Documentation-only repairs may retain unrelated fresh runtime evidence only with proven independence. Changed fixtures, tests, policies, migrations, and infrastructure invalidate their dependents. No active evidence reuse is implemented by this package.
