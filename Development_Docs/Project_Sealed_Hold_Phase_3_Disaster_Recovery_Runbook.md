# Project Sealed Hold Phase 3 Disaster-Recovery Runbook

Select the newest **verified** backup only. Confirm its backup ID, manifest digest, object-set digest, source database identity, and required key versions. Provision a new isolated database, new private storage root/prefix, and a unique non-production environment ID; never point a drill at canonical or production resources.

Verify the encrypted manifest before restore. Restore governed records and private objects, then recheck object hashes, mappings, scan/quarantine state, key availability, Creator authorization, allowed revealed-player access, anonymous denial, and absence of publication/session/invitation/Community side effects. Record a sanitized receipt. Stop owned web/worker processes, restart only those processes, reverify, then remove only the exact isolated drill database/root/prefix.

On failed verification, retain all existing verified points, block destructive retention/GC, preserve opaque evidence, and investigate provider/key availability without copying private prose or wrapped-key values.
