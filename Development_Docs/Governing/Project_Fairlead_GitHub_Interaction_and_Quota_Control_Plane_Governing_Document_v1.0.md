---
title: Project Fairlead - GitHub Interaction and Quota Control Plane
audience: engineering
status: governing
canonical_for: project-fairlead-github-interaction-control-plane
last_reviewed: 2026-08-18
---

# PROJECT FAIRLEAD

## The GitHub Interaction and Quota Control Plane

**Governing Architecture and Product Requirements Document - Version 1.0**

> **Governing Principle:** Every GitHub interaction must use the least expensive correct authoritative mechanism, coordinate consumption across concurrent automation, respect GitHub limits, and preserve security and protected-main authority.

## 1. Executive Summary

Project Fairlead establishes a single governed interaction control plane between Voyagewright automation and GitHub. It exists because the repository is no longer served well by independent Codex conversations, Bridgewatch collectors, Sounding Line workflows, local scripts, and GitHub Actions each deciding how often to ask GitHub the same questions.

The target is not to evade GitHub's limits. The target is to use GitHub's supported interfaces correctly and economically: Git for Git-native facts, shared cache for safe reuse, GraphQL for consolidated metadata, authenticated conditional REST for cacheable endpoint reads, installation-scoped GitHub App credentials for high-volume machine observation, and workflow-scoped GITHUB_TOKEN credentials inside Actions.

Fairlead must make personal REST exhaustion a degraded condition rather than a fleet-wide outage. When one pool reaches zero, unrelated local work continues, Git operations continue, eligible metadata moves to other legitimate pools, Bridgewatch labels stale data honestly, and only operations that truly require the exhausted pool wait for reset.

## 2. Project Identity and Governing Principle

Program: Project Fairlead

Subsystem: GitHub Interaction and Quota Control Plane

Document type: Governing architecture and product requirements

Version: 1.0

Status: Governing baseline

Repository baseline reviewed before publication: Kgray44/treasurehuntSoT at 8586ea351a5adf2c6e08c5d0b9314ade18becf28 on 2026-08-18.

Governing principle:

> Every GitHub interaction must use the least expensive correct authoritative mechanism, coordinate consumption across concurrent automation, respect GitHub's primary and secondary limits, and preserve security and protected-main authority.

Fairlead is infrastructure, not a new source of product truth. It transports, coordinates, caches, observes, and governs GitHub interactions. It does not replace Git, Sounding Line, Bridgewatch, Project Trim, GitHub branch protection, or project-specific ownership.

## 3. Why Fairlead Exists

Voyagewright routinely operates many concurrent Codex conversations, several active pull requests, Bridgewatch, Sounding Line, and GitHub Actions. Under the old interaction pattern, each participant can independently issue REST requests, inspect workflow runs, poll pull requests, inspect refs, and re-fetch stable metadata. That behavior is individually reasonable and collectively wasteful.

The failure mode is now observed repeatedly: the authenticated user's REST core bucket reaches zero, and otherwise productive Codex work waits for the reset window even when much of the requested information could have come from local Git, Git remote transport, GraphQL, a shared cache, or a separately authorized machine credential.

This is a systems problem. Solving it with a larger number of PATs for the same user would not create independent user quota, and solving it by retrying harder would directly contradict GitHub's rate-limit guidance. Fairlead instead creates traffic engineering for the repository.

## 4. Existing Repository Foundations

Fairlead begins from working fragments already present in the repository.

Bridgewatch currently implements authenticated ETag caching, sends If-None-Match, reuses 304 responses, falls back to cached snapshots after GitHub failures, and captures x-ratelimit-remaining into its source-health model. Those behaviors are valuable and must be generalized, not discarded.

Sounding Line's authoritative workflow already uses Git for several commit, ancestry, changed-path, and remote-ref proofs, while using the workflow-provided GitHub token for API metadata. That separation demonstrates the correct principle: Git-native facts should not automatically consume REST quota.

The root AGENTS.md already delegates active automation policy into .agents/, while .agents/testing-workflow.md separates development verification from authoritative acceptance. Fairlead therefore adds a narrow GitHub-interaction policy under .agents/ instead of inflating the root instructions.

