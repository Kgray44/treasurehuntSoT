---
title: Project Sounding Line Windows Command-Length Follow-Up
audience: engineering-evidence
status: planned
canonical_for: sounding-line-windows-command-length-follow-up
last_reviewed: 2026-09-03
---

# Project Sounding Line Windows Command-Length Follow-Up

## Status

`OPEN_TESTING_INFRASTRUCTURE_FOLLOW_UP`. This is a record of an observed
Windows invocation limitation, not authorization to modify Sounding Line,
ordinary-product behavior, or protected acceptance policy.

## Observation

An ordinary qualification selected 172 Vitest files. On Windows, the normal
Sounding Line CLI assembled that complete selection through the shell. Windows
then rejected the invocation because its command line was too long. The failure
occurred before the selected tests could run, so it is not evidence that any
selected product behavior failed.

The same selected test list completed when an isolated diagnostic adapter passed
the executable and its arguments directly with shell execution disabled. That
run reported 1,205 passing tests. Its result is local diagnostic evidence only;
it is not a replacement for a sealed Sounding Line decision or protected-main
acceptance.

## Preserved boundaries

- No Sounding Line source, workflow, policy, test-selection rule, or protected
  binding is changed by this follow-up.
- The ordinary qualification remains fail-closed when its normal Windows CLI
  cannot represent the selected argument list.
- The follow-up must not narrow a selected test set, reorder it, split it into
  unbound partial decisions, or suppress the command-length failure.
- This record does not alter Brightwork Stage 7, Stage 8 Wave 0, or Stage 8
  Wave 1 scope or acceptance.

## Required future investigation

An independently authorized testing-infrastructure change may evaluate a
Windows-safe process-launch representation, such as direct argument arrays or a
bounded manifest, only if it preserves all of the following:

1. The exact candidate, base, tree, selected paths, path order, and verification
   receipt remain deterministically bound.
2. Windows execution does not use a shell-form command string for a selected
   test list whose encoded length exceeds the platform limit.
3. The selected paths are neither removed nor partitioned into independently
   authoritative partial results.
4. Focused regression coverage proves both a normal-sized list and an
   over-limit Windows-sized list reach the intended executable with identical
   argument semantics.
5. Linux and protected-worker behavior remain unchanged unless separately
   authorized and qualified.

## Closure evidence

This follow-up may close only after a separately authorized change has a
passing Windows regression, an exact receipt for an over-limit selection, and
the normal protected qualification evidence required by then-current Sounding
Line policy.
