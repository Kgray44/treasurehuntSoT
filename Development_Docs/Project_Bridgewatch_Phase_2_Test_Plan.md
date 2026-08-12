---
title: Project Bridgewatch Phase 2 Test Plan
audience: engineering
status: current
canonical_for: project-bridgewatch-phase-2-test-plan
last_reviewed: 2026-08-12
---

# Project Bridgewatch Phase 2 Test Plan

Development verification follows `.agents/testing-workflow.md`: one coherent
change, its smallest test, repair before expansion, then affected-subsystem
evidence. Sounding Line finalization is reserved for one frozen qualified
candidate and is never a defect-discovery tool.

| Family | Focused evidence |
| --- | --- |
| Progress and registry | `test/domain.test.ts`, `test/registry.test.ts`, `test/view-model.test.ts` |
| Phase 1 to 2 migration and durable test history | `test/store.test.ts` |
| Sounding Line state | `test/sounding-line.test.ts` and source projection invocation |
| Reporter privacy/auth/staleness | `test/telemetry.test.ts`, `test/server.test.ts` |
| API, dashboard privacy, and read-only boundary | `test/server.test.ts`, `test/config.test.ts` |
| Package static health | package typecheck and build |
| Browser and mobile | local Fastify browser inspection, normal lifecycle tabs, biography, two-second live update, 390x844 no-overflow, WCAG 2 A/AA scan |

Candidate qualification will additionally run the Phase 2 package suite,
package typecheck/build, repository documentation and Feature Catalog checks,
relevant Sounding Line policy/inventory checks, the source projection test, and
the isolated browser accessibility review. The hosted protected Mainline
Decision remains a separate one-time acceptance step after candidate freeze.