## 5. Scope

Fairlead governs active repository automation that interacts with GitHub, including Codex tasks, local developer scripts, Bridgewatch GitHub collection, Sounding Line GitHub plumbing, GitHub Actions, workflow/run watchers, PR metadata collection, and future automated project tools.

It owns transport selection, quota observation, shared rate state, cache policy, request coalescing, polling discipline, GitHub App installation authentication, secondary-limit handling, mutation pacing, request telemetry, and static enforcement against unmanaged API sprawl.

It also defines degraded operation and the permanent Codex behavior when one GitHub resource pool becomes constrained or exhausted.

## 6. Explicit Non-Goals

Fairlead does not weaken branch protection, bypass Sounding Line, create disposable GitHub identities, rotate credentials to evade limits, alter product authorization, become a GitHub replacement, or create a generic multi-provider source-control abstraction.

Fairlead is not permission to cache mutable authorization decisions indefinitely. It does not convert mutative operations into speculative writes. It does not make GitHub webhooks mandatory for local development. It does not require Bridgewatch to become part of the Next.js process, and it does not move business data into GitHub.

## 7. GitHub Resource and Credential Model

Fairlead treats quota as a vector rather than one integer. At minimum the model distinguishes REST resources such as core and search, the GraphQL point budget, the built-in Actions GITHUB_TOKEN pool, GitHub App installation pools, the interactive user credential pool, and anonymous access.

Every observation belongs to a credentialPoolId and resource. One pool's remaining count must never overwrite another pool's state. The runtime must prefer response headers and GraphQL rate-limit data over hardcoded assumptions, because actual limits can differ by authentication class and account type.

Credential identity persisted in state must be non-secret. Tokens, JWTs, private keys, and authorization headers must never appear in state files, logs, cache keys, telemetry, or receipts.

## 8. Canonical Read Routing Hierarchy

Fairlead uses a preferred read hierarchy, evaluated with freshness and authority requirements:

1. Existing local repository state.
2. Git or Git remote transport.
3. Valid shared cache.
4. GraphQL.
5. Authenticated conditional REST.
6. Ordinary REST.

This is a routing policy, not a blind ladder. A stale local ref is not authoritative when the operation requires current remote truth. A cached response is not valid beyond its declared freshness class. GraphQL is not automatically better if the query is expensive or unsupported. REST remains correct for endpoints that have no equivalent.

The hierarchy applies to reads. Mutations are routed according to authority, credential ownership, idempotency, and safety.

## 9. Git-First Architecture

Git-native facts should normally be answered by Git. These include branch and tag refs, commit and tree existence, ancestry, merge bases, diffs, changed paths, commit metadata, tree contents, candidate/base ancestry, synthetic merge-tree work, and branch divergence after a fresh enough fetch.

Typical primitives include git fetch, git ls-remote, git rev-parse, git merge-base, git diff, git show, git cat-file, git rev-list, git log, and git for-each-ref.

The implementation must choose targeted Git network operations rather than blindly fetching the entire repository for a trivial question. Git-first means using the correct Git primitive, not replacing one form of waste with a different one.

## 10. Shared Rate-State Plane

All concurrent local automation must share one repository-scoped rate-state plane outside individual worktrees. The default location is an operating-system user state directory with an explicit override for automation and testing.

The record stores schema version, observation time, pool identity, resource name, limit, remaining, used, reset time, observation source, and current mode. Writes must be atomic and process-safe. Stale state is explicitly identified. No worktree may assume its own private rate state is authoritative for the machine.

A local process that learns the personal REST pool is exhausted should make that fact visible to the other local processes without forcing every one of them to spend another API call discovering the same thing.

## 11. Rate Modes

Fairlead defines four policy modes per pool/resource:

NORMAL: more than 30 percent remains.

CONSERVATION: 30 percent or less remains.

CRITICAL: 10 percent or less remains.

EXHAUSTED: zero remains.

