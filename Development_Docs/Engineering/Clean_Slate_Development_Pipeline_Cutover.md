---
title: Clean-Slate Development Pipeline Cutover
audience: engineering
status: current
canonical_for: development-pipeline
last_reviewed: 2026-08-27
---

# Clean-Slate Development Pipeline

Rollback protected main: `863e17c506d06386efffb4491c77c8294512c8c1`.

Ordinary work uses one branch and pull request. The trusted, read-only Sounding Line ordinary workflow binds the PR base SHA, candidate SHA, and both trees; it runs repository safety sentinels plus structurally affected tests, widening when impact is unknown. It is the sole ordinary protected-main check.

Before executing an already-required ordinary obligation, the direct runner reconciles immutable, content-addressed receipts in `artifacts/sounding-line/evidence-store`. A receipt is reusable only when its v1.4 semantic fingerprint matches the obligation command and selected test definition, bounded source/input closure, fixture/schema state, dependency lockfile/toolchain/browser/environment class, and trusted Sounding Line policy identity. A same-candidate match is `PRESERVED`; a candidate with the same protected semantics receives a candidate-bound `REBOUND` receipt. A mismatch is `INVALIDATED` and runs fresh. Missing, corrupt, unreadable, incomplete, or indeterminate evidence is `CONSERVATIVE_FALLBACK` and runs fresh. The finalizer requires every selected obligation to have exactly one passing fresh, preserved, or rebound receipt, so reuse never reduces coverage. CI may restore a compatible cache, but an unavailable cache is only a fresh-execution path. Exhaustive release qualification always runs fresh.

Releases and explicit full certification use the manual exhaustive Sounding Line workflow, which runs the complete unit, migration, build, and browser suite.

Nightwatch, Bosun, Mainline Train, maintenance hierarchy, synchronous baseline certification, generated test identity, P34 retirement, Project Trim packets, Feature Catalog provenance, and Deepwater identity are not ordinary admission inputs. Rare control-plane changes use the manual owner-authorized Sounding Line control-plane check. Deepwater and Feature Catalog remain asynchronous semantic tools; historical records remain in Git history.
