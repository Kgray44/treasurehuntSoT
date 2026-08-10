---
title: Project Tideglass Phase 2 Design Record
audience: product-engineering
status: current
canonical_for: project-tideglass-phase-2-design
last_reviewed: 2026-08-09
---

# Project Tideglass Phase 2 design record: Read the Wake

Status: frozen for implementation. Phase 2 layers deterministic, explainable change intelligence over the accepted Phase 1 Change Set, persists only immutable Creator annotation revisions, exposes bounded server APIs, and adds no ordinary comparison route, navigation entry, history integration, or other Phase 3 behavior.

## Frozen baseline and versions

| Item                    | Value                                                                        |
| ----------------------- | ---------------------------------------------------------------------------- |
| Original `origin/main`  | `d1344e8ce613cdb3e3adc1fc13803b6356f1c0db`                                   |
| Phase 1 candidate       | `83ef66ff70a3bbeb85b90f6a99aeb8cfb0da8bf9`                                   |
| Phase 1 integrated main | `40d822cd936c9abbfce064fd7799e6a2f8c9785e`                                   |
| Semantic schema         | `tideglass.semantic.v1` unchanged                                            |
| Comparison policy       | `tideglass.policy.v1` unchanged; canonical Change Set meaning is not altered |
| Change-code registry    | `tideglass.change-codes.v1`                                                  |
| Projection policy       | `tideglass.projection.v1`                                                    |
| Summary policy          | `tideglass.summary.v1`                                                       |
| Annotation schema       | `tideglass.annotation.v1`                                                    |
| SQLite migration        | `20260809130000_tideglass_phase2_creator_annotations`                        |
| MySQL migration         | `0053_tideglass_phase2_creator_annotations`                                  |

Concurrency class is `B` (coordinated parallel development), with low additive schema pressure and accepted Tideglass Phase 1 as the only hard dependency. Tideglass owns only comparison intelligence, projection/summary policy, annotation revisions, cache identity, DTOs, and its APIs. Publishing remains the edition/version/playability authority; Drydock remains the schema/reader/provider-readiness authority; Wayfarer/Wakebook remains personal-history authority; Harborlight remains release/install authority; Shipwright remains Studio UX authority; Helm remains Captain runtime authority; and Admiralty remains privileged-access authority.

## Mainline Safety Contract

Phase 2 is additive under Tideglass source, Tideglass API routes, one new annotation model/migration pair, tests, Sounding Line policy, and engineering records. Published editions remain immutable One Voyage truth; live Voyages, Wayfarer history, Wakebook, Harborlight, Drydock, Shipwright, and navigation are neither written nor re-owned. If Phase 3 is never built, the application remains coherent: authorized clients may call finished server contracts, but there is no unfinished ordinary route. Removing the service/API registrations disables the feature; annotation rows remain inert historical records and require no destructive rollback.

## Intelligence and compatibility policy

Every supported Phase 1 Change Record resolves through the machine-readable registry to a stable code, category/kind, non-lowering default significance, default spoiler rule, compatibility relevance, and summary family. Unknown semantics remain unsupported rather than `TG-UNKNOWN`. Overall significance is the maximum evidence-backed level; accessibility removal/emptying has a Phase 2 `MAJOR` floor, and the result escalates to `TRANSFORMATIVE` only when three independent major categories include topology or ending change. Reasons list exact Change IDs and codes. No percentage-different score exists.

Compatibility deltas are deterministic, evidence-linked records across platform, provider, device, Captain, crew, accessibility, content schema, asset format, and physical requirement dimensions. Stored semantic digests may be exposed as safe structured before/after evidence; Tideglass never certifies provider availability or readiness owned elsewhere. Missing authority yields `UNKNOWN`.

## Projections and spoiler disclosure

The machine-readable projection policy is the authority for `PUBLIC_PREVIEW`, `PLAYER_SAFE`, and `CREATOR_FULL`. The server derives the actor's maximum; a client preference can only narrow it. Public output contains preview-safe visible items and counts computed only from that visible set, never withheld totals or hidden identifiers. Player-safe story and ending facts may be `DISCLOSABLE`, but Phase 2 does not infer played history. Creator-full is restricted to a current Chronicle Creator/owner/collaborator and still excludes credentials, sessions, raw snapshots, raw semantic values, storage secrets, and unrelated account data. A bare administrator label grants no Tideglass access; any future administrative/support path must consume explicit Admiralty authority. `VISIBLE`, `DISCLOSABLE`, and `WITHHELD` are data states, never CSS hiding.