Percentages are defaults and may be configured. Absolute thresholds can be layered on top, but no one-size hardcoded threshold may assume that all pools have the same total capacity.

Transitions use fresh authoritative observations and reset timestamps. Reset does not mean the system should immediately create a burst of requests; deferred operations re-enter through the normal scheduler and coalescer.

## 12. Behavior in Normal and Conservation Modes

NORMAL does not mean careless. Git-first selection, duplicate suppression, cache reuse, and sane polling remain permanent behaviors.

CONSERVATION suppresses nonessential REST calls, lengthens safe polling intervals, increases reuse of appropriately fresh cache entries, consolidates GraphQL reads, and eliminates cosmetic refreshes. It is intended to bend usage before emergency measures are needed.

Bridgewatch should preserve a truthful freshness indicator rather than hiding conservation behind an apparently live dashboard.

## 13. Critical and Exhausted Operation

CRITICAL permits REST only when the operation cannot safely be satisfied through Git, an authorized healthy alternate pool, GraphQL, or a sufficiently fresh cache. Informational polling is minimized and active-run watchers normally use intervals of at least 60 seconds unless GitHub specifies otherwise.

EXHAUSTED forbids primary-limit-consuming retry loops for that pool until reset. Git operations continue. Local implementation continues. Focused local tests continue. Healthy GraphQL or GitHub App capacity may be used where semantically equivalent. Hosted workflows continue with their own GITHUB_TOKEN. Only the exact operation requiring the exhausted resource waits.

This degraded behavior is the single most important product outcome of Fairlead.

## 14. Primary and Secondary Limits

Primary exhaustion and secondary throttling are different states and must be diagnosed separately.

For primary exhaustion, remaining equals zero and the reset timestamp governs the earliest safe retry. Fairlead records the reset and schedules re-evaluation rather than hammering the endpoint.

For a secondary limit, Retry-After is honored when present. Otherwise the system uses bounded backoff and expands the delay on repeated failures. A secondary limit with remaining primary quota is not permission to switch identities repeatedly to evade GitHub's abuse controls.

Mutative bursts are paced, because request cost is not only a primary-quota problem.

## 15. Conditional REST and Shared Cache

Authenticated cacheable REST GETs should preserve ETag and, where useful, Last-Modified metadata. Future calls send If-None-Match or If-Modified-Since. A valid authenticated 304 allows the prior body to be reused without consuming primary REST quota under GitHub's documented behavior.

Cache identity binds the credential pool, endpoint, normalized query, media type, API version, ETag or last-modified identity, response body, observation time, and freshness class. Authorization-sensitive content may not be reused across credentials with different access semantics unless an explicit rule proves equivalence.

Cache corruption must fail closed. Live operational status cannot be disguised as current when the cached observation is old.

## 16. Freshness Classes

Fairlead defines freshness classes rather than one global TTL:

IMMUTABLE for commit-bound or otherwise immutable resources.

LONG for repository metadata and stable configuration.

MEDIUM for branch protection, workflow definitions, and slow-moving repository policy.

SHORT for pull-request metadata and checks.

LIVE for workflow-run state, queue state, and other rapidly changing operations.

Each consumer states the maximum acceptable age for its operation. Consumers requesting stronger freshness than the cache can provide trigger a live or alternate transport operation.

## 17. Request Coalescing

Multiple local processes frequently ask GitHub the same question within seconds. Fairlead must convert these into one live request and shared results where possible.

A process-safe filesystem lock and shared cache are sufficient. Locks are repository- and request-key scoped, identify ownership where practical, have bounded waits, and recover after process death. Windows behavior is a first-class requirement.

The system must never deadlock because a Codex chat was terminated while holding a coalescing lock. A stale lock is recoverable, and a waiting process can fall back safely if the shared request fails.

## 18. GraphQL Strategy

GraphQL is a first-class transport because it can consolidate fields that otherwise require several REST calls and because its point budget is independently accounted.

Fairlead should provide reusable queries for pull-request identity, head/base, mergeability, repository metadata, sets of open PRs, and check/status rollups where supported. Query cost and remaining points must be recorded.

