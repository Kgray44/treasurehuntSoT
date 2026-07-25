# Phase 3 Validation Record

Node 22.13.0 is required for the repository toolchain. SQLite and MySQL schema
validation, Prisma generation, TypeScript, lint, language validation, and
animation-asset validation pass on that runtime. The former Rive TypeScript
failure is repaired by directly declaring the compatible `@rive-app/webgl2`
runtime already used by the validator.

The empty-SQLite `migrate deploy` and disposable `db push` commands still return
the Prisma schema-engine's opaque error before any migration applies, including
on Node 22 with the verified Windows schema-engine binary. Canonical data was
not opened or changed; the isolated migration rehearsal remains blocked pending
an engine-level diagnostic.
