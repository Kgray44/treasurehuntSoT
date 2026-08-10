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
11. Determine semantic evidence invalidation before selecting reruns. Preserve immutable prior evidence through a new source-bound carry-forward receipt only when its dependencies are unchanged; source SHA churn alone is not invalidation.
12. Test-only changes are capped to the owning family and direct evidence consumers unless a written dependency explanation proves a broader obligation. Do not use a full gate as reassurance after valid acceptance evidence exists.
13. Classify a failure before mutation when classification controls repair ownership or scope. A product defect, test defect, environment defect, infrastructure defect, contention condition, and timeout have different legal repairs.
14. Request scarce validation resources through the shared broker queue. Fairness age, source guards, cleanup-before-handoff, and isolated compatible lanes control execution; conversational ordering, lock deletion, and queue bypass are prohibited.
15. Treat a contradictory reference-environment result, evidence-integrity failure, missing artifact, unverified carry-forward, or late reclassified root failure as a closure-revalidation incident. Reopen only the affected obligation. A documentation/evidence-only change closes with proportionate record validation unless a semantic dependency proves a broader gate.

Required wording: **IMPLEMENTED** (code changed), **FOCUSED VALIDATED** (named affected evidence), **INTEGRATION VALIDATED** (named boundary evidence), **RELEASE VALIDATED** (required release gate evidence), **EXTERNAL BLOCKED** (required external proof unavailable), and **NOT VALIDATED** (no sufficient evidence). These statuses must not be collapsed into “complete.”
