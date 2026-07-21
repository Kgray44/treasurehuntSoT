# Project Wayfarer Phase 1 Test Plan

Status: **planned coverage; not yet complete**. This plan distinguishes implemented surfaces from unproven requirements.

| Acceptance area               | Implemented surface                              | Required proof                                                  | Current result                                |
| ----------------------------- | ------------------------------------------------ | --------------------------------------------------------------- | --------------------------------------------- |
| Canonical account/profile     | Prisma models and additive SQLite migration      | migration fixture and account/profile cardinality test          | migration applies; fixture test absent        |
| Registration/display identity | `POST /api/auth/register`                        | atomic creation and no-email-display API test                   | not run                                       |
| Email verification            | hashed `AccountToken`, verify/resend routes      | expiry, replay, idempotency, rate-limit tests                   | not run                                       |
| Password recovery             | generic request and reset-confirm routes         | known/unknown equivalence, single-use, session revocation tests | not run                                       |
| Sessions/CSRF                 | canonical account sessions and revoke routes     | individual/all revoke and state-changing CSRF tests             | not run                                       |
| Guest claim/merge             | canonical guest creation, claim and merge routes | preserved membership, collision, idempotency tests              | not run                                       |
| Roles                         | canonical role rows bridged into Captain guard   | one account reaches Player/Captain/Creator tests                | not run                                       |
| Legacy migration              | deterministic SQLite SQL backfill                | exact source/reconciliation fixture test                        | migration applies; reconciliation test absent |
| Actor references              | inventory and design only                        | Creator/Captain/new-write FK tests                              | not implemented                               |
| Privacy                       | private email/token storage design               | response-shaping and log-redaction tests                        | not run                                       |
| Full regression               | repository `scripts/test-all.ps1`                | format/lint/type/unit/E2E/build                                 | blocked by validation runtime                 |

The final test plan must not be signed off until every row marked not run, absent, or not implemented has focused automated coverage and the full isolated gate is green.
