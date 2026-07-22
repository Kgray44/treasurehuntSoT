# Phase 2 backup and restore rehearsal

The isolated MySQL rehearsal takes a `mysqldump --single-transaction` backup
after migration and one canonical compatibility command, computes SHA-256,
restores it into a distinct schema, and compares Chronicle Session Event,
Platform Audit Event, and Compatibility Observation counts. It then restarts
the source MySQL instance and verifies persisted canonical events remain
readable.

Latest evidence: schema `phase2_0db17f8007cb`, restored schema
`phase2_0db17f8007cb_restore`, backup SHA-256
`ab14268b208c2ce44a1560b9a275eb2054cfb81813ea0bfd0057958e90b274b4`,
semantic/audit/observation mismatch count zero, and one successful restart.
The fixture has no private package or asset material, so asset-manifest proof
is intentionally not represented as a private-content backup pass.

Recovery remains restore to an isolated schema, validation, then a controlled
maintenance cutover. A post-canonical-event route rollback to Campaign state
is prohibited.
