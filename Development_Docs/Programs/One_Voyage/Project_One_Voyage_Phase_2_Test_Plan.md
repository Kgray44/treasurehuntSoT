# Phase 2 test plan

Focused gates cover Stage-F defaults, observation contract privacy/best-effort
behavior, static no-writer enforcement, canonical account-session issuance,
legacy migration checksum/rerun behavior, shadow parity, and compatibility
event/audit cardinality. The MySQL runbook supplies empty-chain, migration,
runtime credential, canonical-write, backup/restore, and restart evidence.

Final gates are Prisma format/validate/generate for both connectors,
formatting, lint, TypeScript, language, architecture, complete Vitest,
production Webpack build, focused browser compatibility/revocation journeys,
and the repository harness. Any Rive gate is recorded separately and never
converts an unrun Phase 2 gate into a pass.
