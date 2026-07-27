# Project Lanternwake Phase 3 — Visual Checkpoint Index

- Status: **semantic visual acceptance complete; hashed screenshot archive not retained**
- Required total: **57 semantic checkpoints**
- Distribution: **11 Journal + 14 chapter + 6 map + 7 artifact + 5 quest + 5 log + 9 finale**

This index preserves the exact semantic checkpoints required by the Phase 3 brief, not arbitrary-delay screenshots or pixel-perfect contracts. The completed browser/visual review and the post-fix targeted checks were accepted by the project owner on 2026-07-19. The original capture manifest below is retained to show what a hashed image archive would have contained. Its `not retained` artifact cells mean that no screenshot file/hash archive was kept; they are not unresolved semantic failures and are not being converted into invented paths, hashes, or run IDs.

The missing artifact archive is accepted deviation `P3-DEV-02` in `Project_Lanternwake_Phase_3_Validation_Report.md`. Phase 3's visual verdict is therefore **PASS by completed semantic review**, with **0 retained per-checkpoint screenshot artifacts claimed**.

## Semantic visual acceptance record

| Checkpoint family             | IDs                                 |  Count | Semantic review            | Artifact archive |
| ----------------------------- | ----------------------------------- | -----: | -------------------------- | ---------------- |
| Journal opening and interface | VCP-JRN-01 through VCP-JRN-11       |     11 | **accepted**               | not retained     |
| Chapter release and fallback  | VCP-CHP-01 through VCP-CHP-14       |     14 | **accepted**               | not retained     |
| Map location and route        | VCP-MAP-01 through VCP-MAP-06       |      6 | **accepted**               | not retained     |
| Artifact and inspection       | VCP-ART-01 through VCP-ART-07       |      7 | **accepted**               | not retained     |
| Side quests                   | VCP-QST-01 through VCP-QST-05       |      5 | **accepted**               | not retained     |
| Ship's Log                    | VCP-LOG-01 through VCP-LOG-05       |      5 | **accepted**               | not retained     |
| Finale                        | VCP-FIN-01 through VCP-FIN-09       |      9 | **accepted**               | not retained     |
| **Total**                     | **VCP-JRN/CHP/MAP/ART/QST/LOG/FIN** | **57** | **57 accepted / 0 failed** | **0 retained**   |

- Integrated Phase 3 implementation: `3a24e1e9c88449ee0bdfe35d7ab4bfe378d82fac`.
- Merged clean Phase 3 baseline: `35132ca5e38187336c0632f392edbfc985e5ff55`.

## Historical per-checkpoint capture manifest

