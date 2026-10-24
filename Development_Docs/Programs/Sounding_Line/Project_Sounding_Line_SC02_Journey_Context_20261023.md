---
title: SC02 journey context representation repair
audience: engineering
status: implementation-candidate
canonical_for: sounding-line-sc02-journey-context-20261023
last_reviewed: 2026-10-23
---

# SC02 journey context representation repair

The SC02 consumer fixture declares device-specific navigation and synthetic
composition names. The accepted runner reads only literal names and values: it
cannot interpret devices, contextValue or contextName. A successful application
build therefore cannot establish that this fixture can execute its journey.

This candidate resumes the existing Core03 correction from protected main
649a0bf2b2d5a0cc2437ac18c5e89e7bdfaab7cd. Its runner and context-resolution test
retain the previously reviewed bytes. The native-select probe has the narrow
platform keyboard correction recorded below; earlier source packets and failed
receipts remain preserved. No product source, registry, central validator or
outcome assertion changes here.

## Fixed representation

Only spatial-pilot.experience / sc02-assets-and-reusable-composition may opt in,
using DESKTOP or MOBILE and NORMAL or REDUCED:

- devices selects one or two unique devices only for the fixed object-properties
  or filter navigation button clicks. Outcome, state, feedback and return fields
  are forbidden on conditional navigation.
- contextValue accepts only SC02_COMPOSITION_NAME on Object name and Search
  compositions fills, resolving to SC02 synthetic composition DEVICE MOTION.
- contextName accepts only SC02_COMPOSITION_INSPECT_NAME on the exact Inspect
  button click. Assertions cannot use name substitution.

Resolution happens once before browser interaction. Execution and causal
lookahead share the resolved steps and applicability while retaining original
indices. Unrelated journeys retain literal labels and ignored legacy fields.
The original no-op, causal outcome, feedback, return, accessibility and paired
evidence guards remain intact. No general interpolation or new action is added.

## Validation and acceptance boundary

The retained Core03 evidence records three focused tests passing: unrelated
literal compatibility, four-context mock causality with malformed-input denials,
and native Chromium Source selection using existing keyboard actions. Original
setup, fixture and lint-timeout failures remain historical, without inferred
causes. This candidate requires fresh focused checks and normal protected Linux
qualification before installation.

Fresh checks on this candidate passed all three focused tests with no skips or
failures, changed-source lint with zero allowed warnings, and formatting.
Documentation indexing preserved all 2,374 existing records and 6,601 migration
rows while adding this record. Feature synchronization left catalog bytes
unchanged. Initial documentation and feature validation rejected paths omitted
by the sparse checkout; those original failures remain preserved. Targeted
hydration restored 2,568 exact accepted files totaling 150,985,478 bytes, without
fetching Git objects or expanding the whole documentation tree. Unmodified
documentation and feature validation then passed. No application build or
dependency install ran; normal protected Linux qualification remains required.

The first normal protected run, 40049618012/1, remains failed: 928 of 930 tests
passed, one failed and one Windows-only case was skipped. The historical R3 Git
admission fixture inherited the newly registered browser test script from its
ambient checkout, correctly triggering the unchanged frozen-package guard.
The exact failing case reproduced locally. Its fixture now seeds the recorded
historical package and inherits only the recorded protected-base script names;
the original runtime, type and contract rejection assertions remain, with an
explicit additional unlisted-script rejection. That focused case passed after
the fixture correction. No production guard, grant, outcome or deadline changed,
and the repaired candidate requires a new normal protected qualification.

The second normal protected run, 40051801552/1, remains failed. Its full focused
regression passed 929 of 930 tests with one Windows-only skip, and typechecking
passed. Rendered browser fixtures passed 13 of 14 tests; the native Source probe
retained a built-in asset after the literal m key on Linux Chromium, correctly
failing the existing absent-role guard. The unchanged native-only probe passed
all four contexts on Windows. Its public keyboard sequence now uses Home,
ArrowDown, ArrowDown and Enter to choose the same personal Source explicitly;
all outcome, focus, return, motion and no-capture assertions and the original
deadline remain. That changed native-only probe passed locally on Windows.
The production runner and guards are unchanged, and Linux qualification of this
changed candidate remains pending.

Synthetic native-select proof establishes control semantics only. Actual Studio
DESKTOP/MOBILE by NORMAL/REDUCED journeys, fresh governed capture, independent
media-first review, authenticated submission and ordinary product qualification
remain the product owner's separate obligations. This source correction grants
no new capture authority and establishes no physical or human acceptance.

This is an internal verification correction; no completed major feature changes,
so no Feature Catalog fragment update is required.