GraphQL is especially valuable when the personal REST core budget is constrained but GraphQL remains healthy. It is not a universal replacement: queries must remain bounded, predictable, and permission-correct.

## 19. REST Strategy

REST remains the correct interface for endpoints that are not available or practical through Git or GraphQL. Fairlead centralizes REST construction, authentication, API version headers, conditional cache behavior, retry classification, telemetry, and redaction.

Direct ad hoc api.github.com clients in active automation become exceptions rather than the norm. Every exception must state why central routing cannot satisfy the operation.

Unsafe methods are never treated as cacheable merely because a similar GET endpoint exists.

## 20. Polling and Watcher Architecture

Polling must be deliberate. The canonical watcher supports adaptive intervals, endpoint-provided X-Poll-Interval, jitter, cancellation, shared observations, quota modes, secondary-limit backoff, and terminal-state detection.

The watcher reports state transitions rather than printing the same unchanged state repeatedly. Multiple local watchers for the same workflow run or pull request should share observations through the coalescer and cache.

The default culture of while-loop plus gh run view every few seconds is retired.

## 21. Event-Driven Invalidation and Webhooks

Where a stable inbound endpoint is available, a GitHub App may subscribe to relevant webhook events so Bridgewatch and other observers can invalidate or refresh cache reactively rather than by constant polling.

Recommended candidate events include push, pull_request, check_run, check_suite, workflow_run, and workflow_job, but only events needed by implemented consumers should be enabled.

Webhook ingress requires HMAC signature verification, bounded payload size, delivery-ID deduplication, replay-safe handling, secret redaction, and fail-closed behavior. Local development must still work without a public webhook receiver; efficient polling remains the reconciliation path.

## 22. GitHub App Architecture

Fairlead introduces support for a dedicated GitHub App installation used primarily for high-volume automated reads. Installation authentication is independent from the interactive user and is therefore a legitimate way to separate permanent machine observation from personal automation.

The App authenticates as itself with a short-lived JWT only to obtain an installation access token. Long-running processes keep installation tokens in memory and refresh before expiration. Tokens, JWTs, private keys, and authorization headers never enter Git, logs, persistent quota state, cache keys, or telemetry.

Repository permissions follow least privilege. The initial expected set is read access to metadata, contents, pull requests, checks, and actions, with each permission verified against actual endpoints. Write permissions are not granted merely for convenience.

## 23. GitHub App Owner Configuration

Repository implementation must not block on the owner-controlled step of registering or installing the App. Fairlead therefore provides a setup runbook covering App creation, minimum permissions, webhook events, private-key generation, installation ID discovery, local configuration, token validation, rotation, and revocation.

Until the App is installed, the control plane falls back to existing authorized credentials according to policy. It reports APP_NOT_CONFIGURED rather than pretending installation authentication is active.

The setup record must also warn against code that assumes installation tokens have a fixed legacy length or shape.

## 24. Credential Selection and Least Privilege

The read plane and write plane are intentionally different.

High-volume machine reads prefer Git, then the GitHub App installation where appropriate, then GraphQL or conditional REST under the selected pool. Interactive local writes remain attributable to the user unless a separate governed decision authorizes App-attributed writes. GitHub Actions use the workflow-provided token whenever its declared permissions are sufficient.

Credential selection is not quota roulette. The router may choose among independently authorized pools only when each pool is semantically and permission-wise valid for the operation.

## 25. Mutation Governance

GitHub mutations are scarce, meaningful, and more likely to trigger secondary throttling. They therefore use a dedicated mutation controller.

Operations such as workflow dispatch, PR edits, labels, comments, release changes, branch deletion, and merges are serialized or paced where appropriate. Automatic retries occur only when the operation is proven idempotent or when GitHub's result can be reconciled safely.

A timeout after a write is not immediately retried. The controller first determines whether the mutation already took effect.

## 26. Bridgewatch Integration

Bridgewatch is the most persistent GitHub observer in the project and becomes an important Fairlead consumer.

Its existing ETag and cached-fallback behavior should move onto the common client without losing source-health semantics. The current pull-request/check collection pattern must be audited for N+1 calls. Where one GraphQL query or bounded batch can replace many per-PR check requests, that optimization is preferred.

