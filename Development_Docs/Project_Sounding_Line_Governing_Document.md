# Project Sounding Line

## The Software Verification and Parallel Test Infrastructure System

**Status:** PHASES 1-4 LOCAL CONTROL PLANE IMPLEMENTED — GOVERNED EXECUTION — NONAUTHORITATIVE
**Source baseline:** `origin/main` at `676b21ed030a5470d4ea0a36c0688ed3ecb161e5` (audited 2026-07-28)

## 1. Executive summary

Project Sounding Line is the repository-wide governing system for software verification, parallel execution, resource isolation, test selection, evidence, and release decisions in the Chronicles platform. Its local, nonauthoritative control plane implements policy/planning, leased runtime execution, durable history, root/cascade classification, and fail-closed Phase 4 worker/evidence controls. Its focused hosted workflow has passed on the integrated source. It does **not** establish remote-worker proof, provider validation, production signing, branch protection, or authoritative release decisions.

The governing order is: correctness; depth; determinism; diagnostic quality; speed; resource cost. Independent work should run concurrently only when it has independently leased state. A successful exit code alone is not a release decision.

> Run the deepest relevant tests as early as possible, execute independent work in parallel using isolated resources, and reserve exhaustive repository-wide proof for the correct integration and release boundaries.

> Test selection may reduce irrelevant work but may never omit a test required by the declared dependency, contract, ownership, risk, or release policy.

> The complete release gate remains comprehensive. Sounding Line makes that gate parallel, isolated, explainable, and less repetitive; it does not convert release validation into a probabilistic suggestion.

## 2. Identity, scope, and non-goals

The canonical title is **Project Sounding Line · Governing Documentation and Architecture Definition**. It owns test policy for static analysis, unit/component/service/API/database/migration/browser/accessibility/security/privacy/performance/compatibility/build/restart/backup proof; resource isolation; impact analysis; CI execution; evidence; flakes; gates; budgets; ownership; and Codex obligations.

It does not own Chronicle semantics, Story Block schema meaning, authored-content readiness, live session behavior, product business logic, deployment implementation, provider implementation, animation implementation, geolocation, or Community Harbor behavior. Those projects retain their own correctness contracts; Sounding Line invokes their declared evidence.

## 3. Current repository context

The audited companion repository is a Next.js 16 / React 19 / TypeScript application with Prisma 6.19.3. `prisma/schema.sqlite.prisma` supplies local SQLite and `prisma/schema.prisma` MySQL parity. `vitest.config.ts` includes 101 unit/component/private-content test files with a normal maximum of four workers. `playwright.config.ts` declares a one-worker, non-fully-parallel browser matrix on a default fixed port 3100; the production-performance configuration reserves 3200. The full gate is `npm run validate`, implemented by `scripts/test-all.ps1`.

The full gate has valuable safeguards: it mirrors UNC worktrees into a local validation runtime, uses a disposable SQLite copy, fingerprints the canonical SQLite family before and after, confirms server process ownership, captures browser artifacts, builds production output, and proves restarts. It also takes one process-wide OS file lock at `%LOCALAPPDATA%\ForeverTreasureCompanion\validation-runtime.lock` for the whole run. That prevents unsafe collisions but serializes static checks and independent tests with browser/database work.

See [the current-state audit](Testing/Current_Testing_System_Audit.md) for evidence and limits rather than treating historical validation reports as current proof.

## 4. Relationship to adjacent projects

Project Drydock validates authored Chronicle material, Story Block contracts, graph/variable analysis, deterministic scenarios, and publishing readiness. Sounding Line validates the software that implements Drydock and the rest of the platform. Drydock is not a global runner; Sounding Line does not interpret Chronicle story semantics.

One Voyage owns authoritative session/progression behavior; Wayfarer identity/history projections; Lanternwake presentation and Player Journal behavior; Landfall geospatial/completion boundaries; Harborlight community projections; Sealed Hold private operations; True North navigation projections; Breakwater release/deployment policy. Each declares contracts and fixtures; Sounding Line schedules, isolates, and aggregates their test evidence.

## 5. Canonical target architecture

The local control plane provides five repository-native components. Their hosted and production extensions remain separately governed.

