---
title: Embarkation - Owner Screening Correction
audience: product-engineering
status: current
canonical_for: refit-v1-embarkation-local-screening
last_reviewed: 2026-09-21
---

# Embarkation — Owner Screening Correction

**IMPLEMENTATION_ITERATING — owner-requested motion/fog/Stage C correction.**
The owner's rejection supersedes the affected Delta 2 visual conclusions, which
remain preserved as historical evidence. Current work is tracked in
[the correction record](correction-proof.json). The full authored film
is **35.8 seconds**, following the owner's Delta 2 runtime update. First entry
and Replay Arrival use that program. Normal return remains two seconds; reduced
motion retains the 1.8-second ceremony. No merge, owner acceptance or adjacent
Refit work is included.

Owned branch `codex/refit-v1-embarkation`, worktree
`D:\CodexWorktrees\treasurehunt-refit-v1-embarkation`, accepted Muster baseline
`241a4f606850d4447209eef4ef5895a309527fbc` (#658/#659).

## Running screening

Open [Crossing the Threshold](http://127.0.0.1:3138/dev/embarkation).
[Full CINEMATIC playback](http://127.0.0.1:3138/dev/embarkation/enter?role=captain&arrival=first&quality=CINEMATIC)
and [the developer scrubber](http://127.0.0.1:3138/dev/embarkation/enter?role=captain&arrival=first&quality=CINEMATIC&inspector=1)
use a guarded, isolated synthetic session. Choose **JOIN THE ADVENTURE** after
preparation. The fixture retains its current live authority: Kato is crew and
Sera is Captain. The historical `role=captain` URL selects Kato's fixture account;
it does not confer Captain permissions or change the helm.

The scrubber supports exact time, frame stepping, 1× / 0.5× / 0.25×, material
isolation, camera/depth/moon visualization, an exterior projection grid, quality,
reduced motion, mute, material freeze and compositor-loss testing. Collapse it
for unobstructed playback.
Hold Space or the compass for three seconds to skip; releasing early cancels.
After arrival, leave the room running for at least eight seconds to see residual
suspension damping and quiet persistent flame/water life.

## Authored pacing and physical continuity

| Time        | Event                                                                                                 |
| ----------- | ----------------------------------------------------------------------------------------------------- |
| 0–4         | Recognizable platform, original heading arcs/curls into JOIN, pressure against rigid supports         |
| 4–10        | Free edges strain, anchors fail in sequence, components reorient and accelerate into depth            |
| 10–16       | Maximum crossing energy near 12.15; contact at 11.45, peel at 13.65, slower chart pass from 13.25     |
| 16–22       | Separated landscape planes, forward exploration, readable moon and water, remaining material recedes  |
| 22–27       | Continuous patchy fog travels from behind the eye; one celestial anchor reconciles behind dense banks |
| 27–31       | Backward dolly through the opening, past fixed lantern/timber and into foreground furniture           |
| 31–34.35    | Measured real DOM pieces overtake the eye, catch staggered supports and relax under decaying wind     |
| 33.35–34.65 | Personalized welcome, subordinate Captain treatment when applicable, physical recession               |
| 34.7–35.8   | Clean interactive Muster, zero camera/wind/transition material, arrival stillness                     |
| Thereafter  | Same continuous living-light and water clock; fixed architecture, crop and furniture                  |

This is a re-authored program, not a duration multiplier. Releases, spray and
near passes retain velocity. The extra time is assigned to resistance, separate
crossing compositions, exploration, fog transport, room entry and anchor catches.
The camera travels 3,900 world units forward before backing to its exact final
view. It is completely stationary from 31 seconds onward.

The two UI transformations use the same membrane law. The old platform retains
held regions while free edges peel away. The incoming mounted Muster begins
behind the eye, travels past it, catches new supports and remains under tension
before relaxing. Existing nodes, fonts, crew data and controls remain live;
there is no raster proxy-to-DOM exchange.

## Environment, weather and liquid

The screened Chronicle landscape is separated into original-pixel mountain,
middle-island, near-shore and rock layers. A reconstructed sky/water backing
fills disoccluded areas. Fixed perspective planes replace the earlier broad
image bending. The source master remains unchanged; contours are refined against
its pixel colors and feathered at water contact.

The room reuses its existing eight matte-projected regions and actual exterior
aperture, with expanded backing and deeper architecture to give entry more time.
The preceding exterior remains outside the opening. At the final viewpoint the
projection reconstructs the accepted room. Generated fill supports hidden areas
and overscan; it does not replace the approved final composition.

Mist is an advected, seeded 3D density field with broad banks, smaller turbulence
and clear gaps. Far and near passes provide occlusion around physical material.
Two world-space vortex tubes also drive the paper and spray. Procedural spray
contains instanced droplets, velocity-aligned streaks, perspective, blur and
focus variation. Full P10/P11/P13/P14/P15 sheets are never scene layers. The rigid
isolated rope event is removed.

Sparse lens impacts occur around 6.05, 10.65 and 14.6 seconds. Drops refract the
already-rendered scene, briefly adhere, elongate, merge with a smaller lobe and
run down under gravity, leaving a thin draining trail. They clear by 19.3,
well before interactive arrival.

The 22–27-second fog passage never resets its transport. The Stage B/exterior
material change is behind overlapping dense banks. One world-space moon body
and its scattering light carry the celestial identity; painted duplicate discs
are removed from supporting backings. The light's position reconciles while the
view is obscured, then becomes the room's existing exterior moon.

## Living room and handoff

Five lantern/attachment silhouettes and thirteen wick-pinned flames are now
independent RGBA materials made from the approved painting. Flame-free housings
and clean static backing prevent surrounding sky or wood from moving with them.
Suspension retains its continuous phase and residual velocity, damping from the
entry into the existing restrained ambient character. Each light has independent
tip bending, stretch, contained glow and bounded local illumination.

Masked water displacement remains below a painted pixel. Existing silver and
warm reflection paths fragment and reconnect with layered, incommensurate
frequencies and sparse glints. They stay distant during room entry. Reduced motion
removes water displacement and substantially suppresses suspension/flame motion;
minimal non-spatial shimmer remains. Quality modes preserve composition while
bounding sampling and update cost.

## Owner correction: causes and resulting behavior

The owner's rejection supersedes the affected visual conclusions in the
historical Delta 2 record. The current correction keeps the 35.8-second cut.

| Rejected outcome | Actual cause | Correction |
| --- | --- | --- |
| Slow releases and miniature debris | The presentation clock was correct. Low release/transport speeds and a long extinction range kept material visibly present. Cache sampling also had a terminal-clamping risk, although that was not the observed opening slowdown. | Event age remains seconds since release. Faster material-specific impulses, entrainment, rotation and flutter restore force. A fixed 12-second cache extrapolates velocity beyond its horizon. Depth extinction removes remote material before world-space retirement. |
| Abrupt fog coverage | Advected noise was already present across the viewing volume; a global density envelope made that whole volume appear. | Successive irregular banks originate behind the eye, overtake it and disperse downstream. Their upstream supply grows and dwindles. Coverage follows their positions, widths and optical depth; no global visibility ramp supplies or removes them. |
| Missing moon continuity | The disc was faded off at the fog cue, while scattering used an unrelated screen position. | One celestial state supplies the projected disc, volumetric light direction and existing-reflection modulation. Registration reconciles from 23.85–24.75 behind moving fog. The disc is attenuated by fog; softened blue-white light remains in thinner regions. |
| Lower exterior stretching | Image-row-dependent depth bent the entire exterior, including rigid foreground objects. Its water vanishing line also needed a finite shoreline intersection. | A ray-intersected level water plane meets the distant matte at the shoreline. Sky/coast and rigid pier/boats have separate fixed depths. Controlled source registration supplies measured supporting coverage. The 27–31-second backward glide is unchanged. |

The written chart retains its local 4.5-second near pass and then accelerates
downstream. The text-contact interval remains readable; released paper regains
fast flight. No ordinary storm actor has a minimum screen size, a terminal parked
position or a camera-following respawn. In the approved synthetic seed, ordinary
material falls below the renderer's visible transmission threshold by **21.8 s**;
it remains absent during fog, Stage C and camera reversal. JOIN and incoming
Muster controls remain separately authored families.

Fog screening shows clear landscape at 21.5–22, partial coverage around
22.5–23.5, concealed scenery around 23.9–24.5, patchy harbor reveal around
24.7–26, and clearance by about 26.5–27. Banks continue moving throughout.
The moon is visible before the banks, becomes a softened attenuated cue, and
emerges in the harbor registration. The temporary projection-grid and weather
isolation controls are off in normal playback.

The active Stage C textures are `stage-c-water.webp` (1536×1024),
`stage-c-pier.png` (1536×1024 transparent material), and
`stage-c-extended.webp` (1598×1157). The original-coordinate rectangle is
`[31,113,1536,1024]`. The older `exterior-nomoon.webp` and
`exterior-overscan.webp` are derivation inputs, not active Stage C textures.
The room still uses `room-overscan-delta2.webp` and its existing matte layers.
[Registered art provenance](correction-art.json) records exact generation and
compositing; [coverage measurements](correction-coverage.json) cover desktop,
tablet, phone and wide compositions throughout the path.

## Current evidence and known limits

[The current correction proof](correction-proof.json) binds playback, runtime
texture URLs/dimensions, shader/source/asset hashes, representative trajectories,
fog frames, moon diagnostics and isolated lower-third/grid checks to the actual
candidate. Evidence is under
`.runtime/embarkation/motion-fog-correction/owner-preview`; earlier directories
are development iterations, not current owner-preview proof. Normal playback
includes eight seconds of living room observation. Slower fog/threshold playback
supports inspection; it does not establish normal-speed energy.

The correction's focused checks include event-age timing invariance with fresh
caches after extending later scenic beats, continued downstream motion beyond
the cache, no surviving debris during reversal, real bank transport and planar
water geometry. Browser checks retain hold/cancel/skip, return/replay, guest and
role-aware welcome, quality tiers, reduced motion, compositor loss and measured
DOM convergence. The current normal film completed in 35.898 seconds;
316 presentation-clock samples measured 0.99953×. Frame time
was 16.7 ms median / 50.0 ms p95 / 83.4 ms p99,
with 13.2 ms CPU render p95. All 28 focused tests and
11 browser scenarios passed, together with living/replay checks and the final
environment handoff. Typechecking and scoped lint passed.

All 23 supplied master hashes still match. At an identical clock time the
cinematic-to-living handoff has zero pixel difference. The fixed sign and cushion
remain stationary while flame and water regions change. The new exterior also
received weather-disabled, water-frozen inspection throughout the backward glide;
final-frame similarity alone was not used as proof of that shot.

This is a painted 2.5D scene with authored projection surfaces. Large camera
departures beyond the approved path are unsupported. The isolated preview uses
its registered synthetic Chronicle artwork; arbitrary replacement environments
need their own registered matte sets. Performance measurements include local
development/video overhead and are not broad-device or locked-60-fps claims.
Current recording evidence is silent; optional event-driven audio has no new
auditory owner-quality claim in this correction. Owner acceptance remains pending.

## Historical Delta 2 evidence

[Delta 2 proof](delta2-proof.json) preserves its prior measurements and visual
conclusions as history. The four owner-rejected outcomes are superseded by the
current correction record. Earlier Delta 1 and initial evidence remain intact.

## Asset preservation and reproduction

[The manifest](asset-manifest.json) classifies all supplied masters and records
regions, derivative hashes, alpha treatment, blend/depth rules, deformation,
lighting, scale and emitter participation. The additional screened Chronicle
source has separate provenance. Masters remain in the original Downloads ZIP
and the owned runtime; no supplied source was overwritten.

[Exact Delta 2 prompts](delta2-derived-art-prompts.json) record built-in
`image_gen` requests for supporting sky/water/exterior/room overscan. Final
optimized derivatives are under `public/images/embarkation/derived`. Original
source pixel extraction uses Sharp and OpenCV; generated fill is only backing.
The earlier [Delta 1 proof](delta1-proof.json) and [initial proof](initial-proof.json)
remain historical evidence.

Focused reproduction uses `screen-embarkation-delta2.mjs`,
`record-embarkation.mjs`, `verify-embarkation.mjs`,
`verify-embarkation-environment.mjs`, `verify-embarkation-living.mjs` and
`verify-embarkation-replay.mjs` under `scripts/refit`. Only the owned port 3138 and
`.runtime/muster/muster.sqlite` fixture are used. Existing personal/private data
and other preview runtimes are outside this work.
