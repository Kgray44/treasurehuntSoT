# Release Validation Policy

| Gate                      | Purpose and minimum evidence                                                                                                |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Local change              | impacted static, unit/component, applicable service/API and focused browser evidence; impact explanation                    |
| Subsystem                 | local gate plus subsystem contracts, migration/database and accessibility as applicable                                     |
| Cross-project convergence | affected project suites and explicit producer/consumer contract matrix                                                      |
| Mainline                  | comprehensive applicable static, tests, migrations, browser/accessibility, privacy/security, build, cleanup                 |
| Release candidate         | mainline gate plus production build, restart, backup/restore and configured provider proof                                  |
| External provider         | MySQL, object store, scanner, KMS, system process, alert, or other live proof; unavailable means external blocked, not pass |

Independent gates may run in parallel with resource leases. Required gates cannot be silently omitted. The existing `npm run validate` is a serialized full-gate adapter, not a claim that all external provider gates are present or passing. Release decision receipts name selected, blocked, skipped-by-policy, and unavailable evidence separately.

## Version 1.1 evidence and closure rule

Gate evidence is invalidated by changed dependencies, not SHA difference alone. A prior immutable receipt may contribute through a new source-bound carry-forward receipt only when its contracts, producers/consumers, fixtures, policy, resources, and environment dependencies remain unchanged. Test-only changes must not invalidate unrelated proof without a written dependency explanation. After every invalidated mandatory obligation has fresh or preserved evidence, acceptance converges; repeated full gates require a new semantic dependency, changed gate requirement, evidence-integrity failure, or closure-revalidation incident. Documentation, index, receipt, and catalog-status work that does not change executable product or release-gate semantics is record-only and uses proportionate document/index/policy validation, not a release matrix. Hosted/reference runners are authoritative for timing-sensitive or provider claims; unavailable external proof remains blocked or unavailable.
