# Codex Testing Obligations

This is mandatory repository policy for future Codex implementation work.

1. Before implementation identify changed behavior, contracts, owners, existing/missing tests, required tiers, and applicable exclusions.
2. Intentional behavior changes update stale tests and add regression coverage in the same task where practical; superseded assumptions are documented.
3. Do not delete assertions without semantic replacement; replace assertions with generic visibility; inflate timeouts without diagnosis; add arbitrary sleeps, broad swallowing, unconditional skips, `test.only`, or retries to gain green.
4. For a bug fix where practical: reproduce, prove failure cause, repair, prove pass, then run the impacted family.
5. Features consider success, invalid input, unauthorized/stale/duplicate/retry/interruption/cancellation/network/provider failure, privacy, accessibility, reduced motion, no-audio, and mobile behavior. Explain inapplicable cases.
6. Source ownership entails test ownership; an unexceptioned changed subsystem without appropriate tests blocks release.
7. Use focused reproducer → unit/component → service/API → browser → cross-project contract → governed release gate, not repeated full-suite loops.
8. Test debt records missing capability, risk, owner, blocker, future gate, and temporary evidence.
9. Completion includes files/behavior/tests added/tests updated/tests selected/omitted reasons/evidence/gaps.
10. Green means actual named evidence, not a route rendering, mock, showcase, TypeScript pass, or documentation claim.

Required wording: **IMPLEMENTED** (code changed), **FOCUSED VALIDATED** (named affected evidence), **INTEGRATION VALIDATED** (named boundary evidence), **RELEASE VALIDATED** (required release gate evidence), **EXTERNAL BLOCKED** (required external proof unavailable), and **NOT VALIDATED** (no sufficient evidence). These statuses must not be collapsed into “complete.”
