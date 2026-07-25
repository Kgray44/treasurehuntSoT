# Project Sealed Hold Phase 3 Incident Response

For suspected disclosure: stop replication/public access, preserve opaque IDs and timestamps only, rotate affected credentials, inspect storage policy and logs without copying private prose, notify the owner privately, and do not rewrite history without separate authorization.

For malware: quarantine, deny delivery, retain safe scan evidence, revoke access, rescan after definition update, and audit every override attempt. For KMS failure/loss: block wrap/unwrap, preserve ciphertext, block GC, inventory affected versions, verify backups, and perform an isolated recovery drill; never claim replacement decryption ability.

For object/database mismatch: block affected delivery, reconcile both sides, create a dry-run plan, and restore only checksum-identical data. For backup failure: retain older verified points, halt retention deletion, alert, verify again after repair, and conduct a restore drill. Each incident records severity, owner, containment, recovery, reopening decision, and a sanitized postmortem.
