---
title: Project Bridgewatch Homeport Gateway Validation Record
audience: engineering
status: repaired-pending-current-main-reconciliation-and-authoritative-mainline-decision
canonical_for: project-bridgewatch-homeport-gateway-validation
last_reviewed: 2026-08-13
---

# Project Bridgewatch + Homeport - Gateway Validation

## Source binding

- Accepted starting main: `60b89841986e66fbc2c0828489d38002a1617506`.
- Reconciled accepted main: `72075eb551ec39bdb59bd7d78fd900f2eaf73a88`.
- Qualified implementation: `6212bd1ab9ed23abd52f98154b55d846267a1133`.
- First frozen candidate: `1cd4f3a6cb4a3c370a72995c8b6a1e0ff8bf80e2`.
- Owned branch: `agent/bring-the-watch-home`.
- Canonical path: `/bridgewatch`.
- Server-only upstream: `BRIDGEWATCH_INTERNAL_URL=http://127.0.0.1:4318`.
- Access rule: canonical Wayfarer session plus Admiralty `PLATFORM_OBSERVE`.

This record proves local qualification only. It is not a Mainline Decision,
release authorization, protected-check binding, deployment receipt, or claim
that port 4318 has been verified on a production host.

## Security and process boundary

- Voyagewright imports no Bridgewatch Fastify, SQLite, telemetry, or collector
  implementation.
- The Next.js route is a thin authorization and allowlist gateway. The deployed
  NGINX path uses the same canonical authorization through an internal
  subrequest and proxies mounted subpaths directly to the standalone service.
- Only loopback HTTP upstreams are accepted. Browser input cannot select the
  target, and credentials, paths, queries, fragments, and non-loopback hosts
  invalidate configuration.
- Browser-facing traffic is limited to `GET` and `HEAD`, dashboard/static
  assets, and named read-only observation APIs. Telemetry, health, arbitrary,
  traversal, mutation, and unexpected-query routes fail closed.
- Browser cookies and authorization are never forwarded to Bridgewatch.
  Deployed direct-proxy requests also discard bodies and forwarded identity.
- The standalone unit binds `127.0.0.1:4318`, owns its own restart lifecycle,
  and remains independent of the main Voyagewright service.

## Validation evidence

| Evidence                                                  | Result                                                                      |
| --------------------------------------------------------- | --------------------------------------------------------------------------- |
| Gateway unit boundary                                     | 7 passed                                                                    |
| Full standalone Bridgewatch unit family                   | 15 files, 41 tests passed after accepted Phase 3 reconciliation             |
| Root TypeScript and Bridgewatch TypeScript/build          | passed                                                                      |
| Production Next.js build                                  | passed; `/bridgewatch/[[...path]]` and internal authorization route present |
| Admiralty isolated browser journeys                       | 4 passed, including private desktop/mobile Bridgewatch journey              |
| Anonymous and ordinary authenticated access               | private 404; no Bridgewatch content or navigation entry                     |
| Privileged mounted root, CSS, JavaScript, and summary API | 200 through the signed-in browser page                                      |
| Telemetry browser exposure                                | GET 404 and POST 405                                                        |
| Accessibility and responsive layout                       | no serious axe finding; no mobile horizontal overflow                       |
| Homeport Phase 0, Phase 2, and Phase 5 validators         | passed; 355 current sources, no unexplained ordinary orphan                 |
| Documentation and Feature Catalog validators              | passed                                                                      |
| Sounding Line policy validation                           | passed; no policy errors                                                    |
| Sounding Line governed `local-change`                     | passed with clean static and runtime-conformance evidence                   |
| Helm background-handoff component regression              | 15 passed; hidden waiting rooms retain authoritative polling                |
| Helm focused governed browser stability                   | two consecutive 3/3 passes with clean teardown                              |

The governed local-change selection passed `static.core`, `unit.deepwater`,
`unit.drydock`, `unit.homeport`, `unit.one-voyage`, `unit.sounding-line`, and
`unit.tideglass`. Its final evidence set had no missing mandatory suite,
duplicate receipt, unknown receipt, invalid evidence, or invalid runtime
conformance.

## Repair evidence retained

