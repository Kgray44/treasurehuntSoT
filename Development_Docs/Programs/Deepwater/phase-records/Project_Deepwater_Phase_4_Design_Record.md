---
title: Project Deepwater Phase 4 Design Record
audience: product-engineering
status: current
canonical_for: project-deepwater-phase-4-design-record
last_reviewed: 2026-08-12
---

# Project Deepwater Phase 4 design record

## Authority and source boundary

Phase 4, **Break the Surface**, is explicitly authorized to turn the accepted
Deepwater realization and utilization inventory into a current, whole-product
proof population. It begins from fetched `origin/main`
`236c27241bb8d1630274f5d5412ec9addbdb8893` on the fresh branch
`codex/project-deepwater-phase4-break-the-surface`, not from a Phase 3 branch.
The accepted Phase 3 close is preserved at
`ca135585a62f445cd4331df1a7dd21203bd50219`; none of its historical records
are rewritten to imply that Phase 4 was previously authorized.

The authority stack is repository instructions, the Voyagewright Global Product
Governance Standard, the Project Deepwater governing document, accepted
owner-domain contracts and records, and the current Sounding Line authority.
The final protected decision is exactly **Sounding Line / Mainline Decision**.
It is reserved for one frozen candidate after focused qualification and is not a
development diagnostic tool.

## Population and selection

The Phase 3 ledger supplies 55 accepted capabilities. The current Feature
Catalog also contains FT-034, Bridgewatch Development Mission Control, yielding
a 56-capability Phase 4 denominator. The deterministic proof matrix accounts
for every capability exactly once:

- 40 ordinary user-facing capabilities require gateway-started, visible-control
  journeys;
- six restricted human or operator capabilities require approved-audience proof
  and must never use a public route to raise a metric;
- nine internal, machine, compatibility, backup, or trust-boundary capabilities
  are explicitly retained as bounded rather than forced into UI; and
- Bridgewatch is a private, loopback-first, read-only operator dashboard. Its
  human dashboard is reviewed as a restricted surface, never as a public product
  route, provider authority, or release authority.

Journey families cover Account, Personal Harbor, Player, Captain, Creator,
Community, whole-product shell and routing, verification, restricted
operations, and Bridgewatch. Ordinary journeys start at `/` and use visible
controls; direct URLs are limited to explicitly declared deep-link or negative
tests. Each family maps routes, current Homeport screen identifiers, state and
recovery requirements, accessibility, responsive behavior, and its capability
IDs in `deepwater-phase4-config.json`.

## Evidence and quality model

Phase 4 proof uses an isolated Homeport production-build harness with
task-owned SQLite clones, synthetic fixtures, owned ports and browser state. A
sanitized runtime-evidence record may contain exact product source SHA, test
references, state and accessibility outcomes, screenshot evidence IDs, and
SHA-256 values. It may not contain credentials, tokens, cookies, private
content, task-root paths, raw provider responses, or screenshots themselves.

The required quality facets are visible-entry discoverability, ready, loading,
empty, error, unauthorized and recovery states where applicable; desktop,
tablet, mobile and effective 200 percent zoom; keyboard, visible focus, touch,
contrast and reduced-motion behavior; source-bound screenshots; and natural
journey continuity. A full realization claim requires a natural journey mapping;
a full utilization claim retains source-backed utilization evidence. Wrong,
unknown, stale, unhashed, or incomplete runtime evidence fails validation.

## Owner and external boundaries

Homeport's current owner re-review remains `PENDING_OWNER_DECISION`. Phase 4
may prepare an owner walkthrough packet but cannot record `OWNER_ACCEPTED` or
`PRODUCT_ACCEPTED`. Local synthetic browser proof is not live-provider proof,
deployment proof, protected-main proof, physical assistive-technology proof, or
owner acceptance. Watchglass/provider, transactional-email, and owner-domain
limitations remain visible rather than inferred closed.

## Concurrency, product, and schema boundary

Other project lanes may continue ordinary development. This Phase 4 work uses
accepted `origin/main` only and treats unaccepted worktrees as coordination
constraints, not source truth. The coordination branch owns only the Deepwater
proof model, evidence metadata, generated reports, walkthrough packet, and
closure accounting. It makes no Prisma migration, canonical database mutation,
private-content read, broad product rewrite, or Feature Catalog fragment change.
An owner-domain defect is recorded and assigned unless a narrowly frozen,
cross-layer owner contract explicitly permits a small repair.

## Mainline and Phase 5 contract

Development follows small coherent changes with the smallest direct test first,
then affected-subsystem qualification. When local proof is complete, Phase 4
will reconcile fetched `origin/main` once, freeze one candidate, acquire the
serialized acceptance lane, and dispatch one Mainline Decision. `RELEASE_GO`
is necessary but not enough: protected merge, exact-main proof, and a closure
record are also required. The generated Phase 5 queue is explicitly empty and
`phase5Authorized: false`; no following phase begins before acceptance into
main.