| Label                  | Event                        | Case       | Section   | Mode            | Viewport  | Browser  | Artifact path | SHA-256      | Run ID       | Integrated SHA | Archive status | Note                                                             |
| ---------------------- | ---------------------------- | ---------- | --------- | --------------- | --------- | -------- | ------------- | ------------ | ------------ | -------------- | -------------- | ---------------------------------------------------------------- |
| entry activated        | opening                      | VCP-JRN-01 | journal   | full            | 1440x900  | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Opening activation; readable heading present.                    |
| camera approach        | opening                      | VCP-JRN-02 | journal   | full            | 1440x900  | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Camera approach preserves readable content and focus order.      |
| clasp awake            | opening                      | VCP-JRN-03 | journal   | full            | 1440x900  | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Truthful Clasp fallback state; no final Rive claim.              |
| latch released         | opening                      | VCP-JRN-04 | journal   | full            | 1440x900  | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Released latch and readable control state.                       |
| cover open             | opening                      | VCP-JRN-05 | journal   | full            | 1440x900  | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Cover-open semantic state.                                       |
| sealed page            | opening                      | VCP-JRN-06 | journal   | full            | 1440x900  | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Current visible primary sealed page only.                        |
| seal broken            | opening                      | VCP-JRN-07 | journal   | full            | 1440x900  | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Broken-seal state remains readable.                              |
| book settled           | opening                      | VCP-JRN-08 | journal   | full            | 1440x900  | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Book final pose with no duplicate accessible page.               |
| PageFlip interactive   | opening                      | VCP-JRN-09 | journal   | full            | 1440x900  | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Runtime or verified static page is ready; controls reachable.    |
| interface ready        | opening                      | VCP-JRN-10 | journal   | full            | 1440x900  | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Journal interface is keyboard/touch ready.                       |
| objective ready        | opening                      | VCP-JRN-11 | journal   | browser-reduced | 390x844   | WebKit   | not retained  | not retained | not retained | not retained   | not-retained   | Objective and `JOURNAL_READY` content without physical travel.   |
| preflight              | CHAPTER_RELEASED             | VCP-CHP-01 | chart     | full            | 1440x900  | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Exact visible target preflight while chart remains current.      |
| seal pressure          | CHAPTER_RELEASED             | VCP-CHP-02 | journal   | full            | 1440x900  | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Pressure is decorative; global summary stays readable.           |
| seal fracture          | CHAPTER_RELEASED             | VCP-CHP-03 | journal   | full            | 1440x900  | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Fracture does not prematurely acknowledge viewed state.          |
| parchment open         | CHAPTER_RELEASED             | VCP-CHP-04 | journal   | full            | 1440x900  | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Open parchment with one global readable target.                  |
| heading                | CHAPTER_RELEASED             | VCP-CHP-05 | journal   | full            | 1440x900  | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | One authoritative chapter heading.                               |
| story prose            | CHAPTER_RELEASED             | VCP-CHP-06 | treasures | full            | 1440x900  | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Authorized prose readable without forced Journal navigation.     |
| objective              | CHAPTER_RELEASED             | VCP-CHP-07 | quests    | full            | 1440x900  | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Authorized current objective is readable.                        |
| riddle                 | CHAPTER_RELEASED             | VCP-CHP-08 | log       | full            | 1440x900  | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Authorized riddle is readable outside Journal.                   |
| quill                  | CHAPTER_RELEASED             | VCP-CHP-09 | finale    | full            | 1440x900  | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Command-driven ink/quill label; decoration is aria-hidden.       |
| map inset              | CHAPTER_RELEASED             | VCP-CHP-10 | journal   | full            | 1920x1080 | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Readable map inset without unrelated chart selection.            |
| complete               | CHAPTER_RELEASED             | VCP-CHP-11 | journal   | full            | 1440x900  | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Final-state handoff completed before cleanup.                    |
| actions ready          | CHAPTER_RELEASED             | VCP-CHP-12 | journal   | full            | 1440x900  | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Skip, Replay, and destination controls are reachable.            |
| reduced final          | CHAPTER_RELEASED             | VCP-CHP-13 | chart     | browser-reduced | 844x390   | WebKit   | not retained  | not retained | not retained | not retained   | not-retained   | Equivalent readable reduced outcome in narrow landscape.         |
| fallback final         | CHAPTER_RELEASED             | VCP-CHP-14 | journal   | product-reduced | 390x844   | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Forced readable fallback preserves current page and focus.       |
| global location object | MAP_LOCATION_REVEALED        | VCP-MAP-01 | chart     | full            | 1440x900  | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Global location object and destination action.                   |
| marker stamp           | MAP_LOCATION_REVEALED        | VCP-MAP-02 | chart     | full            | 1440x900  | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Exact keyed marker; unrelated markers unchanged.                 |
| fog settled            | MAP_LOCATION_REVEALED        | VCP-MAP-03 | chart     | product-reduced | 390x844   | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Settled fog/fallback remains readable; no final Rive claim.      |
| route start            | MAP_ROUTE_REVEALED           | VCP-MAP-04 | finale    | full            | 1440x900  | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Route starts globally without forced chart navigation.           |
| route complete         | MAP_ROUTE_REVEALED           | VCP-MAP-05 | chart     | full            | 2560x1440 | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Exact keyed path/endpoints settle without wrapper conflict.      |
| ship course settled    | MAP_ROUTE_REVEALED           | VCP-MAP-06 | chart     | browser-reduced | 844x390   | WebKit   | not retained  | not retained | not retained | not retained   | not-retained   | Settled course and controls have no clipping or overflow.        |
| global relic reveal    | ARTIFACT_AWARDED             | VCP-ART-01 | treasures | full            | 1440x900  | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Named artifact award readable globally.                          |
| slot handoff           | ARTIFACT_AWARDED             | VCP-ART-02 | treasures | full            | 1440x900  | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Exact slot handoff; unrelated slots unchanged.                   |
| pedestal settle        | ARTIFACT_SILHOUETTE_REVEALED | VCP-ART-03 | treasures | gentle          | 1440x900  | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Exact silhouette/pedestal settles with readable name.            |
| connection draw        | ARTIFACT_CONNECTED           | VCP-ART-04 | treasures | full            | 1920x1080 | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Keyed endpoints and connection path.                             |
| inspection open        | ARTIFACT_AWARDED             | VCP-ART-05 | treasures | full            | 1440x900  | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Boxed semantic dialog is modal and keyboard contained.           |
| engraving complete     | ARTIFACT_AWARDED             | VCP-ART-06 | treasures | full            | 1440x900  | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Dialog-local engraving capability; background inert.             |
| return to slot         | ARTIFACT_AWARDED             | VCP-ART-07 | treasures | browser-reduced | 430x932   | WebKit   | not retained  | not retained | not retained | not retained   | not-retained   | Return settles and focus reaches exact visible trigger.          |
| rumor note             | SIDE_QUEST_DISCOVERED        | VCP-QST-01 | quests    | full            | 1440x900  | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Named quest discovery and exact note.                            |
| pin/thread             | SIDE_QUEST_DISCOVERED        | VCP-QST-02 | quests    | full            | 1440x900  | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Stable pin/thread target; no DOM-index selection.                |
| objective update       | SIDE_QUEST_UPDATED           | VCP-QST-03 | quests    | gentle          | 1440x900  | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Changed objective identity is distinct from quest note.          |
| completion stamp       | SIDE_QUEST_COMPLETED         | VCP-QST-04 | quests    | full            | 1920x1080 | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Exact completion stamp and reward summary.                       |
| reward state           | SIDE_QUEST_COMPLETED         | VCP-QST-05 | quests    | browser-reduced | 390x844   | WebKit   | not retained  | not retained | not retained | not retained   | not-retained   | Reward meaning survives without motion-only signaling.           |
| global summary         | PLAYER_LOG_ENTRY_ADDED       | VCP-LOG-01 | log       | full            | 1440x900  | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Player-safe log summary readable globally.                       |
| fresh ink              | PLAYER_LOG_ENTRY_ADDED       | VCP-LOG-02 | log       | full            | 1440x900  | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Fresh-ink child uses the immutable progress-event row.           |
| date stamp             | PLAYER_LOG_ENTRY_ADDED       | VCP-LOG-03 | log       | full            | 1440x900  | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Exact date child target settles.                                 |
| symbol seal            | PLAYER_LOG_ENTRY_ADDED       | VCP-LOG-04 | log       | gentle          | 2560x1440 | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Exact symbol child avoids duplicate row ownership.               |
| settled row            | PLAYER_LOG_ENTRY_ADDED       | VCP-LOG-05 | log       | browser-reduced | 430x932   | WebKit   | not retained  | not retained | not retained | not retained   | not-retained   | Immutable event-ID row is readable with no overflow.             |
| dormant                | FINALE_TEASED                | VCP-FIN-01 | finale    | full            | 1440x900  | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Dormant mechanism fallback is authoritative and readable.        |
| tease wake             | FINALE_TEASED                | VCP-FIN-02 | finale    | full            | 1440x900  | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Truthful frozen state/progress wake; no final Rive claim.        |
| requirement transfer   | FINALE_REQUIREMENT_UPDATED   | VCP-FIN-03 | finale    | gentle          | 1440x900  | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Exact requirement transfer and capability lifecycle.             |
| ready                  | FINALE_REQUIREMENT_UPDATED   | VCP-FIN-04 | finale    | full            | 1440x900  | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Named requirement state is ready and readable.                   |
| unlock start           | FINALE_REQUIREMENT_UPDATED   | VCP-FIN-05 | finale    | full            | 1920x1080 | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Exact keyed socket begins its unlock state.                      |
| seal fracture          | FINALE_REQUIREMENT_UPDATED   | VCP-FIN-06 | finale    | full            | 2560x1440 | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Finale seal state and semantic requirement agree.                |
| chamber expansion      | FINALE_REQUIREMENT_UPDATED   | VCP-FIN-07 | finale    | full            | 1440x900  | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Readable expansion fallback without final Rive art claim.        |
| complete               | FINALE_REQUIREMENT_UPDATED   | VCP-FIN-08 | finale    | full            | 1440x900  | Chromium | not retained  | not retained | not retained | not retained   | not-retained   | Completion final state and exact requirements agree.             |
| reduced final          | FINALE_TEASED                | VCP-FIN-09 | finale    | browser-reduced | 844x390   | WebKit   | not retained  | not retained | not retained | not retained   | not-retained   | Finale meaning survives with reachable controls and no overflow. |

## Capture completion record

| Field                         | Value                                                                     |
| ----------------------------- | ------------------------------------------------------------------------- |
| Rows present                  | 57                                                                        |
| Semantic checkpoints accepted | **57**                                                                    |
| Semantic checkpoints failed   | **0**                                                                     |
| Retained screenshot files     | **0 — accepted deviation P3-DEV-02**                                      |
| SHA-256 mismatches            | not applicable; no screenshot hashes claimed                              |
| Acceptance record             | cumulative Phase 3 browser/visual review + targeted post-fix verification |
| Implementation SHA            | `3a24e1e9c88449ee0bdfe35d7ab4bfe378d82fac`                                |
| Merged baseline SHA           | `35132ca5e38187336c0632f392edbfc985e5ff55`                                |
| Reviewer / date               | Project owner acceptance / 2026-07-19                                     |
