---
title: Project Helm Amendment A3 Validation Record
audience: product-engineering
status: current
canonical_for: project-helm-amendment-a3-validation-record
last_reviewed: 2026-08-27
---

# Project Helm Amendment A3 validation record

## Local candidate evidence

The implementation commit is `528af04cc82d0fa49c082cc089f3c72b87da36da`,
based on protected `origin/main` `e1a8d7eb1a6280bd3a6384070be519a72e0d9674`.
The following evidence is isolated and local until the final candidate-bound
Sounding Line decision and protected main landing are recorded.

| Evidence                      | Result                           | Boundary                                                                                                                                                                                                                                                                                                                               |
| ----------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused Helm/component suites | passed, 51 tests in 8 files      | Player and Captain room components plus canonical progression, operations, invitation, lifecycle, authority, and Captain Library proof passed in a clean validation worktree.                                                                                                                                                          |
| Changed-source lint           | passed with one existing warning | A3 files had no lint errors. The existing Player Waiting Room dependency warning remains outside the A3 change.                                                                                                                                                                                                                        |
| Production build              | passed                           | `next build` completed in the task-owned validation worktree. Turbopack retained one existing broad-trace warning from `next.config.ts` and the sealed-hold public-media route.                                                                                                                                                        |
| Built-server A3 journey       | passed, 1/1                      | Chromium ran the A3 journey after production build against a fresh task-owned migrated and seeded SQLite database. It proved Captain-only direct launch, participating-Captain state and launch affordance, invitation/ready transitions, ordinary Player limits, responsive/reduced-motion behavior, and Axe serious/critical checks. |
| TypeScript                    | repository baseline blocked      | A clean dependency install reports the same incompatible Playwright `Page` types across existing e2e files. The A3 call site is the same `AxeBuilder` pattern used by the pre-existing journeys; no A3-only TypeScript diagnostic was identified.                                                                                      |

## Safety boundaries

The browser fixture used an isolated `prisma/.helm-a3-browser.sqlite` database,
task-owned synthetic outbox, and a production `next start` server. It did not
read or write the canonical development database, an existing user account,
or a live provider. This record does not claim deployment, live-Voyage proof,
production MySQL execution, owner acceptance, or protected integration.

## Pending final authority

The final candidate SHA, ordinary Sounding Line/Mainline Decision, protected
pull request, merge ancestry/tree parity, landed smoke, and closure receipt are
recorded only after the source has completed that exact path.
