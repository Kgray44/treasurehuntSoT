# Lottie assets

The three Lottie files are original Forever Treasure shape-layer animations with local SVG fallbacks.

| Key             | File                 | Composition | Use                                 | Full / gentle / reduced                                    |
| --------------- | -------------------- | ----------- | ----------------------------------- | ---------------------------------------------------------- |
| `moonlit-waves` | `moonlit-waves.json` | 1200 × 320  | Landing and access ambience         | Loop / 0.65x / representative frame                        |
| `rolling-fog`   | `rolling-fog.json`   | 1200 × 420  | Harbor, chart, and finale depth     | Slow loop / lower speed and opacity / representative frame |
| `ink-bloom`     | `ink-bloom.json`     | 320 × 320   | Journal, log, and quest punctuation | One shot / short one shot / static ink mark                |

`LottieEffect` imports `lottie-web` only on the client, loads JSON with `fetch` from the same origin, mounts to its own container, exposes play/pause/stop/speed controls where requested, pauses with page visibility, and destroys the animation on unmount. A fetch, parse, import, or render failure swaps to the registered local fallback without hiding content.

When adding a file, remove unused metadata, keep paths and image references local, prefer shape layers over embedded raster images, add a representative still, register its pages/motion behavior/provenance, and run `npm run assets:validate` plus the showcase error-path check.
