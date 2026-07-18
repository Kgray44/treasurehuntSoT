# Phase B-4 Security, Privacy, and Game Safety

## Local pixel boundary

Creator WebM recordings and bounded derived grayscale frames remain under Electron user-data storage. BuildInput contains IDs, hashes, roles, regions, rules, and test metadata, not media or filesystem paths. Player frames stay in a bounded memory ring, are consumed by the runtime before the capture result returns, and are zeroized. Normal runtime diagnostics contain metrics and hashes only.

Derived creator frames are authoring artifacts under creator-managed retention. Their manifest states that they contain no color pixels. Deleting the creator artifact removes WebM, manifest, and derived frame set.

## Package safety

Packages are immutable data, never plugins. Names are allowlisted; traversal, separators, duplicates, unsupported versions, and hash/size mismatches reject. Atomic publication uses a temporary managed file and rename. Reusing a package ID with different bytes rejects.

## Transport and authorization

Desktop commands use the existing restricted IPC sender/origin check. Browser commands require exact-origin pairing, P-256 challenge proof, monotonic sequence, unique request ID, bounded payload, and rate limiting. Authenticated server routes verify ownership, permission, CSRF, input hash, report size, and forbidden raw-frame fields.

## Game safety

B-4 uses operating-system selected-window capture only. It does not inject into Sea of Thieves, read process memory, read game files, automate player input, inject overlays, inspect packets, or inspect game network traffic.

## Progression safety

Every package is shadow-only. Every certification has `automaticEligibility=false`. Every runtime result has `automaticProgression=false`. `VisionShadowAttempt` is analysis data and has no story-session success relation. Stale stage context and package/provider faults are system errors, not location judgments.
