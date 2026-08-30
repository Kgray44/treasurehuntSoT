---
title: Project Shipwright Phase 5 design record
program: Project Shipwright
phase: 5
record_type: design
status: accepted-mainline
authority: Project Shipwright Creator Studio Authoring Experience Governing Document
date: 2026-08-30
base: 445cbb253cd19191c2b02c0951efc7c6be3b1f74
scope: Creator staged publication over accepted Drydock and One Voyage authority
---

# Project Shipwright Phase 5 — Launch from the Yard

> Current status: Phase 5 is accepted on protected main through PR #479
> (`ab44c398fb76c367036d720cea619825614233f5`). This record preserves its
> design baseline and does not claim deployment or owner acceptance.

## Scope and decisions

Phase 5 makes Version history the Creator-visible publication checkpoint. The
review saves the intended draft, reads the current Drydock decision and
compatibility projection, computes an exact human-readable structural
comparison against the current immutable Version, lists asset readiness and
recorded protected-content evidence, collects release notes, and requires an
explicit immutable confirmation.

The surface does not create a second publisher. `publishTale` remains the
single One Voyage transaction and is called with the current autosave version.
Studio represents success only after its returned Version label, checksum,
evidence receipt, and publication instant are complete. A failed or stale
request leaves the editable draft intact and points back to governed Drydock
repair. The Harborlight next action is a link to its existing owned surface;
Shipwright neither creates an exchange release nor widens Community authority.

## Experience and boundaries

Normal controls use Creator labels, visual review, checkboxes, and links rather
than manual IDs or raw JSON. Sea Trials now expose source-derived required
coverage classes as normal checkbox controls, so a Creator can meet Drydock's
suite contract without opening the existing advanced JSON import/export
fallback. The staged list uses semantic headings, labeled controls, live
status/error messaging, keyboard-operable disclosure, forced-colors borders,
and a narrow-screen single-column next-action layout. The exact change list is
bounded by an internal scroll region for large Chronicles.

All routes retain owner authorization and private, no-store responses. The
review emits a safe projection rather than draft snapshots or provider payloads.
No Prisma schema, provider claim, production publication path, or later
Shipwright phase is introduced.

## Related records

- [Governing document](Project_Shipwright_Creator_Studio_Authoring_Experience_Governing_Document.pdf)
- [Phase 5 validation record](Project_Shipwright_Phase_5_Validation_Record.md)
- [Program closure](Project_Shipwright_Program_Closure.md)
