# Phase B-1 Architecture

Status: implemented on `codex/phase-b1-foundation`  
Application version: `0.3.0-b1`  
Vision protocol: `1.0`  
Package schema: `1`

## Shared product boundary

B-1 retains one Next.js application. Browser, installed PWA, and Electron load the same routes, React components, Studio registry, progression service, Prisma models, Zod contracts, and API clients. Electron is a packaging and capability boundary, not another Player, Captain, or Studio implementation.

```text
shared Next.js UI and story engine
  -> VisionPlatformAdapter
     -> MockVisionPlatformAdapter (authorized B-1 implementation)
     -> WebCompanionPlatformAdapter (truthful unavailable boundary)
     -> DesktopPlatformAdapter (restricted preload bridge + same server API)
  -> versioned /api/vision-* and /api/verification-attempts routes
  -> Prisma SQLite/MySQL persistence
  -> existing TaleVerificationRequest / submitVerification seam
  -> TaleSessionEvent idempotency and canonical progression
```

Platform-specific code is confined to `src/vision/platform-adapters.ts` and `apps/desktop`. Shared UI never imports Electron, Node, localhost Companion assumptions, or generic native commands.

## Runtime vertical slice

1. Studio persists a `VisionWaypoint` and editable `VisionWaypointVersion` draft.
2. Publication validates the version, creates an immutable `VisionWaypointPublication`, SHA-256 package hash, and development `VisionBuildArtifact`.
3. A `visionWaypoint` story block stores the exact published version ID. Studio autosave recreates `StoryWaypointBinding` inside the same transaction as the story graph.
4. Entering the block creates the existing authoritative `TaleVerificationRequest` with provider `visionLocation`.
5. Player UI obtains a platform adapter and creates a persisted `VerificationAttempt`.
6. The deterministic mock records the governed progress states, result, evidence digest, and protocol message identifiers.
7. The result passes through `submitVerification`, which rechecks session, published tale version, current stage, provider, request, time, and idempotency key.
8. Only a verified current result appends canonical progression. Duplicate delivery returns the prior event and stale-stage delivery is rejected.
9. Captain diagnostics reads the persisted attempt and transitions; it does not invent client-only state.

## Ownership map

| Concern                       | Implementation                                                      |
| ----------------------------- | ------------------------------------------------------------------- |
| Domain and state machine      | `src/vision/domain.ts`                                              |
| Strict protocol 1.0           | `src/vision/protocol.ts`                                            |
| Lifecycle/versioning/bindings | `src/vision/lifecycle.ts`                                           |
| Attempts and story delivery   | `src/vision/attempts.ts`                                            |
| Adapters and selection        | `src/vision/platform-adapters.ts`                                   |
| Server-enforced flags         | `src/vision/feature-flags.ts`                                       |
| Permissions                   | `src/vision/permissions.ts`                                         |
| Studio UI                     | `src/components/studio/VisionWaypoint*.tsx`                         |
| Player UI                     | `src/components/player/VisionScanControl.tsx`                       |
| Captain UI                    | `src/components/captain/VisionAttemptDiagnostics.tsx`               |
| PWA                           | `public/manifest.webmanifest`, `public/sw.js`, `src/components/pwa` |
| Windows desktop               | `apps/desktop`, `scripts/prepare-desktop.mjs`                       |

## Feature flags

Flags are typed and resolved server-side. Development/test defaults enable `vision_waypoints`, `vision_waypoint_library`, and `player_hold_to_scan`; production defaults disable the Vision path unless operators explicitly enable it. `creator_capture`, `vision_build_engine`, `shadow_verification`, `automatic_progression`, `automatic_vision_progression`, and `live_external_ar` default false. See `B1_Feature_Flags.md` for the exact environment names/defaults and `B1_Domain_Model.md` plus `B1_Security_and_Privacy.md` for evolution boundaries.

## Deployment and rollback

SQLite migration `20260718050000_vision_waypoint_b1` and MySQL migration `0005_vision_waypoint_b1` are additive. Published versions and story bindings are retained when deprecated. Production rollback is: disable B-1 flags, roll back the application, and leave additive tables intact. Destructive database rollback requires a verified pre-migration backup and is not automated.