Bridgewatch should expose GitHub interaction health itself: credential source, REST remaining percentage, GraphQL remaining percentage, rate mode, reset time, cache age, cache-hit rate, 304 reuse, live requests, coalesced requests, Git transport count, rate deferrals, secondary-limit events, and GitHub App installation health.

## 27. Bridgewatch Degraded Data Truth

When Bridgewatch cannot refresh GitHub because a pool is exhausted or throttled, the dashboard must not silently display cached data as live.

Source state should distinguish healthy, conservation, rate-degraded, unavailable, and cached-fallback conditions. Every displayed observation can carry age and provenance. This turns rate limiting into visible operational truth rather than an invisible data-quality defect.

Adaptive polling slows in Conservation and Critical modes and suspends quota-consuming refreshes when the selected pool is exhausted until reset or an event invalidation justifies a permitted alternate route.

## 28. Sounding Line Integration

Sounding Line remains the sole testing and release authority. Fairlead changes only GitHub interaction plumbing.

Sounding Line should continue to use Git for candidate/base ancestry, tree identity, changed paths, refs, and commit existence. API-only PR envelope or workflow metadata should move through Fairlead primitives where practical. Hosted workflows prefer their workflow-scoped GITHUB_TOKEN.

No optimization may weaken exact candidate SHA binding, base SHA binding, PR binding, tree identity, Mainline Decision semantics, or protected merge checks. If an alternate transport cannot prove the same fact, the operation does not silently downgrade.

## 29. GitHub Actions Credential Policy

GitHub Actions jobs should use the built-in GITHUB_TOKEN for repository-local API operations when its permissions are sufficient. This reduces pressure on personal automation credentials and improves permission locality.

Each workflow declares minimum permissions. Fairlead must not solve quota pressure by adding a broad shared secret to every workflow. A workflow that requires an App installation token documents that need explicitly and mints a short-lived token rather than receiving a long-lived machine credential.

## 30. Codex and Developer Governance

Fairlead adds .agents/github-interaction.md and a small pointer from AGENTS.md. The policy tells Codex to prefer Git for Git-native facts, consult shared quota state, use governed watchers rather than raw polling loops, route supported reads through the central client, respect reset and Retry-After instructions, and continue unrelated local work when one GitHub pool is unavailable.

A REST core value of zero is not by itself a whole-task blocker. The agent must identify whether the actual next operation can proceed through Git, GraphQL, a healthy installation pool, a valid cache, or independent local work.

Context expansion remains governed by Project Trim. Testing and acceptance remain governed by Sounding Line.

## 31. Static Policy Enforcement

Active automation must not grow new unmanaged GitHub clients casually. A policy check scans executable and active automation areas for direct api.github.com use, gh api, raw GraphQL calls, GitHub-specific Invoke-RestMethod or curl invocations, and unmanaged watchers.

The validator allows approved central modules and explicit governed exceptions. It ignores documentation, archived history, and fixtures whose purpose is to test detection. The goal is architectural pressure, not false positives every time a guide mentions gh api.

## 32. Telemetry and Success Metrics

Fairlead records requests by transport and credential pool, REST resource category, GraphQL cost, cache hits and misses, 304 responses, request coalescing, live calls avoided, poll intervals, primary exhaustion events, secondary-limit events, Retry-After durations, rate deferrals, token refreshes, and Git operations.

Telemetry is bounded and privacy-safe. Request bodies, authorization headers, private keys, tokens, and sensitive query values are not logged.

The project targets a material reduction in duplicate live metadata reads, especially across concurrent Codex tasks and Bridgewatch. A representative nine-consumer simulation should demonstrate at least 70 percent reduction in duplicate live requests where request overlap exists.

## 33. Security and Threat Model

Fairlead introduces shared caches, credential routing, App authentication, and optional webhook ingress. Each creates new failure modes.

