---
title: Project Bridgewatch Homeport Gateway Validation Record
audience: engineering
status: qualified-pending-authoritative-mainline-decision
canonical_for: project-bridgewatch-homeport-gateway-validation
last_reviewed: 2026-08-13
---

# Project Bridgewatch + Homeport - Gateway Validation

## Source binding

- Accepted starting main: `60b89841986e66fbc2c0828489d38002a1617506`.
- Qualified implementation: `6212bd1ab9ed23abd52f98154b55d846267a1133`.
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
| Full standalone Bridgewatch unit family                   | 11 files, 24 tests passed                                                   |
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

## Deployment verification boundary

The Windows qualification host did not provide an NGINX executable, so an
`nginx -t` receipt is a deployment-time requirement. Before reload, the host
operator must validate the supplied configuration and prove that 4318 listens
only on loopback and is not externally reachable. Merge alone does not satisfy
that production verification.

## Mainline state

Local qualification is complete. Authoritative frozen-candidate Sounding Line
finalization, exact protected `Mainline Decision` binding, merge identity, and
remote-main parity remain pending and must be appended only from their actual
receipts.
