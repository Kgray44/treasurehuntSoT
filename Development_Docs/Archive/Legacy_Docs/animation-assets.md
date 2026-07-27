# Animation assets

All production assets are local, registered, and paired with a fallback. Runtime code never loads artwork from a CDN.

| Asset family                     | Location                          | Loading                                             | Failure behavior                              |
| -------------------------------- | --------------------------------- | --------------------------------------------------- | --------------------------------------------- |
| Original Lottie shape animations | `public/animations/lottie`        | Critical waves at entry; fog at idle; ink on intent | Static local representative SVG               |
| Rive binaries                    | `public/animations/rive`          | Intent/development only in the current phase        | Project-authored SVG/CSS stateful fallback    |
| Static runtime fallbacks         | `public/animations/stills`        | Immediate                                           | Accessible label remains if image cannot draw |
| Original illustrations           | `public/illustrations`            | Browser-native local SVG                            | Text/list views remain authoritative          |
| Material texture                 | `public/textures/paper-grain.svg` | CSS background                                      | Solid parchment token                         |

`npm run assets:validate` parses each Lottie JSON contract, checks local paths and fallbacks, verifies the local Rive binary signature and size, and ensures no registered animation URL is remote. The validator runs in the complete release gate.

Asset contracts record key, local path, intended pages, renderer or state machine, motion-mode behavior, loading priority, dimensions, provenance, and fallback. Add the contract and license record before adding an asset to a component.

Performance policy: use SVG Lottie for the current small shape animations; do not autoplay hidden or reduced-motion media; pause when the document is hidden; load noncritical effects at idle or first intent; destroy runtime instances on unmount; and avoid shipping source-editor files to the browser.
