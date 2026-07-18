# Phase B-1 Feature Flags

Flags are resolved on the server by `src/vision/feature-flags.ts`. APIs call `requireVisionFeature`; hiding a client control is never the authorization boundary. An override may use `FEATURE_<ENVIRONMENT_NAME>` or `NEXT_PUBLIC_<ENVIRONMENT_NAME>`. Accepted true values are `1`, `true`, `yes`, `on`, and `enabled`; every other explicit value is false.

| Flag                           | Environment name               |                Development default | Production default | Governs                                     |
| ------------------------------ | ------------------------------ | ---------------------------------: | -----------------: | ------------------------------------------- |
| `vision_waypoints`             | `VISION_WAYPOINTS`             |                                 on |                off | Root B-1 domain and APIs                    |
| `vision_waypoint_library`      | `VISION_WAYPOINT_LIBRARY`      |                       follows root |       follows root | Studio library/editor                       |
| `desktop_shell`                | `DESKTOP_SHELL`                | on only when `TALL_TALE_DESKTOP=1` |               same | Electron runtime diagnostics                |
| `pwa_install`                  | `PWA_INSTALL`                  |                                 on |                 on | PWA registration/install surface            |
| `player_hold_to_scan`          | `PLAYER_HOLD_TO_SCAN`          |                       follows root |                off | Player deterministic scan control           |
| `creator_capture`              | `CREATOR_CAPTURE`              |                                off |                off | Reserved creator capture                    |
| `vision_build_engine`          | `VISION_BUILD_ENGINE`          |                                off |                off | Reserved real build/inference engine        |
| `shadow_verification`          | `SHADOW_VERIFICATION`          |                                off |                off | Reserved shadow evaluation                  |
| `automatic_progression`        | `AUTOMATIC_PROGRESSION`        |                                off |                off | Reserved general automation                 |
| `automatic_vision_progression` | `AUTOMATIC_VISION_PROGRESSION` |                                off |                off | Reserved automatic Vision story progression |
| `live_external_ar`             | `LIVE_EXTERNAL_AR`             |                                off |                off | Reserved external-game/AR integration       |

The only B-1 verifier is deterministic and development-only. Turning on later-phase flags does not create capture, inference, localhost Companion, game integration, or unrestricted progression functionality; those seams remain unimplemented and report unavailable capabilities.

## Rollout and rollback

Enable production flags only after the additive migrations, seed/fixture check, package-integrity check, and same-origin security configuration pass in the target environment. Start with `vision_waypoints` and `vision_waypoint_library`; enable `player_hold_to_scan` only for the intended pilot. Rollback is immediate at the application layer by disabling those three flags. Keep the additive tables and immutable publications so existing story bindings and audit history remain explainable.
