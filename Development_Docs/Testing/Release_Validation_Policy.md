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
