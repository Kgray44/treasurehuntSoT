---
title: Admiralty administrator bootstrap
audience: administrator
status: current
canonical_for: admiralty-administrator-bootstrap
last_reviewed: 2026-08-09
---

# Admiralty administrator bootstrap

Project Admiralty reuses canonical Voyagewright accounts, credentials,
sessions, and role assignments. It does not create a separate administrator
identity or login. The only Phase 1 bootstrap path is an explicit server-side
reconciliation command; no HTTP bootstrap endpoint exists.

Before using it, back up the intended database, apply the reviewed migration
for that database provider, and set `DATABASE_URL` explicitly. Select existing
canonical accounts with one or both server-only variables:

- `ADMIRALTY_BOOTSTRAP_ACCOUNT_IDS`: comma-, semicolon-, or whitespace-separated
  canonical account IDs.
- `ADMIRALTY_BOOTSTRAP_EMAILS`: comma-, semicolon-, or whitespace-separated
  exact primary email addresses.

Run `npm run admiralty:bootstrap:plan` first. The dry run resolves every
selector and reports `CREATE`, `REACTIVATE`, or `UNCHANGED`. A missing selector,
unresolved account or email, ambiguous state, or duplicate active administrator
assignment fails closed without a partial write.

After reviewing the plan and confirming the database target, run
`npm run admiralty:bootstrap:commit`. Role reconciliation and its canonical
administrative audit event commit in one transaction. The command is
idempotent for an already-active administrator assignment.

Removing an administrator remains a separately authorized canonical role
revocation; changing an environment variable is not runtime authorization.
Never put account selectors, database credentials, or command output containing
private identifiers in source control or public logs.

Project Admiralty Phase 1 is ready for an owner walkthrough on its named
development branch. Production database execution and deployment remain
separate operational approvals.
