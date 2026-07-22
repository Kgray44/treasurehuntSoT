# Project Wayfarer Phase 2 Integration Manifest

Status: pending final branch validation and push.

The branch starts at `f4bfc4b4f3585bc8f60ce4d94375dc77a7092da2`. Integration must apply the Phase 2 Wayfarer SQLite migrations after the completed Phase 1 chain and MySQL `0013` through `0015` after Harborlight `0010`. It conflicts conceptually with future profile/provider/preference work, not with Chronicle runtime or private package ownership.

Merge review must preserve Harborlight's `CommunityProfile.accountId` relation, resolve current identity from Wayfarer, retain Community status/attribution/release fields, and rerun migration, privacy, provider, TypeScript, full Vitest, and production build gates. Do not merge this branch automatically.
