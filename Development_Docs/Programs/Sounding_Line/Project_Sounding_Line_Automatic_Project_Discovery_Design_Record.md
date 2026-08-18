# Sounding Line Automatic Project Discovery — Design Record

Status: `IMPLEMENTING`

## Frozen contract

Sounding Line recognizes a project from bounded path topology plus catalog, project-document, registry, contract, ownership, and trusted-main signals. A descriptor is deterministic: normalized identity and aliases, observed roots, related suite/contract/owner identifiers, ordered evidence, state/confidence, source SHA, and a SHA-256 digest.

Candidate-derived evidence creates `PROVISIONAL_CONSERVATIVE`: it may broaden proof and never narrow it. A planner receiving such a descriptor retains all existing sentinels and takes the conservative fallback. Only a descriptor rebuilt from the exact trusted-main tree, with deterministic identity, no ownership conflict, and sufficient relationship evidence becomes `TRUSTED_DISCOVERED` and may augment later semantic selection.

Discovery runs after protected-path classification. Sounding Line authority, release, workflow, policy, binding, canonical mapping, and control-plane paths retain their existing hard rejection. Structural onboarding is deliberately narrow: product source, tests, project/program documents, and project-named scripts that correlate with another safe project root. A bare `scripts/**` path is never admitted.

The derived registry is source-bound to the trusted-main SHA/tree, schema-versioned, canonicalized, digest-verified, reproducible, and stale-detectable. Missing, stale, corrupt, weak, ambiguous, or conflicting data does not authorize a candidate; it regenerates from trusted-main evidence where possible or falls back conservatively. Candidate content cannot write a registry that narrows its own plan.

Multiple identities yield distinct descriptors. Alias normalization merges only equivalent normalized names; incompatible owners or protected-path collisions remain `AMBIGUOUS`/`CONFLICT` and do not silently choose an owner. Discovery is an input to the existing v1.4 semantic planner, not a second planner.
