---
title: Project Wakebook Phase 1 Test Plan
audience: product-engineering
status: current
canonical_for: project-wakebook-phase-1-test-plan
last_reviewed: 2026-08-09
---

# Project Wakebook Phase 1 test plan

## Authority and evidence rule

Sounding Line is the verification authority. Focused Vitest, Playwright, typecheck, lint, build, or browser commands are diagnostic until selected, executed, and recorded through the governed plan. Evidence must bind the exact source SHA, test registry, fixture identity, environment, and cleanup result. Owner walkthrough remains distinct from automated readiness.

## Contract registrations

| Contract                                 | Meaning                                                               | Minimum Phase 1 evidence            |
| ---------------------------------------- | --------------------------------------------------------------------- | ----------------------------------- |
| `wakebook.history.version-pinning`       | Played version ID/checksum and historical snapshots remain stable     | unit + service + historical fixture |
| `wakebook.history.owner-privacy`         | Foreign accounts cannot infer private records or covers               | service/API + browser negative      |
| `wakebook.history.historical-stability`  | Current profile/Chronicle edits do not rewrite history                | service + fixture                   |
| `wakebook.timing.quality`                | Exact/estimated/unavailable/not-applicable presentation is truthful   | unit + fixture matrix + component   |
| `wakebook.artifact-context`              | Shared Voyage artifact evidence is not personal ownership             | cross-project service + component   |
| `wakebook.navigation.reachability`       | Archive and detail are normally reachable on desktop/mobile           | browser journey                     |
| `wakebook.archive.pagination`            | Opaque cursors are stable, bounded, validated, and gap/duplicate safe | unit + service + large fixture      |
| `wakebook.archive.year-grouping`         | Group/date precedence and full displayed-year totals are accurate     | unit + service                      |
| `wakebook.archive.filters`               | Owner-scoped search/filter combinations are deterministic and bounded | unit + API + component              |
| `wakebook.archive.invitation-separation` | Invitation-only records stay separate from played statistics          | service + component                 |
| `wakebook.archive.partial-history`       | Projection/summary failure preserves safe accepted history            | service + component                 |
| `wakebook.archive.summary-redaction`     | Card DTO excludes private bodies, payloads, keys, and raw relations   | service/API contract                |

## Unit and contract matrix

- archive-date precedence, year key, and unavailable group;
- cursor encode/decode, sort mismatch, malformed input, and page boundary;
- lifecycle, role, outcome, edition, timing, and duration presentation;
- safe parsing of chapters/objectives/choices/artifacts including invalid old records;
- filter schema limits and deterministic Prisma predicates;
- year summaries never infer totals from a page;
- invitation labels/date selection and statistical exclusion;
- summary redaction and historical-cover safe reference;
- shared artifact versus canonical personal artifact presentation;
- permanent-stop behavior has no future-feature controls.

## Service/API matrix

- canonical AccountSession required for archive, detail, and cover;
- owner archive isolation across large mixed fixtures;
- foreign/missing detail and cover use neutral 404;
- malformed cursor, limit, search, status, year, role, and boolean filters return bounded 400;
- page limits clamp or reject according to the frozen strict schema; no unbounded path;
- one, ten, one hundred, and 1,000+ records preserve deterministic pagination without duplicate/gap behavior;
- list query does not return Reflection text, Memory bodies, storage keys, raw event payload, or full version snapshot;
- detail returns only owner-safe annotation and artifact projections;
- current Chronicle/profile edits do not change historical output;
- materialization unchanged-source and duplicate runs remain idempotent;
- projection failure produces partial warning and changes zero One Voyage business rows;
- old invalid summaries degrade rather than leaking raw data;
- cover route serves only the version-pinned owner asset and fails safely;
- legacy Reflection, Memory soft delete, Keepsake generation, consent grant/revoke, and review handoff remain green.

## Component matrix

- loading skeleton and status announcement;
- one-Voyage composition and many-year shelf;
- first-use empty actions;
- filtered/search no-results and one-action reset;
- compact filters, expanded filters, sorting, result announcement, and pagination continuation;
- invitation-only archive section;
- partial-history warning and unavailable date/timing/cover fallbacks;
- card accessible names, real links, no raw enums/IDs/checksum emphasis;
- detail header, Journey Summary, Path, Crew, Artifacts, Edition, and Remembrance sections;
- Reflection/Memory/Keepsake mutation pending/success/failure and dirty-state behavior;
- safe cover image failure fallback;
- artifact context never says owned without canonical owner record.

## Browser journeys

The primary synthetic journey starts at `/`, signs in through visible product controls, reaches Chronicle Passport, selects `History`, searches/filters the archive, opens a Voyage card, verifies detail, returns to Archive, and enters Artifact Cabinet. It runs at governed desktop and mobile widths and includes keyboard-only navigation.

Additional browser evidence covers first use, one Voyage, many Voyages/year grouping, invitation-only, foreign record ID, revoked session, projection partial state, 200% zoom, reduced motion, no horizontal scroll, and zero serious/critical accessibility findings under repository policy.

## Resource isolation

All mutable database/browser tests use task-owned SQLite clones, leased ports, isolated storage/evidence roots, and synthetic accounts/content. Canonical `prisma/dev.db`, shared runtimes, user content, invitation credentials, session values, and unrelated worktrees are read-only or untouched. Cleanup records exact process/port/database ownership and canonical database-family hashes.

## Required governed commands

Revalidate and use the current scripts selected by Sounding Line, including `npm test`, `npm run test:changed`, `npm run test:subsystem`, `npm run test:contract`, `npm run test:mainline`, `npm run test:release`, `npm run test:policy`, and `npm run test:new`. Run broader gates only when the generated plan requires them. Do not pre-classify raw adapter success as release evidence.

## Acceptance boundary

Automated acceptance may classify the implementation `READY_FOR_OWNER_WALKTHROUGH` only after all mandatory contracts and broader selected gates pass against the reconciled source. Only the owner may promote it to product accepted; this task does not merge main or start Wakebook Phase 2.
