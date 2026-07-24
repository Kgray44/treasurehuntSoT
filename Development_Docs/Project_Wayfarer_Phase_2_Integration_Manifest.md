# Project Wayfarer Phase 2 Integration Manifest

Status: **PROJECT WAYFARER PHASE 2 COMPLETE**; pushed branch awaits convergence review.

The branch starts at `f4bfc4b4f3585bc8f60ce4d94375dc77a7092da2`. A final fetch observed `origin/main` at `4a84b9fd2dfa439127c35b8ce865ff8b7a5742b7`; the authorized baseline is an ancestor, and this branch was not rebased or merged during Phase 2. Convergence review must reconcile that newer mainline explicitly. Integration must apply the Phase 2 Wayfarer SQLite migrations after the completed Phase 1 chain and MySQL `0013` through `0015` after Harborlight `0010`. It conflicts conceptually with future profile/provider/preference work, not with Chronicle runtime or private package ownership.

Merge review must preserve Harborlight's `CommunityProfile.accountId` relation, resolve current identity from Wayfarer, retain Community status/attribution/release fields, and rerun migration, privacy, provider, TypeScript, full Vitest, and production build gates. Steam and Microsoft account are deployable only when their listed configuration is supplied; Xbox is separate partner-gated capability. Do not merge this branch automatically.

## Closure update (2026-07-22)

The final continuation validated on the unchanged branch lineage from
`234c4e1f1fe531595cb38e1e235299bdf19ea17e`; its final commit and remote parity
are the branch-closure evidence. No merge, rebase, or force push is authorized.
The final 65-route production build includes the repaired Community
`/api/community/listings/[id]/public` segment and the focused Playwright
Wayfarer browser proof (2 passed, 0 failed, 0 skipped) used a new fourteen-step
SQLite rehearsal database and isolated profile-media root. Post-merge review
must rerun that focused browser project as well as migration ordering,
privacy/projection, provider, full Vitest, and build gates.

External staging validation remains deferred: live Discord, Steam, Microsoft,
partner-gated networks, and isolated live MySQL. These are integration proofs,
not Phase 2 implementation blockers. Lanternwake production Rive assets remain
an unrelated release NO-GO.
