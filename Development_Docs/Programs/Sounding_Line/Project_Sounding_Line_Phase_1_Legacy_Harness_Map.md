# Project Sounding Line Phase 1 Legacy Harness Map

All seven discovered PowerShell scripts are `REGISTERED_ADAPTER` children of `release.full`, owned by Breakwater. Their current authority remains unchanged.

| Surface | Current disposition |
| --- | --- |
| `scripts/test-all.ps1` | `npm run validate` full gate; owns `validation-runtime.lock`, local runtime, copied SQLite, ports 3100/3200, owned processes, artifacts, cleanup, and exit aggregation |
| `scripts/test-validation-runtime-safety.ps1` | safety proof adapter for the validation runtime |
| `scripts/start-dev.ps1` / `scripts/stop-dev.ps1` | development process adapters; no Phase 1 process action |
| `scripts/rehearse-project-one-voyage-phase2-mysql.ps1` | configured external MySQL rehearsal adapter; external evidence pending |
| `scripts/dev-common.ps1` | shared development helper adapter |
| `scripts/sync_codex_chats.ps1` | documentation synchronization adapter; no test-runtime authority |

BrowserOnly/family selectors, `BaselineDatabasePath`, fixed ports, Playwright startup, detached runner/process ownership, completion markers, cleanup markers, and exit aggregation are represented by the full-gate adapter and remain Phase 2 migration targets only. Retirement condition for every active adapter is a later accepted isolated replacement with equivalent safety proof; rollback is continued use of the existing harness.
