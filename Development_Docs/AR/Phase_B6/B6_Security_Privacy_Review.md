# Phase B-6 security, privacy, dependency, and game-safety review

## Review performed

The repeatable security suite covers exact-origin loopback pairing, expiring challenges, monotonic sequence/replay rejection, command allowlists, structured redaction, bounded paths and sizes, corrupt/unsupported packages, trusted runtime-package signatures, signed release metadata, artifact integrity, active-session update interlocks, restricted preload IPC, rollback, and transient Player frames. Existing story tests cover stale-stage and duplicate-event rejection.

The desktop follows the current [Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security): renderer sandboxing, context isolation, disabled Node integration, navigation/window restrictions, sender/origin validation, and a narrow preload bridge. Electron’s [context isolation guidance](https://www.electronjs.org/docs/latest/tutorial/context-isolation) also warns against exposing generic IPC; the bridge exposes only governed commands.

Rive’s official [self-hosting guidance](https://rive.app/docs/runtimes/web/preloading-wasm) documents `RuntimeLoader.setWasmUrl`. B-6 stages the exact locked `@rive-app/webgl2@2.38.5` primary and fallback WASM files locally and records their SHA-256 hashes. Runtime CDN fallback is no longer required.

## Dependency and license result

On 2026-07-18, `npm audit --json` exited 0 with 0 info, low, moderate, high, or critical vulnerabilities across 938 dependency records. Pinning `esbuild@0.28.1` corrected Vite 8’s incompatible peer resolution while `tsx` retains nested `esbuild@0.25.12`. `npm ls --all --json` exits 0; it still reports five orphan-labeled optional WASM helpers in npm’s `problems` array, so this toolchain warning is documented and must be rechecked on npm upgrades.

An installed-tree inventory found 704 unique package/version pairs: 565 MIT, 40 ISC, 39 Apache-2.0, 21 BSD-3-Clause, 15 BSD-2-Clause, 5 MPL-2.0, and smaller permissive/notice-bearing sets. GSAP and `@gsap/react` use the GSAP standard no-charge license and require distribution review. The sole undeclared `transport@0.0.1` package.json is inside Pino test fixtures, not a declared runtime dependency. `@img/sharp-win32-x64` declares `Apache-2.0 AND LGPL-3.0-or-later`; distribution notices and obligations require release-owner review. This is not legal advice.

## Privacy result

- Runtime Player pixels are processed locally in bounded memory and cleared after inference.
- No cloud-assisted build or mandatory upload path exists.
- Metadata-only diagnostics are the default; retained Creator recordings have explicit storage and deletion paths.
- Captain truth labels retain hashes, results, gates, versions, and reasons—not raw frames.
- Log tests reject secrets, pixels, and raw titles.

Automated controls pass locally, but no independent security/privacy reviewer participated. B6-009 remains open.

## Sea of Thieves distribution safety

The design does not inject, automate input, edit game files, or render inside the game. That technical boundary does not grant distribution approval. Rare’s current [Enforcement Policy Updates](https://support.seaofthieves.com/articles/24643308439314) state that third-party tools are generally against the Code of Conduct and warn that even specifically discussed external solutions may be flagged at the user’s risk. The [Xbox Community Standards](https://www.xbox.com/en-US/legal/community-standards) also prohibit cheating and inappropriate content use.

The governing project decision therefore remains: obtain and archive written Rare/Microsoft clarification for this exact capture-only design before public distribution. B6-012 remains open; this repository does not claim affiliation, endorsement, or safe-listing.
