---
title: Project Sounding Line Phase 4 Branch and Release Integration Guide
audience: engineering
status: current
---

# Phase 4 Branch and Release Integration Guide

`.github/workflows/sounding-line-phase4.yml` provides a read-only,
secret-free focused verification job for Sounding Line paths. It validates
policy/inventory, Phase 1–4 focused contracts, documentation, and privacy. Its
concurrency group cancels superseded work only within the same workflow/ref.

The workflow is deliberately not a release workflow: it cannot issue a release
decision, access provider credentials, run protected browser/provider gates,
alter branch protection, or retire the legacy serial harness. Pull-request
execution is restricted to public repository inputs and cannot satisfy a trusted
release gate without an independent trusted re-execution.

Hosted execution has not been observed in this local implementation. Required
future branch-protection check name is `sounding-line-phase4-focused`; remote
application is pending repository-owner authority. P34 remains non-green and
external provider/MySQL evidence remains pending.

Execution usage:

- Elapsed time: UNAVAILABLE_FROM_HOST
- Total tokens: UNAVAILABLE_FROM_HOST
- Input tokens: UNAVAILABLE_FROM_HOST
- Output tokens: UNAVAILABLE_FROM_HOST
- Cached or reused tokens: UNAVAILABLE_FROM_HOST
- Tool calls: UNAVAILABLE_FROM_HOST
- Usage source: UNAVAILABLE_FROM_HOST
