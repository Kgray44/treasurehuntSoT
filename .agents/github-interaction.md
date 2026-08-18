---
title: GitHub Interaction and Quota Governance
audience: automation
status: current
canonical_for: github-interaction
last_reviewed: 2026-08-18
---

# GitHub interaction and quota governance

Before any GitHub operation, ask: **what is the cheapest safe authoritative
source?** Use this order when it preserves the required semantics:

1. Current local repository state.
2. Git transport (`git`, targeted fetch, or `git ls-remote`).
3. A valid shared interaction cache.
4. GitHub GraphQL for related repository metadata.
5. Conditional REST through `scripts/github-interaction/`.
6. Ordinary REST only when the above cannot answer the question.

Use `npm run github:status` before substantial remote observation and use the
repository CLI rather than repetitive raw `gh api` or `gh run watch` polling.
`npm run github:doctor` reports safe configuration state without printing
credentials. `npm run github:policy:validate` is required when adding active
automation that contacts GitHub.

Git-native facts include refs, commits, trees, ancestry, merge bases, changed
paths, diffs, and remote branch SHA values. Do not spend REST quota on those.
For PR or run state, use `npm run github:pr -- --id <number>`,
`npm run github:run -- --id <number>`, or the governed watch commands. The
watch commands have a minimum 30-second interval and stop on terminal state.

The shared user-state directory is outside every worktree. Credential pools
(`USER`, `GITHUB_APP_INSTALLATION`, `ACTIONS_GITHUB_TOKEN`, and `ANONYMOUS`)
remain separate. Never put a token, JWT, private key, authorization header, or
credential-derived cache key in a report, test fixture, state file, or commit.

Rate modes are per credential resource pool:

- `NORMAL`: ordinary governed reads.
- `CONSERVATION` (at or below 30% remaining): avoid cosmetic REST and lengthen polling.
- `CRITICAL` (at or below 10%): use Git, cache, GraphQL, or an independently authorized App pool first; ordinary watchers wait at least 60 seconds.
- `EXHAUSTED`: never retry that primary pool before reset. Continue Git, local work, tests, valid cache reads, healthy GraphQL, healthy App reads, and hosted workflow-token operations. Defer only the exact operation with no legitimate equivalent.

Respect `Retry-After` and secondary-limit backoff. Never rotate user tokens,
create fake identities, or switch credentials repeatedly to evade limits.
Mutations remain mutations: they are serialized by the interaction client, are
never silently served from cache, and must use the credential and authority
already governed for that write. `npm run github:dispatch` requires an
authenticated interactive user token.

Bridgewatch is read-only and uses the shared client. Sounding Line remains the
sole test and release authority; quota routing cannot weaken candidate SHA,
base SHA, PR identity, tree identity, Mainline Decision, or protected-main
proof. Hosted workflows keep `${{ github.token }}` and their minimal declared
permissions. A personal REST exhaustion is not permission to stop independent
local engineering work or to ask the owner for unnecessary approval.