1. **Test planner.** Given a commit, branch, diff, project, subsystem, contract, or release scope, it inventories changed files; resolves ownership, contracts, imports, routes, schema, and risk; expands dependencies; and writes a deterministic machine-readable plan. The implemented CLI exposes policy, inventory, and plan validation; the named `test:changed`, `test:subsystem`, `test:contract`, `test:release`, `test:matrix`, and `test:explain` interfaces remain future extensions.
2. **Orchestrator.** Executes the plan's dependency graph, launches isolated lanes, supervises owned processes, applies governed retries, aggregates evidence, cancels dependents safely, cleans up leases, and returns a classified decision. It contains no product business rules.
3. **Resource lease broker.** Replaces one broad lock with leases for build capacity, Node/install/Prisma generation, SQLite/MySQL, ports, browser shards/projects, storage/media/private roots, object namespaces, scanners, providers, restart hosts, production-build directories, and trace directories.
4. **Evidence aggregator.** Normalizes selection, omissions, resources, environment, checksums, counts, timing, artifacts, cleanup, root/cascade failures, flakes, and release decisions.
5. **Historical result store.** Starts as durable repository artifacts or SQLite rather than a required external service. It stores run/commit/branch/diff/plan/duration/failure-signature/resource/evidence/owner records to guide budgets and cautious correlation.

Every lease has a resource identity, run ID, process identity and creation time, acquired/renewed/expiry times, heartbeat, collision rule, diagnostics, explicit release, and stale-owner recovery that first verifies owner death/identity. It never deletes an unverified lock or another run's artifacts.

## 6. Test plan, taxonomy, and execution

The canonical tiers are Tier 0 static/structural; Tier 1 unit/pure contract; Tier 2 component; Tier 3 service/API; Tier 4 focused browser; Tier 5 cross-project contracts; Tier 6 compatibility matrices; and Tier 7 full release proof. Each selected suite must identify owner, contracts, changed-path rationale, resources, dependencies, estimated duration, and release gates. Omitted suites must have a recorded reason; uncertain impact broadens selection.

Execution lanes are static, unit, component, contract, API/service, database, migration, browser, accessibility, security/privacy, build, restart, and external provider. Static and pure suites are normally concurrent. Mutable browser/database suites are concurrent only with separate database, port, storage root, artifacts, and process leases. The release planner cannot omit a mandatory Tier 7 gate.

## 7. Data, browser, and security rules

SQLite uses versioned immutable baseline families with checksums and per-run copied clones; MySQL uses a unique schema/database and least-privilege migration/runtime accounts. Fixtures are synthetic, deterministic, minimal, versioned, attributable, and idempotent. No test may mutate canonical development data, production data, another run's database, or real private-content roots.

Browser execution distinguishes server-starting/reusing, read-only/mutating, accessibility, compatibility, production-build smoke, and restart proof. Setup failure is a dependency failure, not hundreds of independent browser failures. Traces, screenshots, logs, storage, and fixtures must be redacted and retained under policy. The repository's current private-content scans and canonical-database protection are retained.

## 8. Evidence, failure, flake, and release governance

A receipt records command, commit, source checksum, environment versions, plan, leases, timing, counts, stdout/stderr locations, trace/screenshot locations, database checksum, cleanup, classification, and decision. Results distinguish independent root defects from setup-cascade blocks. A summary such as `setup failed: 1; product failures: 3; blocked dependents: 87` is required instead of falsely reporting 91 independent failures.

Retries are exceptional and visible. Passing on retry is a flaky result, not a clean pass. Privacy, authorization, migration, and data-loss tests may not be indefinitely quarantined. Quarantine requires an owner, signature, authority, expiry, remediation date, and release effect.

Release gates are local change, subsystem, cross-project convergence, mainline, release candidate, and external-provider gates. They select applicable evidence; they do not silently turn unavailable external systems into passes.

## 9. Codex workflow and change control

Before behavioral work, Codex identifies changed behavior, contracts, owners, existing/missing tests, tiers, and exclusions. Intentional changes update/add tests in the same task where practical. It must not weaken assertions, add arbitrary waits, unconditional skips, `test.only`, broad exception swallowing, timeout inflation, or retries merely to obtain green. Completion reports carry a test-impact manifest and use the exact evidence statuses defined in [Codex obligations](Testing/Codex_Testing_Obligations.md).

Policy changes require owner review, an impact-map update, JSON validation, documentation validation, and migration notes. This charter is controlled by the repository's normal review and branch workflow.

## 10. Adoption, acceptance, and glossary

Implementation proceeds through Take the Soundings, Open the Channels, Read the Current, and Prove the Passage. The local scope of all four phases is complete; each phase's bounded scope and the retained external/non-green boundaries are in the [roadmap](Testing/Sounding_Line_Implementation_Roadmap.md). The control plane remains nonauthoritative: documents and receipts must distinguish locally tested controls from hosted, provider, and release proof.

