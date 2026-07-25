# Project Sealed Hold Phase 3 Disaster-Recovery Runbook

Choose the newest **verified** recovery point. Confirm only safe identifiers: backup ID/digest projection, manifest digest, object-set digest, source database identity, schema/package version, and required key-version names. Provision a fresh isolated database, private root/prefix, environment identity, and restore nonce. Never target canonical, production-like, or source-equivalent resources.

Authenticate the sealed manifest before restoring. Apply the ordered schema path, restore governed records and object bytes, then verify referential closure, byte lengths, SHA-256 values, mappings, wrapped-key requirements, clean/quarantine state, and required operation history. Verify Creator authorization, permitted revealed-player access, anonymous denial, and absence of publication, session, invitation, or Community side effects. Record a sanitized receipt only after verification succeeds.

For a drill, restart only owned web/worker processes and reverify durable records, objects, quarantine, backup state, restore status, and key lifecycle state. Two independent synthetic database-and-object drills completed through the validated ordered SQLite path. Controlled owned web restart and durable replacement-worker handoff are separately accepted; Linux/systemd host proof remains external. Do not rerun completed restore drills merely to create new filenames; rerun only after a material restore regression. Cleanup is limited to the exact isolated target.

On failed verification, retain existing verified recovery points, block destructive retention/GC, preserve opaque evidence, and investigate provider/key availability without exposing protected content.
