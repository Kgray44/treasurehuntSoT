---
title: Sounding Line Owner-Authorized PR 212 and PR 213 Procedure
audience: engineering
status: active
canonical_for: sounding-line-owner-authorized-pr212-pr213-procedure
last_reviewed: 2026-08-18
---

# Sounding Line Owner-Authorized PR 212 and PR 213 Procedure

## Scope and trust boundary

The repository owner authorized exactly two authority-changing corrections on
2026-08-18: PR #212 (structurally proven project supplements) and PR #213
(owned validation-runtime transient cleanup). Ordinary candidates remain
fail-closed: neither correction may self-issue ordinary or maintenance
authority.

The initial bootstrap is restricted to support PR #217.
Once it has reached protected main, the trusted-main workflow may run the
owner-authorized mode only for PR #212 or PR #213. No other pull request,
authority mode, or target intent is admitted by this procedure.

## Receipt and binding requirements

Each use requires a GitHub issue-comment receipt authored by a repository
owner. The receipt is exact-candidate, exact-base, exact-tree, exact-ref, and
mode bound; it must carry the procedure identifier
`SOUNDING_LINE_OWNER_AUTHORIZED_PR212_PR213_20260818`, one approved intent,
and a short expiry no later than 2026-08-31.

The authoritative workflow verifies that receipt before evidence execution.
It emits the unchanged V14 candidate evidence and acceptance envelope, which
then pass through the normal protected `Sounding Line / Mainline Decision`
binding. The authority firewall and ordinary-candidate classifier are not
changed, and this procedure is not a reusable owner bypass.
