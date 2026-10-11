---
title: Spatial Chronicle Pilot and consolidated Owner Sea Trials
audience: product-engineering
status: current
canonical_for: spatial-chronicle-pilot
last_reviewed: 2026-10-11
---

# The Lost Navigator’s Chart

This synthetic adventure brings accepted One Voyage, Landfall, Parallax, Crossdeck, Sextant and Reach surfaces into one owner session. Ten passages follow Iona Morrow’s unfinished chart from Lantern Quay to the Haven of the Returning Tide. All people, places and content are fictional. The baseline is protected main `f458bf2dc1176016c2d166180f038f0f15ac9f7c`.

## Setup and entry

Use an owned checkout and its dependencies. Run `node --import tsx scripts/spatial-pilot/prepare.ts` from that checkout. The default database is `artifacts/spatial-pilot/owner-preview.db`. An optional database argument must resolve beneath this checkout’s `artifacts/spatial-pilot` directory. Preparation refuses an existing database without its ownership receipt and never clears shared data. Its adjacent `.access.private.json` contains the randomly generated local synthetic sign-in; do not publish or upload that file.

Run `node --import tsx scripts/spatial-pilot/start.ts` to build and start a foreground, isolated production preview at `http://127.0.0.1:3278/sign-in?returnTo=/dev/spatial-pilot`. The launcher sets the owned database, exact synthetic owner and current source commit. It refuses an occupied port and validates the database's ownership receipt. It changes no shared runtime and stops with Ctrl+C.

For a phone-reachable preview, use `node --import tsx scripts/spatial-pilot/start.ts artifacts/spatial-pilot/owner-preview.db 3278 0.0.0.0`. On the computer open `http://localhost:3278/sign-in?returnTo=/dev/spatial-pilot`; on the phone use this computer's reachable network address. Sign into the same synthetic account on each. Use the displayed pairing code when the computer's pairing link points at localhost. A different database or free port can be passed explicitly. The prepared local owner environment for this task uses `artifacts/spatial-pilot/owner-sea-trials.db`; pass that path instead to the launcher.

Sign in with the local access file through the displayed sign-in route, then choose **Prepare the adventure**. Provisioning saves a canonical Studio draft, creates and attaches an immutable Spatial Library version, runs a current-source Drydock Scenario Suite, publishes through One Voyage, and launches a Captain + Player Voyage. Publication success requires its immutable receipt.

The authorized entry is `/dev/spatial-pilot`. Normal deployments and other accounts cannot open it. The existing nonce-bound generic Sounding Line fixture runtime also enables it solely for the exact synthetic navigator, allowing permanent browser regression without broadening ordinary product access.

## One owner session

Open the adventure from Owner Sea Trials. The Journal retains its normal progression, map, Lens and device controls. Its synthetic navigator ribbon links to Sea Trials and Voyage devices and offers Morrow’s optional compass. Pair the phone using the same synthetic account and Voyage; a companion is another surface of one person. During the chart handoff passage use **Send to… → Continue there → Send view**, then **Receive** on the phone. An offer alone is not successful delivery. Recovery remains Crossdeck’s disconnected-custody recovery.

The phone needs a reachable preview address. Each browser authenticates independently to the same persisted account and Voyage; Crossdeck's manual code works across the computer's localhost and phone's network address. Desktop localhost provides a browser secure context for Reach. Phone camera and device motion need a trusted secure context; plain network HTTP exercises story, chart and manual transfer with the supported screen clue. Provisioning changes no firewall, certificate, OS or security settings. Basic owner feedback remains in the computer's browser; the phone does not automatically merge its browser-local notes.

Complete the story, inspect the linked Spatial Studio, then enter `/devices/reach` from the same session. Reach retains its local camera, calibration and held-out validation; it estimates pointing and does not select objects or transfer the chart. Sea Trials gives the physical trial sequence and records activity status, observed/expected behavior and experience notes. Feedback stays in browser storage, keyed to the exact published edition, and exports as one local JSON file. Footage, camera identifiers, pairing material and credentials are not automatically included.

**Start a fresh Voyage** cancels the latest unfinished synthetic run through Helm's Captain lifecycle and creates another canonical playthrough of the same immutable edition. It preserves the cancelled record, completed runs and publications. This prevents an abandoned trial from leaving Creator access paused after the new adventure finishes. Finish Player participation before inspecting Studio, as Homeport requires. After exploring or receiving an older map page, **Return to Current Objective** resumes the narrative. For an independent synthetic environment, prepare a different new task-owned database; no destructive reset is needed.

## Scope and evidence

Parallax owns spatial content, fixed placement and its current renderer. Landfall owns the fictional virtual Worldspace and released geometry. Crossdeck owns pairing, offer/claim/acknowledgement/custody/recovery and transport. Sextant owns heading discovery, consent, quality/freshness and lifecycle. The compass rejects arbitrary or uncertain north references and retains the screen alternative. Only normal Player confirmation progresses the story.

