---
title: Project Sounding Line Phase 4 CI and Distributed Worker Architecture
audience: engineering
status: planned
canonical_for: sounding-line-phase-4-worker-architecture
last_reviewed: 2026-07-29
---

# Phase 4 CI and Distributed Worker Architecture

## Provider-neutral control plane

The future control plane has a CI controller, policy/plan validator, trusted
worker registry, capability matcher, sealed-plan dispatcher, lease authority,
evidence store, and quarantine registry. A controller accepts only a sealed
plan whose source and policy identities match the requested node. It dispatches
one capability-scoped node lease, records heartbeats and cancellation, then
accepts evidence only after identity, counts, cleanup, and artifact hashes
validate. Provider-specific runners are adapters, never a second policy.

Worker families are `trusted`, `browser`, `database`, `build`,
`provider-validation`, and `external-host`. An external host is restricted by
default and cannot receive private material or an authoritative release node.
Artifact/evidence storage is append-only by run and node identity; workers may
write only their allocated prefix and may never replace a completed receipt.

## Accepted Phase 2 local boundary

The distributed design starts from the accepted local policy identity (14
suites, 17 contracts, 19 resources), not from a speculative worker protocol.
Its reviewed adapters use argument arrays with `shell: false`; a worker may
only receive an eventual sealed dispatch for the corresponding allowlisted
adapter. The controller must preserve Phase 2 lane-specific lease keys,
all-or-nothing allocation, controller token, heartbeat/expiry revision, and
allocation/setup/finish/release/cleanup/quarantine receipts. It must also
preserve process and PID-reuse identity protections, SQLite clone isolation,
browser-context/storage/trace identity, and retained loopback-server handle.

## Worker identity and lifecycle

Each registration declares these fields: `workerId`, `hostId`, `bootIdentity`,
`controllerTrustDomain`, `capabilities`, `platform`, `architecture`,
`runtimeVersions`, `browserVersions`, `databaseCapabilities`,
`providerCapabilities`, `capacityProfile`, `attestationState`,
`lastHeartbeat`, and `status`.

Allowed lifecycle states are:

`REGISTERING -> AVAILABLE -> RESERVED -> EXECUTING -> AVAILABLE`.

`DRAINING` accepts no new lease; `UNHEALTHY` is reached after heartbeat or
attestation failure; `QUARANTINED` requires investigation; `REVOKED` is
terminal for the enrolled identity. A worker never self-promotes from
`UNHEALTHY`, `QUARANTINED`, or `REVOKED`. Lease expiry or cancellation stops
new work and produces incomplete/blocked evidence until cleanup is verified.

## Dispatch protocol

1. The controller validates source, lockfile, policy, plan digest, gate scope,
   selected contracts, and trust/capability constraints.
2. The matcher reserves an `AVAILABLE` compatible worker and grants a
   short-lived, single-node lease.
3. The worker validates the sealed envelope, creates only task-owned paths,
   emits heartbeats, and returns append-only evidence with cleanup identity.
4. Cancellation marks the lease, prevents dependent dispatch, and preserves
   partial evidence. The controller verifies cleanup before reuse.
5. Evidence validation either seals the node result, quarantines the worker,
   or returns a nonauthoritative incomplete result. It never manufactures a
   pass after a transport failure.

Capability discovery is signed/attested in the future implementation, scoped to
the controller trust domain, and expires. Claims cannot select a worker if a
required runtime, browser, database, provider, capacity, or trust capability is
missing. Clock skew beyond policy turns the worker `UNHEALTHY`; a partition
cannot extend an expired lease.

The certified concurrent `harborlight-a` and `harborlight-b` lanes are
local execution-isolation evidence only. They do not establish worker trust,
distributed dispatch, local/CI parity, dual-run equivalence, release cutover,
or a weaker global full-release lock. `legacy-full` remains the emergency
serial adapter and the legacy release harness retains its full lock.

## Required draft schemas

The four schema drafts define worker registration, sealed-plan dispatch,
evidence manifest, and release decision records. They are preparation data
shapes, not running protocols. The test suite parses every draft and verifies
their required identity and nonauthoritative markers.

## Isolation and quarantine

Every node names source checkout, dependency-lock identity, database/storage
namespace, browser/profile/trace root, artifact prefix, process identity, and
cleanup action. A worker cannot use another run's namespace. Evidence return
includes the declared and observed identities. A compromised, contradictory,
or replaying worker is immediately quarantined, all active leases are stopped,
affected evidence is revoked, and resumption requires a fresh trusted identity
plus revalidation.
