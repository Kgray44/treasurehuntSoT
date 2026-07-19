# Lottie assets

## Phase 3 command boundary

One-shot Lottie effects are `commanded`: they load with `autoplay: false` and do not begin merely because their React component mounted. A matching instance-scoped semantic command may call play or a segment after target preflight. Completing, stopping, entering reduced mode, or unmounting clears commanded playback so visibility restoration cannot restart an old one-shot.

Ambient loops also load with runtime autoplay disabled; the component applies visibility and resolved motion policy after readiness. Reduced mode stops travel and exposes the declared representative frame. Fetch, import, data, timeout, and renderer failures retain the local static fallback and never change event meaning, receipt eligibility, focus, or authoritative state.

The three Lottie files are original Forever Treasure shape-layer animations with local SVG fallbacks.

| Key             | File                 | Composition | Use                                 | Full / gentle / reduced                                    |
| --------------- | -------------------- | ----------- | ----------------------------------- | ---------------------------------------------------------- |
| `moonlit-waves` | `moonlit-waves.json` | 1200 × 320  | Landing and access ambience         | Loop / 0.65x / representative frame                        |
| `rolling-fog`   | `rolling-fog.json`   | 1200 × 420  | Harbor, chart, and finale depth     | Slow loop / lower speed and opacity / representative frame |
| `ink-bloom`     | `ink-bloom.json`     | 320 × 320   | Journal, log, and quest punctuation | One shot / short one shot / static ink mark                |

`LottieEffect` imports `lottie-web` only on the client, loads JSON with `fetch` from the same origin, mounts to its own container, exposes play/pause/stop/speed controls where requested, pauses with page visibility, and destroys the animation on unmount. A fetch, parse, import, or render failure swaps to the registered local fallback without hiding content.

When adding a file, remove unused metadata, keep paths and image references local, prefer shape layers over embedded raster images, add a representative still, register its pages/motion behavior/provenance, and run `npm run assets:validate` plus the showcase error-path check.
