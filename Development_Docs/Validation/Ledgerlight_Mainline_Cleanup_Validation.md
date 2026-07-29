# Ledgerlight Mainline Cleanup Validation

**Status:** focused and broader unit validation complete.  
**Scope:** documentation, Feature Catalog, and repository cleanup reconciliation
on the consolidated mainline branch.

## Environment

The canonical checkout is on a UNC share and this shell has no `npm` on PATH.
`npm ci` therefore could not run. A task-owned local clone was created only for
validation, where pnpm 11.9.0 installed the lockfile dependencies, the configured
SQLite Prisma client was generated, and all non-browser gates below were run.
That fallback is not an `npm ci` pass.

## Results

| Command                         | Result                                                                | Classification        |
| ------------------------------- | --------------------------------------------------------------------- | --------------------- |
| `npm ci`                        | blocked: `npm` unavailable in this shell                              | not validated         |
| `npm run docs:index`            | passed                                                                | focused validated     |
| `npm run docs:validate`         | passed                                                                | focused validated     |
| `npm run test:docs`             | passed: 4 tests                                                       | focused validated     |
| `npm run features:sync`         | passed: 32 entries generated                                          | focused validated     |
| `npm run features:validate`     | passed: 32 entries                                                    | focused validated     |
| `npm run features:test`         | passed: 8 tests                                                       | focused validated     |
| `npm run format:check`          | passed for all changed, parser-supported files                        | focused validated     |
| `npm run typecheck`             | passed after `npm run db:generate` equivalent in the isolated runtime | focused validated     |
| `npm run language:validate`     | passed                                                                | focused validated     |
| `npm run architecture:validate` | passed                                                                | focused validated     |
| `npm run private-content:scan`  | passed                                                                | focused validated     |
| `npm test`                      | passed: 157 files / 1,096 tests                                       | integration validated |

## Browser and external boundary

No full historical browser matrix was restarted or claimed. `P34-BME-20260729`
remains an explicit blocked browser-matrix risk acceptance, not a 316-case or
full-matrix pass. Live provider, storage, scanning, production MySQL, and
deployment validation remain external validation pending.
