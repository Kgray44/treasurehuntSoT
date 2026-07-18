# Phase B-3 Demonstration Record

Status: automated demonstrations passed; required real/realistic Companion demonstrations remain blocked

## Automated evidence

`tests/e2e/vision-waypoint-b3.spec.ts` provides five repeatable Chromium flows:

1. Exact Landmark / Story-Critical authoring through strict APIs, persisted capture-manifest fixtures, regions, hard negatives, tests, locked test, WCAG Axe scan, deterministic BuildInput, and no-model assertions;
2. persisted disconnect state, wizard resume, and stale-revision recovery;
3. published-version immutability;
4. Story-Critical nearby/distant hard-negative build gate;
5. shared browser/desktop-renderer parity.

The fixture manifests say `Automated fixture window` and `no target-game claim`. They validate B-3 contracts and storage behavior but are not represented as real Sea of Thieves captures.

Preserved screenshot after the validation run:

- `Development_Docs/AR/Phase_B3/Evidence/01-studio-region-authoring.png`
- SHA-256: `2765489ACF76CA5BFB0E56C8EA06A582DF590DB82577E43FD32EBE5C3E923DFA`

The persisted job can be re-read through `/api/vision-build-jobs/{jobId}`. Assertions require the exact input hash and `modelProduced: false`, `confidenceProduced: false`.

The Electron Companion smoke harness also passed against the actual desktop-capturer adapter with a synthetic harness window. It covered window discovery, minimize/restore recovery, capture progress, raw-frame clearing, creator-output integrity and deletion, browser pairing, and target-close detection. This validates the B-2 capture boundary without presenting synthetic content as a live target-game demonstration.

Desktop packaging succeeded for `0.5.0-b3`; however, this machine's Application Control policy blocked launch of the unsigned packaged executable with `spawn UNKNOWN`. That result does not satisfy a live packaged-app or target-game demonstration.

## Governing Demonstration A: Exact Landmark

Status: **BLOCKED**

The host has a Steam Sea of Thieves manifest at `D:\SteamLibrary\steamapps\appmanifest_1172620.acf`, but no Sea of Thieves/Athena process or window was running during final verification. Codex did not launch the game or enter an account session without user coordination. Therefore the following were not honestly demonstrated against the target game:

- selecting its real window;
- recording multiple real target views and real quality guidance;
- accepted-area/boundary/hard-negative walks in Sea of Thieves;
- representative-frame region work over real target footage;
- final Library thumbnail/status over that real draft.

## Governing Demonstration B: Disconnection recovery

Status: **BLOCKED for manual Companion evidence; automated persistence/recovery passes**

The automated test stores an explicit disconnected Companion state, reloads the route, resumes at step 4, and proves optimistic-concurrency recovery. It does not begin a live target-game recording, interrupt the real Companion transport, reconnect, and continue the same recording workflow. A coordinated manual run is still required.

## Governing Demonstration C: Web and desktop parity

Status: **BLOCKED for live capture parity; shared implementation and automated DOM parity pass**

Automated contexts render the same 12-step component with web and restricted desktop bridges. B-2 already proves both transports reach one capture core. B-3 still needs a live paired-browser and integrated-desktop authoring run that produces equivalent domain data and BuildInput schemas from real Companion captures.

## Governing Demonstration D: Immutability

Status: **Pass (automated)**

The B-3 test publishes a draft, attempts an authoring mutation, and receives `409 PUBLISHED_VERSION_IMMUTABLE`. Existing B-1 coverage creates a next draft from a published parent and verifies the sealed configuration and exact story binding remain unchanged.

## Manual rerun outline

1. Start the development app with the B-3 migration and explicit build fixture flag.
2. Start the integrated desktop Companion or approve browser pairing.
3. Launch Sea of Thieves to a safe reproducible landmark with the user present.
4. Perform Demonstration A steps 1–26 from the governing prompt.
5. During a new recording, disconnect/reconnect Companion for Demonstration B.
6. Repeat the core workflow once through paired browser and once through desktop for Demonstration C; export both aggregates and compare BuildInput schemas/hashes after equivalent inputs.
7. Preserve screen recording, timestamps, adapter/protocol version, capture session IDs, data-health resolution, BuildInput hashes, and participant/operator notes.

Until those steps are executed, required demonstration status remains blocked and Phase B-3 remains incomplete.