**Suite**: a named reproducible family of checks. **Contract**: observable boundary behavior owned across subsystems. **Lane**: concurrently schedulable work class. **Lease**: time-bound verified ownership of a resource. **Plan**: deterministic suite graph and selection explanation. **Receipt**: normalized evidence record. **Blocked**: not independently run because a prerequisite failed or was unavailable. **External-only**: requires configured non-local infrastructure.

## 11. Detailed governing requirements

### Test plan generation and impact analysis

The future planner accepts commit, branch, diff, project, subsystem, contract, or release scope and records policy version. It resolves ownership, imports, routes, services, schemas, migrations, public APIs, consumers, contract edges, risk, and historical correlations. It produces a deterministic DAG; the same commit, scope, policy, and environment declaration must produce the same plan. Direct, transitive, contract, schema, release, security/privacy, compatibility, and uncertain impact are distinct. Uncertain impact broadens coverage.

### Test taxonomy and ownership

The tiers and ownership model in the testing index are mandatory. A production path without a mapped test family and a critical contract without a producer/consumer suite are policy violations. Test retirement requires proof that the behavior is removed or fully superseded. Sounding Line owns test policy and common control plane; project suites own assertions and product fixtures.

### Resource isolation, parallel execution, and runtime lease broker

The broker has separate lease families for CPU-heavy build slots, Node runtime/dependency installation, Prisma generation, SQLite, MySQL, application port, browser worker/project, storage/private/media/object roots, scanner, KMS simulator, external provider, restart host, production build, and traces. It has a heartbeat, expiry, renewal, stale-owner recovery, collision diagnostics, and cleanup proof. It must not encode business rules. Static and unit work must never wait on a browser/database lease merely because a legacy global lock exists.

### Database and fixture architecture

Immutable baselines cover empty schema, core, Player, Wayfarer, Harborlight, Sealed Hold, Lanternwake, Drydock, Landfall, and full-integration families. SQLite clones are owned per run and checksum-verified. MySQL rehearsals use isolated schema/database names and distinct migration/runtime/worker accounts. Fixture builders are versioned and attributed. Canonical development, production, another branch's fixture database, and real private roots remain prohibited mutation targets.

### Browser execution, static analysis, and service architecture

Browser projects explicitly distinguish server-starting/reusing, read-only/mutating, compatibility/accessibility, production-build smoke, and restart proof. Chromium, WebKit, Firefox where supported, desktop/mobile/tablet, zoom, motion, keyboard, touch, offline/reconnect, and cache state are selected by contract/risk. Setup projects are explicit dependency nodes. Static checks and unit/component tests retain tool-specific semantics; API/service suites use a leased database or fixture rather than a canonical shared database.

### Migration, cross-project, compatibility, and release proof

Migration proof includes generated-client validation, empty and upgraded schema rehearsal, affected services, projections, and selected browser journeys. Cross-project suites cover One Voyage with Wayfarer/Lanternwake/Drydock/Landfall; Wayfarer with Harborlight/Sealed Hold; Harborlight with Sealed Hold/Drydock; Lanternwake with Journal/Community; Sealed Hold providers; True North roles; and Breakwater release consumption. Compatibility matrices cannot silently collapse to one browser. The full release proof includes applicable static, component, service/API, database/migration, browser/accessibility, security/privacy, build/restart, backup/restore, provider, and cleanup evidence.

### Evidence, failure, flake, security, privacy, and data governance

The normalized receipt records selection, skipped/blocked reasons, leases, source and DB checksums, environment, outputs, artifact paths, root/cascade classification, retries/flakes, cleanup, and decision. Historical results keep run, commit, branch, changed paths, plan, owner, durations, queues, signatures, resource use, and evidence paths; they must not become private-content or user-behavior analytics. Synthetic fixtures, redaction, test-email domains, controlled scanner fixtures, location safety, artifact retention, and staged/repository scans are mandatory.

### CI, local developer, Codex, performance, and change control

CI executes the same plan and policy as local/Codex workflows; worker location cannot change required suites or decision. Developers and Codex start focused, deepen by impact, and reserve exhaustive proof for the governed boundary. Budgets are diagnostic targets and must expose queue/setup/execution/teardown/retry time. Policy additions or removals of suites, contracts, resources, gates, mappings, retries, timeouts, or quarantine require review, migration rationale, and policy-versioned receipt evidence. Implementation phase acceptance remains defined in the roadmap.