## Deterministic summaries

Summary lines carry stable IDs, template keys, exact Change IDs/codes, category, significance, spoiler level, audience eligibility, and structured parameters. Groups follow the canonical category registry and Change Set order. Concise and detailed modes are presentation-independent DTOs. Same-edition output emits a deterministic no-meaningful-change line; partial output names only safe unavailable sections and never infers missing results. Digest input is canonical Change Set digest, all policy versions, and the active annotation digest.

## Creator annotations

`TideglassCreatorAnnotation` is append-only. The logical `annotationKey` has a monotonic positive revision; a correction or withdrawal inserts a row that supersedes exactly one current prior row. Chronicle and exact source/target IDs/checksums/policy lineage cannot change. Scopes are `PAIR`, `CATEGORY`, and `CHANGE`; kinds are `HEADLINE`, `DETAIL`, `COMPATIBILITY`, `LIMITATION`, and `REPLAY_GUIDANCE`; replay guidance is `NO_RECOMMENDATION`, `MINOR_UPDATE`, `WORTH_REVISITING`, or `SUBSTANTIAL_NEW_CONTENT`. A withdrawal changes annotation display only.

Mutation requires canonical AccountSession authentication, active Creator workspace, Chronicle ownership or scoped Creator collaboration, independent exact-edition binding, CSRF, centralized rate limiting, strict allowlisted input, bounded plain text, and a private-safe audit event. Arbitrary HTML, scriptable content, storage paths, secrets, mass assignment, cross-Chronicle Change IDs, and revision hijacking fail closed. Annotation text never alters machine records or lowers significance. Deterministic warnings retain both truths for claimed minor/no-gameplay/accessibility statements and missing major-category coverage.

The transactional audit actions are `TIDEGLASS_ANNOTATION_CREATED`, `TIDEGLASS_ANNOTATION_SUPERSEDED`, and `TIDEGLASS_ANNOTATION_WITHDRAWN`. Metadata contains only safe IDs, exact pair IDs, revision, scope/kind/spoiler/state, policy versions, correlation ID through the audit envelope, and a content digest; it never contains annotation text. SQLite migration `20260809130000_tideglass_phase2_creator_annotations` and MySQL migration `0053_tideglass_phase2_creator_annotations` are the reserved additive pair.

## Cache and APIs

The default cache is a bounded in-process, rebuildable canonical-comparison cache. Keys include Chronicle and exact edition identity, both checksums, semantic schema, and comparison policy. Entries carry their own digest; invalid entries evict and recompute. Summary identity additionally includes summary/projection versions and annotation digest. No Player, history, participant, disclosure preference, draft, or live-Voyage context enters a shared key/value.

The Phase 2 APIs are `GET /api/chronicles/:chronicleId/editions`, `POST /api/chronicles/:chronicleId/comparison`, `GET|POST /api/chronicles/:chronicleId/comparison/annotations`, and `POST /api/chronicles/:chronicleId/comparison/preview`. The edition list reports retained/playable/recommended state as unavailable where Publishing exposes no such policy; Tideglass does not infer those facts from time or `isCurrent`. Annotation history and mutation responses use explicit DTOs that omit author-account IDs, idempotency keys, and checksums. Comparison read, annotation mutation, and preview use the distinct centralized classes `comparison-read`, `annotation-mutation`, and `projection-preview`. All responses are typed projections or safe failures with correlation IDs; no raw snapshot endpoint exists.

## Sounding Line and Phase 3 handoff

The existing `unit.tideglass` family expands with classification, compatibility, projection, summary, annotation, cache, migration, and API contracts, plus affected schema/API paths and SQLite/MySQL resources. Exact-source subsystem/mainline/release decisions remain the only release authority. Phase 3 may consume these DTOs to build a polished ordinary experience and trusted history-aware disclosure; Phase 2 does not create that surface.
