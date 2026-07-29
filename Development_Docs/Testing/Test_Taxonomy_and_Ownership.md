# Test Taxonomy and Ownership

Every production subsystem maps to at least one family; every family has a project/subsystem/test-family owner; every critical cross-project contract has an explicit suite. Ownership is accountability for selection, fixtures, repair, duration, and evidence—not authority to waive another gate.

| Tier                          | Purpose, dependency rule, and repository examples                                                                                                                   | Isolation/evidence/retry/release relevance                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 0 Static and Structural       | formatting, lint, types, schema/asset/language/architecture checks; no browser/database mutation. Examples: `format:check`, `lint`, `typecheck`, `assets:validate`. | parallel read-only; command/version/output receipt; no retry except known infrastructure incident; required broadly. |
| 1 Unit and Pure Contract      | deterministic modules and domain contracts; mocks allowed at external boundaries. Examples: `src/domain/*.test.ts`, animation core, private-content package tests.  | worker-isolated temp state; assertions/counts; no provider dependency; required for affected source.                 |
| 2 Component                   | rendered UI behavior with controlled providers; no live mutable shared service. Examples: `src/components/**/*.test.tsx`.                                           | jsdom/temp state; accessibility-relevant assertions; selected by component consumers.                                |
| 3 Service and API Integration | routes, server policy, Prisma/service integration. Examples: `src/app/api/**/route.test.ts`, `src/server/*.test.ts`.                                                | cloned DB/service fixture; request/audit evidence; mandatory for API/schema impact.                                  |
| 4 Focused Browser Journeys    | user-visible behavior in owned server/browser. Examples: `chronicle-platform`, `wayfarer-phase2`, `harborlight-phase2` specs.                                       | leased port, browser, DB, root, trace; screenshot/trace/identity receipt; selected by journey impact.                |
| 5 Cross-Project Contract      | boundaries among project authorities. Examples: One Voyage compatibility, Wayfarer history, Sealed Hold/Harborlight projections.                                    | named contract fixture and owner; contract evidence; required on boundary changes.                                   |
| 6 Compatibility Matrices      | browser, viewport, motion, offline, historical/schema compatibility. Examples: WebKit mobile and phase-3 viewport/lifecycle cases.                                  | matrix shard plus read-only/mutating separation; matrix coverage receipt; release-selected.                          |
| 7 Full Release Proof          | comprehensive applicable static-to-provider proof. Existing adapter: `npm run validate`.                                                                            | all mandatory resources and cleanup receipt; governed retries only; required at release boundary.                    |

Dependencies may only flow upward when needed: Tier 0 may not depend on browser state; Tiers 1–2 may not mutate a canonical DB; browser suites may not use an unleased shared mutable DB; Tier 7 does not replace lower-tier diagnostics. Target durations are in [performance budgets](Testing_Performance_Budgets.md), not assertions that current suites meet them.

## Ownership model

- **Project owner:** owns product outcome and declares project-facing contract relevance.
- **Subsystem owner:** owns source path behavior and impacted tests.
- **Contract owner:** maintains producer/consumer boundary and fixture semantics.
- **Test-family owner:** maintains suite metadata, reliability, duration, and failure triage.
- **Infrastructure owner:** maintains runner, leases, images, artifacts, and safety boundaries.
- **Release-gate owner:** owns gate composition and exceptions, never product implementation.

The initial machine-readable mapping is intentionally representative; unmapped source is uncertain impact and therefore broadens selection. See `testing/ownership.json` and `testing/contracts.json`.
