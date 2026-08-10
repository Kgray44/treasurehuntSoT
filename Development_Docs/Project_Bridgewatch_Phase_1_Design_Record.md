# Project Bridgewatch Phase 1 — Design Record

**Status:** FROZEN FOR PHASE 1 IMPLEMENTATION  
**Project:** Project Bridgewatch  
**Phase:** Phase 1 — Raise the Board  
**Task branch:** `codex/project-bridgewatch-phase1-raise-the-board`  
**Source baseline:** `origin/main` at `384ad39fbc40e8cbe16dd2aa2c83abd3e00a56c6`  
**Decision date:** 2026-08-10

## Governing sources and precedence

This record implements the Phase 1 boundaries in the Project Bridgewatch
Governing Document, together with the accepted Sounding Line Parts I and II,
Sounding Line Part III v1.0 (`CS-SL-P3-001`), and the Part III v1.1 Amendment
(`CS-SL-P3-001 v1.1`). Part III v1.0 governs except where v1.1 explicitly
supersedes or adds a clause. The amendment classifies this as a material product
change: the affected product surface, source contract, tests, records, and
environment have been identified before mutation. This record itself is a
repository record, not release evidence.

Phase 1 is a private, read-only internal observation surface. GitHub, accepted
project records, and Sounding Line evidence remain authoritative. Bridgewatch
never promotes a status, declares a release, writes to GitHub, or turns a
missing denominator into a completion claim.

## Frozen Phase 1 contract

1. **Service boundary.** `bridgewatch/` is a standalone Node.js TypeScript
   package and is not imported by, embedded in, or deployed with the public
   Next.js application.
2. **Runtime.** One Fastify process serves the JSON API and static dashboard;
   one local SQLite file is its cache and internal state store.
3. **Configuration.** `BRIDGEWATCH_*` environment variables are parsed at
   startup. Required repository coordinates and an optional server-side GitHub
   token never reach HTML, JavaScript, API responses, logs, or the database.
4. **Project registry.** A versioned local registry defines project identifiers,
   display names, repository coordinates, and source-record paths. It is
   read-only at runtime.
5. **GitHub collector.** Only HTTPS `GET` requests are allowed. The collector
   reads repository metadata, the default-branch SHA, open pull requests,
   check-run summary, and recent workflow runs; it writes only cache rows in
   Bridgewatch's own SQLite database.
6. **Conditional collection.** ETags and `If-None-Match` are stored privately;
   `304 Not Modified` retains the last usable payload. Collection errors retain
   cache data and add explicit degraded-source state.
7. **Rate limits.** Calls have a timeout, bounded retries, a per-process
   concurrency cap, and poll spacing. A rate-limited source is shown as stale or
   unavailable rather than repeatedly retried.
8. **Source normalization.** GitHub and local registry data normalize into
   explicit project, source, pull-request, workflow, and phase-status objects.
   Unknown input is preserved as `UNKNOWN` or `UNMEASURED`, never inferred.
9. **Milestone arithmetic.** Percentage is shown only for an explicit,
   non-zero denominator. Otherwise it is `UNMEASURED`.
10. **No fabricated completion.** `COMPLETE`, `MERGED`, and release-like labels
    come only from their designated evidence fields. The dashboard must not
    synthesize them from a green check, a current SHA, or a cache refresh.
11. **Attention rules.** The service computes attention from stale sources,
    failed/cancelled workflows, open pull requests, blocked phases, unavailable
    sources, and explicitly expired or missing evidence. Rules are pure and
    unit-tested.
12. **Status language.** Raw `PASS` is not a release decision. Source status,
    freshness, evidence class, and the `UNMEASURED` state remain visible.
13. **JSON API.** Phase 1 exposes `GET`/`HEAD` endpoints only: health, readiness,
    summary, projects, project detail, pull requests, actions, attention, and
    source status. There are no mutation routes, webhooks, worker ingestion, or
    credential-bearing endpoints.
14. **Dashboard.** The static vanilla HTML/CSS/JS client uses the JSON API to
    show program health, project rows/cards, source freshness, current branch
    SHA, open pull requests, actions, milestones, and attention.
15. **NASA-style visual language.** The dashboard is dark, precise, compact,
    low-glare, responsive, keyboard usable, and honors reduced-motion
    preferences. Status is not communicated by color alone.
16. **Private deployment.** The process binds loopback by default. Deployment
    instructions require private network access or an authenticated reverse
    proxy. It is not a public internet endpoint.
17. **Security headers.** Fastify emits CSP, frame denial, referrer, MIME,
    permissions, and cache-control headers. The dashboard uses no third-party
    scripts, fonts, trackers, cookies, or browser-stored credentials.
18. **Input and error handling.** Repository coordinates and project IDs are
    allow-listed; errors produce safe operational states and no secret values.
19. **SQLite ownership.** The database and migrations live under
    `bridgewatch/var/`; WAL mode and a busy timeout support one process and safe
    startup. It contains only operational cache/state, never GitHub tokens.
20. **Cache retention.** Cache payloads are capped, timestamps are UTC ISO 8601,
    and old records may be pruned by a local command. A collector outage fails
    soft for the UI but readiness reports the degradation.
21. **Resource budget.** Phase 1 uses no build worker, job queue, or browser
    automation. Polling is opt-in, bounded, and uses at most four concurrent
    GitHub requests per refresh.
22. **Phase boundary.** Worker inventories, ingestion, test identities,
    historical test outcomes, documents-as-work-items, and closed-loop repair
    are deferred to later phases.
23. **Repository safety.** Implementation occurs only in this dedicated local
    worktree. Changes are staged by named path and committed as focused commits.
24. **Documentation.** The package README, operator runbook, configuration
    example, deployment unit, and this design record describe the private,
    read-only boundary and recovery behavior.
25. **Test plan.** Unit tests cover configuration, normalization, attention,
    percentage semantics, SQLite migrations, collector conditional requests,
    error retention, headers, and GET-only route registration. A browser smoke
    test loads the rendered dashboard without third-party dependencies.
26. **Validation policy.** Focused raw test results are evidence only. Sounding
    Line planning/finalization remains responsible for governing promotion;
    Phase 1 will report passes, failures, skips, and unavailable tools honestly.
27. **Completion evidence.** The final record will include exact base and commit
    identities, changed paths, targeted test output, a resource observation, and
    deployment/rollback instructions. It will not claim release authorization.
28. **Out of scope.** No public UI integration, GitHub writes, user controls,
    browser-triggered actions, OAuth, production deployment, or Phase 2/3
    worker mechanics are authorized by this record.

## Interface and data-flow decision

```text
GitHub REST GET ──> collector ──> SQLite cache ──> Fastify GET API ──> static dashboard
accepted project registry ─────────────┘                ▲
source availability/freshness ──> attention rules ──────┘
```

Only the arrow from the collector to Bridgewatch's local SQLite cache writes
state. All other edges are read-only. A failed source retains the most recent
cache and records a truthful freshness state.

## Acceptance criteria

The phase is ready for documented operator use only when the isolated package
starts against an empty local cache, applies its own migration, serves the
dashboard and all documented GET endpoints, handles an unavailable GitHub source
without losing the last known state, and passes its focused validation suite.
Any broader integration, deployment, or release decision remains separately
governed.
