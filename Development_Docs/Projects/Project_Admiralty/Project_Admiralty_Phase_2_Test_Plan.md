---
title: Project Admiralty Phase 2 Test Plan
audience: product-engineering-security-quality
status: current
canonical_for: project-admiralty-phase-2-test-plan
last_reviewed: 2026-08-09
---

# Project Admiralty Phase 2 test plan

## Contract lanes

1. Authorization partition: administrator, Support Operator, Operations
   Observer, Audit Operator, and ordinary user route/data/nav boundaries.
2. Read ports: safe Prisma selection, result bounds, unavailable owner state,
   and exclusion of payload, secret, private-content, and credential fields.
3. People and Support Access: bounded search, dossier composition,
   reauthentication, consent request, target approval, exact-scope use, and
   immediate revocation.
4. Chronicle, Voyage, and Community: search/detail relationships, immutable
   version metadata, safe event summaries, release/moderation workload, and
   prohibited-content absence.
5. Operations/providers/releases: truthful status vocabulary, evidence source,
   freshness, missing-contract state, and no fake mutation.
6. Audit/investigation: human-first action summaries, sanitized metadata,
   bounded filters, correlation traversal, and domain authorization.
7. Living Registry: 92-entry floor, 16 inherited Phase 1 capabilities, 46
   Phase 2 activations, 30 dormant entries, and no hard-coded total equality.

## Browser and accessibility lane

The task-owned Phase 2 fixture supplies six synthetic identities: full
Administrator, Support Operator, Operations Observer, Audit Operator, Ordinary
User, and Support Target User. Production-browser journeys cover natural
account-menu entry, all 15 routes, least-privilege partitions, support consent,
ordinary denial, desktop/tablet/mobile layouts, keyboard operation, reduced
motion, effective 200-percent zoom, and serious/critical accessibility scans.

## Isolation and authority

The browser database, credentials, build, logs, and evidence live below a
task-owned `%LOCALAPPDATA%\ProjectAdmiralty` root. The canonical database is
never modified. Focused raw tests are diagnostic; final technical disposition
comes from current Sounding Line subsystem and mainline authority against the
reconciled exact source. Owner walkthrough remains a separate human gate.
