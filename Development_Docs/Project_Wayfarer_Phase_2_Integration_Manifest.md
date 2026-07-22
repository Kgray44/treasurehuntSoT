# Project Wayfarer Phase 2 Integration Manifest

Status: ready for final branch validation, push, and convergence review.

The branch starts at `f4bfc4b4f3585bc8f60ce4d94375dc77a7092da2`. A final fetch observed `origin/main` at `4a84b9fd2dfa439127c35b8ce865ff8b7a5742b7`; the authorized baseline is an ancestor, and this branch was not rebased or merged during Phase 2. Convergence review must reconcile that newer mainline explicitly. Integration must apply the Phase 2 Wayfarer SQLite migrations after the completed Phase 1 chain and MySQL `0013` through `0015` after Harborlight `0010`. It conflicts conceptually with future profile/provider/preference work, not with Chronicle runtime or private package ownership.

Merge review must preserve Harborlight's `CommunityProfile.accountId` relation, resolve current identity from Wayfarer, retain Community status/attribution/release fields, and rerun migration, privacy, provider, TypeScript, full Vitest, and production build gates. Steam and Microsoft account are deployable only when their listed configuration is supplied; Xbox is separate partner-gated capability. Do not merge this branch automatically.
