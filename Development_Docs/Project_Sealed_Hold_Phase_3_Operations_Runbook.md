# Project Sealed Hold Phase 3 Operations Runbook

Start web and worker separately with a restricted `EnvironmentFile`; run `private-content providers-check` before enabling mutations. A readiness failure means no provider fallback: block import/export/write operations, preserve existing clean read policy only where authorization still succeeds, and investigate the safe code.

Routine operations: run reconciliation as a bounded read-only operation; create a digest-bound dry-run repair plan; review counts and expiry; an Administrator explicitly approves its exact digest; executor rechecks the snapshot before each action. GC may delete only an old confirmed orphan with no live or backup reference. Provider outage or ambiguity blocks deletion.

Backup uses a database identity, canonical-record digest, object-set digest, and required key versions. Verify the newest backup before retention; retain prior verified recovery points on failure. Restore drills require a different isolated environment identifier, isolated database and object prefix, checksum/authorization/quarantine verification, then exact cleanup. Key rotation rewraps resumably; retirement requires zero live/backup references, verified restore, and explicit approval.

Shutdown sends SIGTERM to the owned worker, which stops claims and cancels active work. Do not delete locks, shared runtime directories, provider objects, or data outside the named isolated target.