Threats include token leakage, private-key leakage, cache cross-contamination between credentials, stale authorization reuse, malicious webhook payloads, replayed deliveries, cache poisoning, request-key collisions, SSRF through a configurable API host, stale-lock denial of service, fallback to a less-authorized identity, rate-state tampering, and accidental broad App permissions.

The architecture therefore requires strict secret redaction, HTTPS GitHub endpoints, credential-bound cache identity, atomic state files, HMAC verification, payload bounds, deduplication, least privilege, safe lock recovery, and fail-closed transport equivalence.

## 34. Privacy and Logging

GitHub metadata is operational data, but repository state can still reveal branch names, issue content, contributor names, and project activity. Fairlead records only what is necessary for routing, reliability, and observability.

Raw authorization material is never logged. Error messages strip authorization headers and credentials. Cache content is protected by user-level filesystem permissions where practical. Bridgewatch's external presentation shows operational summaries and not machine credentials.

## 35. Failure Model

Fairlead classifies failures so consumers know whether to retry, reroute, wait, or continue local work.

Representative classes include PRIMARY_EXHAUSTED, SECONDARY_LIMITED, RETRY_AFTER_ACTIVE, GRAPHQL_EXHAUSTED, APP_NOT_CONFIGURED, APP_TOKEN_REFRESH_FAILED, AUTHORIZATION_FAILED, CACHE_CORRUPT, CACHE_STALE, COALESCER_LOCK_STALE, WEBHOOK_SIGNATURE_INVALID, GIT_REMOTE_UNAVAILABLE, REST_ENDPOINT_FAILED, and GITHUB_UNAVAILABLE.

A failure class includes safe next action. The system does not collapse every 403 into "GitHub broken."

## 36. Degraded Operation Matrix

The control plane must remain useful under partial failure.

Personal REST exhausted: Git and healthy independent pools continue.

GraphQL exhausted: conditional REST or Git continues where appropriate.

App unavailable: fall back according to policy; report that machine read pool is unavailable.

Bridgewatch GitHub refresh unavailable: serve cached observations with age and degraded status.

Webhook ingress unavailable: polling reconciliation remains functional.

GitHub fully unavailable: local implementation and local tests continue; remote-dependent finalization waits.

Fairlead never invents remote truth from stale local assumptions merely to keep moving.

## 37. Concurrency and Fairness

The shared control plane prevents a high-volume observer from starving interactive work. Bridgewatch background refreshes yield under constrained quota. User-initiated, time-sensitive qualification metadata may receive a higher scheduling class than cosmetic dashboard refreshes.

The scheduler must still respect secondary-limit guidance and avoid replacing quota starvation with abusive concurrency. Fairness is among legitimate requests, not an excuse to increase total request pressure.

## 38. Developer and Operator Experience

Fairlead should be easy to use without memorizing its internal architecture.

The repository should expose commands equivalent to github:status, github:doctor, github:policy:validate, github:app:check, and governed watchers for runs and PRs. The status view summarizes each credential/resource pool, current rate mode, reset time, cache and coalescing status, App health, and preferred transport.

Diagnostic output is concise and state-change oriented. Operators can tell whether a task is blocked by GitHub, merely degraded, or able to proceed through another path.

## 39. Informative Decision Examples

Example: current main SHA. Fairlead uses git ls-remote or a sufficiently fresh fetched origin/main rather than REST.

Example: PR head/base/mergeability. Fairlead uses shared cache if fresh, otherwise a consolidated GraphQL query or conditional REST.

Example: workflow run watch. Fairlead uses the governed watcher, which coalesces local observers, respects poll intervals, and slows under quota pressure.

Example: workflow dispatch. Fairlead uses the mutation controller with the authorized user or workflow credential; it does not route through a read-only App solely because that pool has more quota.

Example: personal REST exhausted while tests are running. Local work continues; hosted Actions continue; Bridgewatch marks any cached GitHub state with its age; only a truly REST-only personal operation waits.

## 40. Implementation and Adoption Strategy

Fairlead v1.0 should be built as one coordinated program because the worst intermediate state is multiple active GitHub clients with competing quota semantics. Implementation may use internal stages and additive dormant components, but cutover of active consumers should occur only after the central primitives and policy are ready.

