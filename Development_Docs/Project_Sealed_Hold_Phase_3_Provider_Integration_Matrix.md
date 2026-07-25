# Project Sealed Hold Phase 3 Provider Integration Matrix

| Provider | Implementation | Current evidence | Status / blocker | Safe probe and cleanup |
| --- | --- | --- | --- | --- |
| SQLite | Prisma schemas and isolated local tests | schema validation planned | simulated-local | disposable DB only; remove exact test file |
| MySQL 8 | ordered 0028/0029 SQL, runtime parity schema | no server/client discovered | blocked-external | create isolated schema; use separate migration/runtime identities; drop only that named schema |
| Local private storage | `LocalPhase2PrivateStorageProvider` | Phase 2 + focused contract | simulated-local | disposable absolute root, exact cleanup |
| S3/MinIO | SigV4 `FetchS3CompatibleObjectClient` and `S3CompatiblePrivateStorageProvider` | fake-client contract | blocked-external | isolated TLS bucket/prefix; HEAD/list only before write; remove exact prefix |
| Synthetic scanner | test-only fixture scanner | Phase 2 tests | simulated-local | no external cleanup |
| ClamAV | INSTREAM adapter with bounded PING | no service discovered | blocked-external | isolated PING then synthetic EICAR-equivalent policy fixture; clear quarantine prefix |
| Local development key | injected 32-byte key ring | focused tests | simulated-local | test process only |
| AWS KMS | SigV4 Encrypt/Decrypt/DescribeKey with encryption context | fake-client contract | blocked-external | describe isolated key alias; use protected credentials; no key deletion |
| Web process | Next process readiness composition | source-level evidence | unconfigured | owned isolated process only |
| Worker | `scripts/private-content/worker.ts`, systemd unit | source-level evidence | unconfigured | owned PID, SIGTERM, confirm lease release |
| Backup target | private `backups` namespace | recovery snapshot tests | simulated-local | isolated prefix and exact cleanup |
| Alerting | sanitized structured state codes | source-level evidence | implemented | no private payloads logged |

Minimum external permissions: S3 HEAD/GET/PUT/COPY/DELETE only under the private prefix; ClamAV byte-stream scan only; KMS DescribeKey/Encrypt/Decrypt with the fixed context; MySQL runtime has no DDL; migration identity alone applies DDL. Credentials belong only in protected server configuration and are never committed or printed.
