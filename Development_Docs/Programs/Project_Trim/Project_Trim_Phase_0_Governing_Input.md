---
title: Project Trim Phase 0 Governing Input
audience: engineering
status: preserved
canonical_for: project-trim-phase-0-governing-input
last_reviewed: 2026-08-14
---

# Project Trim Phase 0 Governing Input

## What Phase 0 measured

Phase 0 sampled four repository increments (authority infrastructure, focused
repair, documentation/governance repair, and continuation/closure), current
instructions, the effective Sounding Line index, existing machine manifests,
Git change surfaces, program records, and the engineering document index. It
did not inspect whole conversations, rerun work, or implement optimization.

Exact Codex input/cached/output token totals, prompts, elapsed time, read/search
counts, and historical subagent counts are unavailable from the safely exposed
local evidence. File, byte, record, manifest, and Git-change counts are direct
proxies only and must not be represented as token measurements.

## Strongest findings

1. The repository already has the necessary fact sources: 475 contracts, 156
   path mappings, 456 contract mappings, 61 suites, 16 owners, 19 resources,
   seven release gates, a current machine authority index, validation debt, Git
   identities, and a 1,049-record engineering document index.
2. Discovery is the largest evidenced reducible class. The corpus has 1,474
   engineering-record files (about 368 MB), including 120 Sounding Line program
   files (about 37.6 MB). The problem is relevance routing, not absence of data.
3. Continuation/closure evidence is distributed. A retained Deepwater closure
   record binds candidate, merge, authority, protected-binding, and mainline
   identities; this is suitable material for a compact accepted-phase capsule.
4. A focused Studio repair changed one source file, while an inspected direct
   impact-map lookup did not return a mapping for that path. Packets must show
   mapping gaps and expand conservatively rather than assuming completeness.
5. Mandatory permanent instructions are modest and should remain available:
   `AGENTS.md` requires every task to read the testing workflow. The goal is not
   to suppress governing reads; it is to slice authority and avoid unrelated
   archaeology.

## Recommended Phase 1 architecture order

1. Build a Minimum Sufficient Context Packet generator that composes existing
   ownership, contracts, impact, suites, resources, gates, authority, document
   index, and Git delta sources. Do not create parallel registries.
2. Add a normalized accepted-phase/status capsule keyed by immutable
   candidate/merge/evidence identities.
3. Add a privacy-safe, blob-aware context/read ledger. It should measure
   initial packet size, expansion causes, unique and repeated blob reads,
   mapping fallbacks, and subagent shared versus unique material.
4. Define context profiles for focused repair, bounded implementation,
   continuation/closure, and record-only work. Profiles are initial slices, not
   permissions barriers.
5. Add subagent packet slicing only after packet identity and the ledger exist.

## Governing requirements to add

- Define `STANDARD_AUTONOMOUS` and `UNATTENDED_CONTINUATION`; both allow
  autonomous targeted context expansion.
- State: **CONTEXT EXPANSION IS NOT SCOPE EXPANSION.**
- Require an expansion reason and a conservative fallback for absent/uncertain
  mappings. A packet must never omit required proof because a map is incomplete.
- Permit opening primary authority, source, history, or tests whenever the
  initial slice is insufficient; packet budgets must be soft initial guardrails.
- For unattended work, do not stop merely because more context, local setup, a
  focused failure, or another in-scope file is needed. Hard stops are only
  authorization, destructive-action, credential, irreconcilable-governance,
  unrelated-work-risk, or no-safe-path conditions.
- Require packet/ledger retention and privacy boundaries before task telemetry
  is collected. Do not copy full prompts or conversations when digests, counts,
  and file identities suffice.

## Initial guardrails, not token claims

Use file-pointer and slice limits until safe runtime telemetry exists: 3–6
pointers for focused repairs, 6–12 for bounded implementations, and one
accepted-phase capsule for continuation/closure. Include one authority slice,
owner/contract/suite closure, known main delta, expansion triggers, and direct
primary-source links. No numerical token-savings target is justified yet.

## Assumptions Phase 0 did not confirm

Phase 0 did not confirm historical repeated-file-read volume, oversized prompts,
actual subagent multiplication, or excessive final-response length. These remain
plausible hypotheses, not baseline facts. Phase 1 telemetry should test them
without retaining private task content.