Event-driven notifications with reconciliation are a separate Crossdeck-owned dependency; this journey is reusable after that integration. Adaptive/shared staging, native Sextant parity, Air Handoff, production recognition and Reach acquisition/manipulation remain outside this pilot.

`OWNER_ACCEPTANCE_PENDING` and `OWNER_PHYSICAL_ACCEPTANCE_PENDING` remain explicit. Targets of 3% display-diagonal accuracy, 1% jitter and 120 ms p95 exposure-to-visible latency follow [Reach’s qualification authority](../../Governing/Project_Sounding_Line_Voyagewright_Device_Lab_Governing_Annex_v1.1_Reach_Qualification.md). They are targets, not results. Worker/observation timing is not camera exposure-to-display latency. D2/D3 require actual supported simulators; D4/D5 require physical/field evidence.

The permanent journey `tests/e2e/spatial-chronicle-pilot.spec.ts` uses distinct desktop/mobile Chromium contexts, durable publication, pairing and receiver acknowledgement, no-duplicate progression, recovery, edition-preserving replay, local feedback, mobile/accessibility checks and real Studio captures. `src/spatial-pilot` tests authored contracts and fail-closed gating. Existing Reach browser and shared Device Lab packs cover synthetic calibration, permission/worker/model faults, epoch/staleness, privacy and cleanup.

Screenshots live in `artifacts/spatial-pilot/screenshots`; measurements in `artifacts/spatial-pilot/browser-measurements.json`. Handoff timing runs from automated Send invocation to observation of durable receiver acknowledgement, including browser-command/polling overhead. Recovery timing includes stale-presence waiting. Neither is physical input-to-photon latency. Build, browser and failed development evidence remain under the ignored task-owned artifact root. Qualification/integration receipts are added only after they exist.

**IMPLEMENTATION_COMPLETE.** The complete desktop/phone production-browser journey passes at clean source `37ac0fc5238b66f3b46608a6de010038056d067b`, tree `afc158977ba3281351a9f75c21eefab676c73b80`. Independently authenticated browser contexts use distinct loopback origins for the same person and Voyage. It records a fictional loft discovery, actual immutable publication, phone Lens inspection, durable handoff acknowledgement, disconnected-custody recovery without duplicate progression, the phone finale, completed history, replay, feedback persistence/export and populated Studio screenshots. Required ordinary protected-main qualification and landed smoke are recorded in source-bound integration receipts. The prepared owner account also passes the canonical sign-in service without exporting credential material.

Focused validation passes: three pilot authored-contract/authorization tests; 40 pilot/Journal/chart tests; 278 Parallax/Sextant/Crossdeck-object/transport tests; 58 verifier registration regressions; eight shared Parallax D0 scenarios; 36 shared Sextant D0/D1 scenarios; and seven shared Reach D0 scenarios. Four existing Reach production-browser scenarios pass at `0aad3e287dbc270c7daf461e9d411c21b826ceed`; their Reach implementation/test sources are unchanged in the final pilot source. Typecheck, focused lint/formatting and production build pass. The existing Windows Crossdeck Prisma `db push` fixture cannot initialize here; its durable service/security tests are deferred to the selected Linux ordinary qualification, not marked locally passed. The pilot uses the repository's migration-history SQLite bootstrap.

The final journey's measurements are one desktop Chromium observation: entry about 0.60 s, handoff about 0.80 s, recovery about 0.40 s. These include automation and polling overhead; recovery used canonical page-exit disconnection. The 60 visible-canvas browser animation scheduling intervals are retained individually and do not certify native spatial rendering or physical latency. Read the JSON boundaries before comparing measurements.

Actual captures and their source manifest are under `artifacts/spatial-pilot`; `contact-sheet.png` provides the overview. Full-resolution captures include all three Studio modes, selected inspector, real Library, graph, inspection timeline, active canvas, phone/remote viewpoints, narrow layout, empty Library search, simulated preparation failure, capability state, story transitions and finale. The authoring canvas and scene are synthetic previews; the runtime Lens uses the accepted Guided provider where native spatial hardware is unavailable.

Visual review corrected the pilot's external-layer instrument overlap, parchment contrast and replay/Creator transition dead end. Pre-existing platform findings remain focused owner dependencies: Parallax's Engineering inspector produces a very long narrow page, its small authored objects are hard to inspect at the default canvas scale, and mobile global chrome can occupy substantial initial space. Existing Landfall/Journal chart diagnostics and some parchment labels have weak contrast; fixed Journal controls can obscure portions of full-page captures and warrant representative-device owner review. No shared Studio, Lens or chart redesign is included. The development/HMR scene-host failure did not reproduce in the complete built production journey.

Host discovery records Windows x64 with no configured Android SDK/ADB/emulator or Apple simulator. D2/D3 are unavailable on this host; D4/D5 and owner physical/experience acceptance remain pending. No hardware result is inferred from synthetic or browser proof.
