# Test Impact Analysis

Sounding Line uses a conservative graph of ownership paths, imports, routes, services, Prisma models/migrations, contracts, public APIs, UI consumers, cross-project boundaries, test metadata, and later historical correlation. Direct impact selects a changed source owner's suites; transitive impact follows consumers; contract impact selects producer/consumer suites; schema impact selects generation/migration/service/browser proof; release impact adds mandatory gates. Security/privacy paths always escalate. Unknown ownership, dynamic loading, generated output, or incomplete mapping is **uncertain impact** and broadens selection.

The planner emits `Selected because`, `Omitted because`, `Escalated because`, `Release-only`, and `External-only` for every candidate. An omission never says merely “not changed”; it names the evaluated dependency/contract policy.

| Change                                      | Required conservative expansion                                                                                                                                 |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/animation/PageFlipBook.tsx` | PageFlip unit, Journal component, Player Journal browser, responsive/zoom, Lanternwake lifecycle suites                                                         |
| `prisma/schema.prisma`                      | schema validation, generated-client proof, migration rehearsal, affected service/database/privacy projection, selected browser journeys, release migration gate |
| documentation-only correction               | formatting, documentation/link/schema checks; no browser unless the document is a generated runtime input                                                       |
| `src/app/api/**` authorization route        | route/service tests, authorization/privacy contract, selected browser denial/success journey, security escalation                                               |

The initial `testing/impact-map.json` is a seed, not proof of complete coverage. A change outside its map selects ownership fallback and marks the plan uncertain rather than reducing evidence.

Version 1.1 also requires inverse impact analysis: identify which existing receipts remain semantically valid after the change. A documentation or generator-only update does not invalidate unrelated proof unless it changes a policy, executable example, or dependency consumed by that proof. For test-only work, the invalidation ceiling is the changed family and direct finalizer/evidence consumers unless the plan explains a broader shared helper, fixture, route contract, semantic assertion library, or runtime-policy dependency.