The first browser attempt exposed a redirect loop between the gateway and
Next.js slash normalization. The gateway was corrected to use canonical
`/bridgewatch` without a redirect and to rewrite only authorized root HTML
asset mounts. A later explicit test fetch correctly demonstrated that an
API-request context without the browser session receives private 404; the
positive asset/API assertions were moved into the signed-in page. Fresh
production build evidence and the final four-journey pass followed those
repairs.

## First authority result and current-main reconciliation

Authoritative run `31719635154` was exactly bound to PR `#85`, base
`60b89841986e66fbc2c0828489d38002a1617506`, and candidate
`1cd4f3a6cb4a3c370a72995c8b6a1e0ff8bf80e2`. It correctly ended
`RELEASE_NO_GO`. The sole failed worker was the unchanged `browser.helm`
family: its first journey observed the membership as active but did not reach
the expected Player journal URL before the 30-second URL assertion expired.
The candidate-specific Bridgewatch, Admiralty, build, security, privacy, and
other governed workers passed. No acceptance envelope or merge authority was
produced.

A same-source focused governed Helm reproduction then passed all 3/3 journeys
with runtime conformance `PASSED` and clean teardown. Sounding Line policy does
not convert one failure plus one retry pass into a clean decision or qualified
flake, so the failed authoritative run was not rerun or waived.

Replacement authoritative run `31724278156` was exactly bound to PR `#85`,
base `72075eb551ec39bdb59bd7d78fd900f2eaf73a88`, and candidate
`e169c97bfdf5292e4ff97f661589ff9d2dc7734c`. It again ended
`RELEASE_NO_GO` solely because the first `browser.helm` journey observed the
Captain's Player membership as `ACTIVE_MEMBER` while the already-open hidden
waiting-room tab remained on its prelaunch URL. Every Bridgewatch-specific
worker, the production build, the Admiralty browser family, and the other
governed workers passed. No acceptance envelope or merge authority was
produced.

The repeated failure established a product race rather than a candidate retry
artifact. `PlayerVoyageRoom` suppressed its only periodic authoritative load
while `document.hidden`, leaving progression dependent on browser delivery of
EventSource, focus, or visibility events. The repair keeps the existing
five-second canonical load active in hidden waiting rooms while preserving the
terminal revocation guard, credential boundary, and original 30-second browser
assertion. A component regression proves a hidden waiting room fetches active
state and hands off to the journal. Two fresh focused governed Helm runs then
passed 3/3 journeys consecutively with runtime conformance `PASSED` and clean
teardown. An earlier local attempt that reset the development server during
route prewarming was retained as infrastructure diagnostics and is not counted
as product evidence because no Helm test began.

While that diagnosis completed, accepted Bridgewatch Phase 3 advanced
`origin/main` through `dead22dc26aeec2b722625aa9a68dc5688111fca`. The replacement
candidate reconciles its history, archive, trends, branch-health, maintenance,
tests, and records. The same-host mount now resolves every Phase 3 dashboard
request under `/bridgewatch`, and the application and NGINX allowlists add
only the exact history, archive, trend, and project-history queries used by
that accepted dashboard. Telemetry, health, arbitrary query, and mutation
routes remain excluded.

Bridgewatch's accepted program-completion correction then advanced main to
`d6eb335880376f59403cf7108bf26690d8da4891`. Its three-file registry and test
delta is reconciled unchanged; it records the accepted Phase 3 completion and
does not alter the gateway, authorization, deployment, or mounted-path
boundary.

The Phase 3 final record-only closure subsequently advanced main to
`72075eb551ec39bdb59bd7d78fd900f2eaf73a88`. Its documentation and catalog
truth is reconciled with the gateway's additive `/bridgewatch`, authorization,
test, and deployment evidence. No runtime source changed in that advance.

## Deployment verification boundary

The Windows qualification host did not provide an NGINX executable, so an
`nginx -t` receipt is a deployment-time requirement. Before reload, the host
operator must validate the supplied configuration and prove that 4318 listens
only on loopback and is not externally reachable. Merge alone does not satisfy
that production verification.

## Mainline state

The reconciled replacement is undergoing complete qualification. A new exact
candidate must receive a fresh authoritative Sounding Line finalization before
protected `Mainline Decision` binding, merge identity, and remote-main parity
can be appended from their actual receipts.
