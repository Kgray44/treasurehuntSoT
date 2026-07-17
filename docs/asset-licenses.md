# Asset licenses and provenance

The repository contains no Sea of Thieves map art, ripped game audio, private photographs, commercial fonts, or final surprise content.

## Original project assets

The following are original procedural assets authored for this public development companion and may be replaced by final private artwork later:

- `public/animations/lottie/moonlit-waves.json`
- `public/animations/lottie/rolling-fog.json`
- `public/animations/lottie/ink-bloom.json`
- All SVGs in `public/animations/stills`
- `public/illustrations/chart/voyage-chart.svg`
- `public/illustrations/finale/celestial-mechanism.svg`
- `public/illustrations/artifacts/compass-needle.svg`
- `public/textures/paper-grain.svg`
- Procedural Web Audio cues in `src/animation/core/audio-cues.ts`

## Third-party development sample

`public/animations/rive/rating-animation.riv` is copied from the official Rive WebAssembly runtime repository's rating example solely to prove a valid local state-machine integration in the development showcase.

- Project/source: `https://github.com/rive-app/rive-wasm/tree/master/js/examples/rating-animation`
- License: MIT
- Copyright: 2020-2021 Rive
- Local license notice: `public/animations/rive/LICENSE-RIVE-MIT.txt`
- SHA-256: `CB67C07896FA35DA41A976B61499277EF2B009D6D8858C11BD671C0DF5BC9630`
- Modification: none to the binary
- Product use: development-only `/dev/animations`; production Rive contracts use original SVG/CSS fallbacks

Third-party code licenses remain in package metadata and `package-lock.json`. Any later visual or audio asset must record source URL, author, license, modification, checksum where practical, product surfaces, and fallback before commit.
