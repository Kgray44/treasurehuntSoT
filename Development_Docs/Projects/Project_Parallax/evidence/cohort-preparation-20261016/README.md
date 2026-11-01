---
title: Spatial cohort immutable intake and virtual merge observations
audience: engineering
status: current
canonical_for: parallax-cohort-preparation-evidence-20261016
last_reviewed: 2026-10-16
---

# Preparation evidence

These records establish source custody and virtual text merging only. They do
not constitute browser capture, independent review, protected qualification or
physical-device acceptance. No real private content or paid API call is included.

- [Immutable intake manifest](immutable-intake.json): exact source, Git blob, byte count and SHA256 for139 original Inspector artifacts, two review documents and two publishing source/test files.
- [Custody verification](custody-verification.json): all143 intake files match their original Git blob and SHA256;119 references in original native manifests match. Original workflow fields remain unchanged.
- [Initial root/main virtual merge failure](main-f935-root-325-merge-tree.original.txt): retained DNS failure.
- [Corrected root/main virtual merge](main-f935-root-325-merge-tree-corrected.original.txt): sole raw-evidence attribute conflict; no branch movement.
- [Rehearsal/main virtual merge](main-f935-rehearsal-352-merge-tree.original.txt): textually clean, not a qualification result.

Original Inspector manifests and local workflow fields remain byte-identical
in their source-keyed directories. Human approval remains separate from the
local diagnostic's `ownerAcceptance: NOT_CLAIMED`. The [decision log](../../Cohort_Integration_Decision_Log_20261016.md)
records the pending accepted-base and whole-cohort gates.

The retained `*.original.log` files distinguish dependency setup, scoped ESLint,
documentation/catalog checks and their failures. Initial docs validation caught
a custody report created after indexing; rerunning the index includes that
report before validation. No runtime or browser result is inferred from these
preparation checks. Catalog sync/validation passes without promoting the partial
cohort; accepted publishing availability still requires its owning fragment
decision at final integration.
