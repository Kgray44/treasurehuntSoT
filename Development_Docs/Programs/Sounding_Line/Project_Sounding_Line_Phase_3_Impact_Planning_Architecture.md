---
title: Project Sounding Line Phase 3 Impact Planning Architecture
audience: engineering
status: current
---

# Impact planning and local/CI parity

Inputs are changed paths/identities, ownership, static and declared dependency graph, contracts, schemas/migrations, routes/APIs, authentication/authorization/public-projection/privacy/security changes, browser/runtime/build/dependency/fixture/infrastructure/policy changes, release gate, and declared uncertainty. The graph models TypeScript and dynamic imports, routes, Prisma/migration lineage, generated artifacts, Playwright routing, scripts/wrappers, documentation/catalog/policy/fixture dependencies, and cross-project contracts.

Plans are deterministic over source, policy, and environment declaration. Each selected suite records `selectedBecause`, `expandedBecause`, `requiredByContract`, `requiredByRisk`, `requiredByGate`, and `requiredByUncertainty`; each omission records `omittedBecause`, fresh-evidence proof, `externalOnly`, or `deferredWithDebt`. Unknown ownership/dependency expands. Critical unknowns prevent narrow closure. The preparatory prototype only tests synthetic mappings and never selects or executes product suites.

Local and CI compare source/policy/environment, paths, contracts, risk, selected/omitted suites, reuse/invalidation, and gate. Availability and capacity may broaden proof or change scheduling; they may not omit a critical suite or reinterpret a contract/risk floor.

Final-main reconciliation uses policy `1.1.0`, 14 suites, 17 contracts, and 19 resources. Synthetic cases cover a Harborlight moderation route/migration, lane runner, `scripts/test-all.ps1`, resource contract, Feature Catalog validator, Playwright lane configuration, process ownership, and cleanup receipt. Harborlight paths select its unit/SQLite/browser suites plus release evidence; lane/lock/port/cleanup changes select Sounding Line runtime evidence and broaden to release relevance. The P34 exception is historical risk evidence, never an omission rule; an explicit release request remains comprehensive.
