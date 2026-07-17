# Rive assets

## Production contracts

Invitation seal, journal clasp, voyage compass, and finale mechanism have explicit state-machine contracts but deliberately use local original SVG/CSS fallbacks in production. No claim is made that these fallbacks are `.riv` files. When final project-authored binaries arrive, set each contract's local `path`, confirm artboard/state-machine/input names in the showcase, update provenance, and retain the fallback.

| Object           | State machine      | Required states                                                        | Current production asset     |
| ---------------- | ------------------ | ---------------------------------------------------------------------- | ---------------------------- |
| Invitation seal  | `Invitation Seal`  | idle, hover, pressed, listening, opening, rejected                     | `seal-fallback.svg`          |
| Journal clasp    | `Journal Clasp`    | locked, awake, opening, open                                           | `journal-clasp-fallback.svg` |
| Voyage compass   | `Voyage Compass`   | idle, bearing, arrived                                                 | `compass-fallback.svg`       |
| Finale mechanism | `Finale Mechanism` | dormant, teased, sealed, partial, ready, unlocking, unlocked, complete | `finale-fallback.svg`        |

## Development runtime proof

`rating-animation.riv` is a development-only runtime sample from the official `rive-wasm` repository. It proves local WebGL2 loading, state-machine discovery, input reporting, lifecycle cleanup, and fallback handling. It is omitted by the production contract gate and is never presented as Forever Treasure artwork.

- Source: `https://github.com/rive-app/rive-wasm/tree/master/js/examples/rating-animation`
- License: MIT, Copyright 2020-2021 Rive; retained beside the binary as `LICENSE-RIVE-MIT.txt`
- Size: 16,229 bytes
- SHA-256: `CB67C07896FA35DA41A976B61499277EF2B009D6D8858C11BD671C0DF5BC9630`
- State machine: `State Machine 1`
- Loading: dynamic client import, `useOffscreenRenderer: true`, `shouldDisableRiveListeners: true`, CDN fallback disabled

The runtime reports available inputs to the showcase. Boolean, number, and trigger controls are created from that live list; unknown inputs are never guessed. Reduced motion disables autoplay and uses a stable pose or fallback.
