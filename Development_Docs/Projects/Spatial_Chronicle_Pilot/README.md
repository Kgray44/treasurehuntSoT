---
title: Spatial Chronicle Pilot and consolidated Owner Sea Trials
audience: product-engineering
status: implementation-in-qualification
canonical_for: spatial-chronicle-pilot
last_reviewed: 2026-10-11
---

# The Lost Navigator’s Chart

This synthetic adventure brings accepted One Voyage, Landfall, Parallax, Crossdeck, Sextant and Reach surfaces into one owner session. Ten passages follow Iona Morrow’s unfinished chart from Lantern Quay to the Haven of the Returning Tide. All people, places and content are fictional. The baseline is protected main `f458bf2dc1176016c2d166180f038f0f15ac9f7c`.

## Setup and entry

Use an owned checkout and its dependencies. Run `node --import tsx scripts/spatial-pilot/prepare.ts` from that checkout. The default database is `artifacts/spatial-pilot/owner-preview.db`. An optional database argument must resolve beneath this checkout’s `artifacts/spatial-pilot` directory. Preparation refuses an existing database without its ownership receipt and never clears shared data. Its adjacent `.access.private.json` contains the randomly generated local synthetic sign-in; do not publish or upload that file.

The preview requires `DATABASE_URL` pointing at that file, `SPATIAL_PILOT_ENABLED=1`, and `SPATIAL_PILOT_OWNER_ID=spatial-pilot-navigator`. Set `SPATIAL_PILOT_SOURCE_SHA` to the full current commit. Use the production build and an isolated server on a free task-owned port. Sign in through `/sign-in?returnTo=/dev/spatial-pilot`, then choose **Prepare the adventure**. Provisioning saves a canonical Studio draft, creates and attaches an immutable Spatial Library version, runs a current-source Drydock Scenario Suite, publishes through One Voyage, and launches a Captain + Player Voyage. Publication success requires its immutable receipt.

The authorized entry is `/dev/spatial-pilot`. Normal deployments and other accounts cannot open it. The existing nonce-bound generic Sounding Line fixture runtime also enables it solely for the exact synthetic navigator, allowing permanent browser regression without broadening ordinary product access.

## One owner session

Open the adventure from Owner Sea Trials. The Journal retains its normal progression, map, Lens and device controls. Its synthetic navigator ribbon links to Sea Trials and Voyage devices and offers Morrow’s optional compass. Pair the phone using the same synthetic account and Voyage; a companion is another surface of one person. During the chart handoff passage use **Send to… → Continue there → Send view**, then **Receive** on the phone. An offer alone is not successful delivery. Recovery remains Crossdeck’s disconnected-custody recovery.

The phone needs a reachable preview origin; both browsers must use that origin. Camera and device motion need a trusted secure context. Plain network HTTP can exercise story, chart and manual transfer with the supported screen clue; it does not prove live camera or heading support. Provisioning changes no firewall, certificate, OS or security settings.

Complete the story, inspect the linked Spatial Studio, then enter `/devices/reach` from the same session. Reach retains its local camera, calibration and held-out validation; it estimates pointing and does not select objects or transfer the chart. Sea Trials gives the physical trial sequence and records activity status, observed/expected behavior and experience notes. Feedback stays in browser storage, keyed to the exact published edition, and exports as one local JSON file. Footage, camera identifiers, pairing material and credentials are not automatically included.

**Start a fresh Voyage** creates another canonical playthrough of the same immutable edition. Earlier runs remain in Player Library. For an independent synthetic environment, prepare a different new task-owned database; no destructive reset is needed.

## Scope and evidence

Parallax owns spatial content, fixed placement and its current renderer. Landfall owns the fictional virtual Worldspace and released geometry. Crossdeck owns pairing, offer/claim/acknowledgement/custody/recovery and transport. Sextant owns heading discovery, consent, quality/freshness and lifecycle. The compass rejects arbitrary or uncertain north references and retains the screen alternative. Only normal Player confirmation progresses the story.

Event-driven notifications with reconciliation are a separate Crossdeck-owned dependency; this journey is reusable after that integration. Adaptive/shared staging, native Sextant parity, Air Handoff, production recognition and Reach acquisition/manipulation remain outside this pilot.

`OWNER_ACCEPTANCE_PENDING` and `OWNER_PHYSICAL_ACCEPTANCE_PENDING` remain explicit. Targets of 3% display-diagonal accuracy, 1% jitter and 120 ms p95 exposure-to-visible latency follow [Reach’s qualification authority](../../Governing/Project_Sounding_Line_Voyagewright_Device_Lab_Governing_Annex_v1.1_Reach_Qualification.md). They are targets, not results. Worker/observation timing is not camera exposure-to-display latency. D2/D3 require actual supported simulators; D4/D5 require physical/field evidence.

The permanent journey `tests/e2e/spatial-chronicle-pilot.spec.ts` uses distinct desktop/mobile Chromium contexts, durable publication, pairing and receiver acknowledgement, no-duplicate progression, recovery, edition-preserving replay, local feedback, mobile/accessibility checks and real Studio captures. `src/spatial-pilot` tests authored contracts and fail-closed gating. Existing Reach browser and shared Device Lab packs cover synthetic calibration, permission/worker/model faults, epoch/staleness, privacy and cleanup.

Screenshots live in `artifacts/spatial-pilot/screenshots`; measurements in `artifacts/spatial-pilot/browser-measurements.json`. Handoff timing runs from automated Send invocation to observation of durable receiver acknowledgement, including browser-command/polling overhead. Recovery timing includes stale-presence waiting. Neither is physical input-to-photon latency. Build, browser and failed development evidence remain under the ignored task-owned artifact root. Qualification/integration receipts are added only after they exist.

Current development proof: three authored-contract/authorization tests, 24 Reach/control/transport tests and seven shared Reach D0 scenarios pass. Four existing Reach production-browser scenarios pass at candidate `0aad3e287dbc270c7daf461e9d411c21b826ceed`. The complete pilot production journey is still in qualification. The existing Windows Crossdeck Prisma `db push` fixture failed schema initialization and remains unqualified locally; migration-history SQLite bootstrap works for the pilot. A development/HMR chart attempt hit Lanternwake’s destroyed scene-host registry. Production evidence must resolve that finding before any complete-experience claim.
