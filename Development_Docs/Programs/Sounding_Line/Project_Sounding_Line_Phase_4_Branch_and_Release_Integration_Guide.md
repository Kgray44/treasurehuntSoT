---
title: Project Sounding Line Phase 4 Branch and Release Integration Guide
audience: engineering
status: current
last_reviewed: 2026-08-12
---

# Phase 4 Branch and Release Integration Guide

The legacy `.github/workflows/sounding-line-phase4.yml` workflow has been
retired. Its repository-wide sequence duplicated governed suite coverage and
had no unique diagnostic, qualification, or release-authority purpose. Ordinary
pull-request synchronization and development pushes therefore invoke neither
that legacy closure sequence nor the authoritative finalizer.

Focused hosted verification remains available through explicit dispatch of
`.github/workflows/sounding-line-focused-repair.yml`. It selects one exact suite
from the sealed gate plan, delegates only that governed worker, and cannot emit
`RELEASE_GO`.

Authoritative acceptance remains available only through explicit dispatch of
`.github/workflows/sounding-line-authoritative.yml` against an exact frozen
candidate SHA. Its finalizer remains the sole source of a release decision. The
separate protected-merge binding workflow may produce the required
`Sounding Line / Mainline Decision` context for an exact qualified candidate;
it does not rerun governed workers or become candidate authority.

## Historical evidence

GitHub Actions run `30545314821` passed the former Phase 4 workflow on
integration SHA `68b18b40c0b4ee2cee66324aa8643789c4172f41`. That result remains
historical, non-authoritative evidence and does not restore the retired
workflow.

Execution usage:

- Elapsed time: UNAVAILABLE_FROM_HOST
- Total tokens: UNAVAILABLE_FROM_HOST
- Input tokens: UNAVAILABLE_FROM_HOST
- Output tokens: UNAVAILABLE_FROM_HOST
- Cached or reused tokens: UNAVAILABLE_FROM_HOST
- Tool calls: UNAVAILABLE_FROM_HOST
- Usage source: UNAVAILABLE_FROM_HOST
