---
title: Project Confluence C2-C7 Design and Implementation Record
audience: engineering
status: current
canonical_for: project-confluence-c2-c7-implementation
last_reviewed: 2026-08-17
---

# Project Confluence C2-C7

Project Confluence preserves two independently sourced streams before ChatGPT authors a private weekly developer journal: ChatGPT owns human evidence and all literary decisions; Codex owns factual engineering collection, validation, archival mechanics, and exact approved delivery.

## Authority and fixed design

- Governing document SHA-256: `62AF93261F5A8C9903C7519999E2A5F0F9B67791C5ACD318A31C9C0BAFB0E189`.
- Design specification SHA-256: `E2DF91CEE87F6F15BA630E1707C532C09F2930A27CBDD4C70ADA04EAB85697CA`.
- Visual style SHA-256: `90C34F3A438D7CF5EE5A3F779ADBCA01726CF8F38166D2DAB5B1C2926D5B305C`.
- Design tokens SHA-256: `7B0F143396B38874C8649E6329D7B412FD84E3BE08BE0C3E79887A58D8C8AB2E`.

The archive stores immutable reference copies and explicit schemas. The public repository contains code, governance copies, records, and `Developer_Journals/`; it contains no raw human evidence.

## Implementation contracts

`scripts/confluence/` provides the collector, readiness status, design validation, replay coordinator, privacy verification, and exact-delivery command. Engineering evidence distinguishes `FACT`, `DERIVED_METRIC`, `INFERENCE`, and `UNAVAILABLE`; absent GitHub-only metrics are explicitly `UNAVAILABLE_FROM_CURRENT_EVIDENCE`.

The private archive’s `human/**`, `engineering/**`, `synthesis/**`, `journals/**`, `replays/**`, `requests/**`, `indexes/**`, `references/**`, and `schemas/**` ownership boundaries prevent index clobbering and preserve provenance. Replay is non-destructive: canonical journals are never overwritten, and missing human evidence produces a minimal request for ChatGPT instead of fabricated content.

## C2-C7 plateau contracts

- C2: private archive and public destination are established with schemas, references, checksums, and fail-closed privacy verification.
- C3: the collector gathers bounded Git evidence for the America/New_York period and has an idempotent/revision-aware write path.
- C4: readiness and human replay request contracts retain ChatGPT’s sole theme and prose authority.
- C5: design-token validation and public delivery copy only byte-exact masters marked `SAFE_TO_MIRROR_EXACT`.
- C6: worker definitions and manual parity commands are recorded in the operations runbook.
- C7: replay creates durable state, reuses matching evidence, and pauses truthfully for human evidence or the master author.