Recommended internal sequence:

A. Inventory active GitHub consumers and capture a baseline.

B. Build credential-pool, rate-state, cache, coalescer, GraphQL, REST, Git routing, and watcher primitives.

C. Add GitHub App authentication and optional webhook support.

D. Migrate Bridgewatch, Sounding Line, and active local automation.

E. Add static policy enforcement and permanent .agents guidance.

F. Run concurrency, security, focused integration, and degraded-operation validation.

G. Reconcile current protected main, qualify one candidate, and integrate through current Sounding Line authority.

## 41. Mainline Safety Contract

If implementation stops before activation, current GitHub behavior must remain functional. New central components may exist dormant or additive, but active consumers must not be left half-migrated.

If the GitHub App is not configured, the repository continues with existing credentials and reports the missing App explicitly.

If Fairlead is activated but one optional subsystem fails, consumers fall back through governed routes without weakening authorization or protected-main semantics.

Fairlead can be rolled back to the immediately prior interaction adapters without rewriting repository history or invalidating product state.

## 42. Validation and Acceptance

Acceptance covers rate-state transitions, credential isolation, transport selection, ETag reuse, cache corruption, coalescing, stale-lock recovery, adaptive polling, secondary limits, Bridgewatch migration, GitHub App authentication, token refresh, secret redaction, Sounding Line candidate/base/tree proof, static policy enforcement, and the nine-consumer concurrency simulation.

The strongest program acceptance scenario is deliberately operational: nine Codex conversations, Bridgewatch, and Sounding Line are active; the personal REST core pool reaches zero; the machine remains productive through Git, healthy alternate pools, cache, Actions credentials, and local work; no process hammers GitHub; protected-main safety is unchanged; and normal operation resumes safely after reset.

## 43. Performance Objectives

Fairlead performance is measured in avoided GitHub work, not merely faster code execution.

Target outcomes include at least 70 percent fewer duplicate live metadata calls in a representative concurrent-local simulation, elimination or material reduction of Bridgewatch N+1 check collection, no ordinary run watcher polling every few seconds by default, high conditional-request reuse for stable endpoints, and zero fleet-wide task stoppages caused solely by an exhausted personal REST core pool when legitimate alternative sources remain available.

The project must publish measured before/after evidence rather than claiming savings from architecture diagrams.

## 44. Governance and Change Control

Project Fairlead is the canonical GitHub interaction architecture once activated. New GitHub integrations must use its primitives or document a narrow exception.

Changes to credential-routing policy, cache authorization boundaries, rate thresholds, App permissions, webhook verification, mutation behavior, or Sounding Line interaction require explicit review because they can affect both security and repository availability.

GitHub's documented rate-limit and authentication behavior is external authority and may change. Fairlead therefore uses observed response metadata as runtime truth and requires periodic review of GitHub API guidance.

## 45. Final Acceptance Criteria

Project Fairlead is complete when active GitHub consumers are inventoried; one canonical interaction library exists; Git-first, GraphQL, conditional REST, shared cache, coalescing, shared rate state, adaptive polling, GitHub App installation support, secondary-limit handling, Bridgewatch migration, Sounding Line plumbing migration, Actions token policy, Codex guidance, static enforcement, security validation, concurrency simulation, and degraded-operation behavior are all implemented and proven.

The GitHub App may remain externally unconfigured only if repository support is complete and the state is reported truthfully as EXTERNAL_OWNER_CONFIGURATION. Fairlead is not considered fully operational on that credential pool until installation succeeds.

## 46. Final Governing Rule

Fairlead is successful when GitHub API capacity becomes a managed resource rather than a recurring surprise.

The system must not ask nine independent processes to discover the same quota state, fetch the same pull request, poll the same workflow, or wait helplessly when one API pool is exhausted. It must choose the right transport, reuse trustworthy evidence, coordinate demand, obey GitHub's limits, and keep the rest of Voyagewright moving.

## Appendix A. Canonical Rate-State Schema

A rate observation contains: schemaVersion, repositoryId, credentialPoolId, credentialKind, resource, limit, remaining, used, resetAt, observedAt, source, mode, retryAfterUntil, pollIntervalSeconds, and optional error classification. No token or secret field is permitted.

The shared file stores multiple independent observations and uses atomic replacement. Staleness is computed from observedAt and a policy-defined maximum age. A stale observation may guide conservation but cannot authorize a high-risk mutation.

## Appendix B. Canonical Cache-Key Inputs

Cache keys include normalized method, GitHub host, endpoint path, sorted query parameters, API version, Accept/media type, credential authorization class, repository identity, and any explicit representation version. Authorization headers and raw tokens are excluded.

For GraphQL, cache identity includes the normalized query document identity and variables after redaction of secret-like values. Mutable operations are not placed into the ordinary read cache.

## Appendix C. Suggested GitHub App Permission Baseline

The initial design target is read-only machine observation. Expected permissions are Metadata: read, Contents: read, Pull requests: read, Checks: read, and Actions: read, subject to endpoint-level verification during implementation.

The App receives no write permission by default. If a later use case requires a mutation, that permission is governed separately and should be narrower than the interactive user's authority.

## Appendix D. Source Routing Matrix

Refs / commit SHA / tree SHA / ancestry / changed paths -> Git.

PR identity / head / base / mergeability -> shared cache, then GraphQL or conditional REST.

Workflow run status -> governed watcher backed by cache/coalescing and REST or GraphQL as supported.

Workflow dispatch -> mutation controller using an authorized write-capable credential.

Branch protection / rules metadata -> medium-freshness conditional REST unless an equivalent GraphQL source is proven.

Bridgewatch background observation -> GitHub App read pool + GraphQL/conditional REST with webhooks for invalidation when available.

## Appendix E. Test Matrix Summary

Required families include rate-state transitions, percentage thresholds, reset behavior, pool isolation, secret redaction, Git routing, GraphQL routing, REST fallback, mutation safety, ETag/304 reuse, cache authorization separation, cache corruption, request coalescing, stale-lock recovery, watcher intervals, terminal-state handling, secondary-limit backoff, Bridgewatch ETag preservation, Bridgewatch N+1 reduction, App JWT/token flow, App configuration fallback, Sounding Line envelope and tree proof, static policy exceptions, and concurrency simulation.

## Appendix F. Operational Runbook

When quota pressure is observed: inspect github:status, determine affected pool/resource, confirm shared observation freshness, stop unmanaged polling, allow the router to prefer Git/cache/GraphQL/App, and verify Bridgewatch freshness labels.

When primary exhausted: do not retry before reset; continue independent work; confirm deferred operations are queued; re-evaluate at reset.

When secondary limited: obey Retry-After or bounded backoff; reduce request concurrency; inspect recent mutation/poll bursts; do not rotate credentials to defeat the limit.

When App token refresh fails: mark App pool unavailable, redact the error, fall back only to authorized alternatives, and do not expose the private key or JWT in diagnostics.

## Appendix G. External References

The governing design incorporates current GitHub documentation for REST API rate limits, GraphQL rate limits, REST API best practices, GitHub App authentication, installation access tokens, GitHub App least-privilege permissions, and webhook-oriented integration design.

The external references are informative implementation authority for GitHub behavior; the repository's Fairlead policy remains authoritative for how Voyagewright chooses among those supported interfaces.

## Appendix H. Glossary

Credential pool: one independently rate-limited and authorized authentication identity.

Quota resource: a GitHub-reported rate-limit category such as REST core, search, or GraphQL.

Coalescing: combining simultaneous identical read demand into one live operation and shared result.

Conditional request: a request carrying an ETag or last-modified validator so unchanged data can return 304.

Freshness class: the maximum acceptable age category for a cached observation.

Git-first: using Git or Git remote transport for Git-native facts instead of consuming API quota.

Degraded operation: continued partial functionality after one transport, credential, or quota resource becomes unavailable.

Installation token: a short-lived token issued for a GitHub App installation.

Mutation controller: the governed path for GitHub write operations, with authority and idempotency handling.
