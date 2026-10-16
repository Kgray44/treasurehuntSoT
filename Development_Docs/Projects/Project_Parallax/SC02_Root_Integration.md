---
title: SC-02 integration into the current Spatial Studio
audience: engineering
status: in-progress
canonical_for: parallax-sc02-root-integration-20261015
last_reviewed: 2026-10-15
---

# Scope and preserved authority

This integration continues PR #722. It adopts SC-02 source/evidence ancestry
`73db990b554e2236df7bbda4286f5b8023a3636f` into the existing qualification
candidate at `5333638a`, preserving the current groups, room geometry, continuous
surfaces, placement, timeline, Assistant, independent Environment workspace and
unified Library. The obsolete SC-02 Asset Browser shell is not substituted for
the current Library. Implemented element descriptors feed its existing provider
seam. Original source reviews, failed captures and SC-02 review transitions remain
historical evidence, not combined-candidate acceptance.

The narrow SC-00C phone Library patch is taken from exact source
`e0fea9f702407d38a69f7b739b49a2805ca5af01`. Its standalone proof does not
qualify the combined Studio header or renderer.

# Integration decisions

Typed elements are optional in canonical entities. Old records retain omission
and checksum material. Paper keeps plane-local orientation; Y-up element roots
retain the actual selected horizontal room frame and yaw. Renderer object caches,
canonical opacity, selection, room editing and renderer receipts remain in place.
Effects use the authored timeline, bounded counts, preview quality and reduced
motion. Preview sound requires an explicit user gesture and stops on pause,
backgrounding and disposal.

Composition extraction saves through the canonical draft writer and explicitly
adds Library membership. Reuse resolves the current owner record or an exact
requested release, then makes an independent editable copy in the current Scene.
Ordinary reusable assets/assemblies retain their existing released-copy route.
Installed Community provenance remains owned by SC-07A; its pending corrections
are not imported or claimed complete here.

Unsupported native/simulated element rendering uses the authored Guided meaning.
An explicitly requested Browser AR provider instead reports unsupported element
types and requires the user to choose Guided View. It must never silently replace
the requested browser AR attempt.

# Validation and remaining gates

The first combined focused run retained 152 passing checks and two failures:
floating-point quaternion identity after Y-up frame composition, and simulated
runtime fallback for unsupported elements. The frame result is normalized and
simulated fallback restored. The second run passes 154 checks across five files,
including existing BrowserRoomView corner/lifecycle tests. These are isolated
domain/component checks, not physical tracking evidence.

Independent source review found two additional blocking integration defects:
`PX-SC02-OPACITY-01` (element fade envelopes overwritten by animation opacity,
including skipped particle alpha) and `PX-SC02-COMPOSITION-MOTION-01` (composition
extraction/reuse discarded tracks). The repair composes intrinsic alpha, element
envelope and animation opacity once for Mesh and Points; saves/remaps included
tracks and frame identities; and rebases root POSITION keys with the extracted
and inserted pose while retaining child-local keys. The independent re-review
found both source findings resolved. This is source review, not rendered acceptance.

The aggregate rerun passes **979 checks across 82 files**, including the final
moving-root regression and photo recovery/Studio/Lens tests. The first broad run
failed 23 checks: two Canvas fixtures needed the real AnimationProvider/new audio
cleanup seam, and 21 image-bearing component checks exposed Next's CommonJS
namespace through the moved Windows dependency junction. Test setup now unwraps
the actual Next Image component; it does not replace it with a mock image.
All failed logs are retained. Final full typing, changed-file lint, documentation
validation and Feature Catalog validation pass after the repairs. Actual-browser
work remains pending.

The first combined local browser invocation stopped before application startup
because its database path failed the existing isolation contract. Its original
PowerShell tree field is malformed and is not source-binding evidence. The second
used an admitted isolated database but Turbopack refused the C: dependency junction
into D:. A detached owned D: validation checkout at the same `e073eaa2` candidate
and tree `3d25b96e169d069dd6a63d80b89ad6bf0d37df90`, with literal same-drive
dependencies, built successfully and rendered the real Studio. That third attempt
failed before insertion because the test requested `textbox / Search Library`;
the actual control is a category-specific `searchbox / Search assets`. It does not
qualify element insertion or playback. All three failed logs, original receipts,
and the third attempt's screenshot/recording/trace remain under
`evidence/sc02/root-integration-20261015/`. Task-owned server/proxy cleanup passed.
The correction uses the visible searchbox in the selected Library category and
waits for canonical autosave rather than invoking the removed Save draft button.
These local invocations do not reset protected review history or allowances.

The fourth local attempt at `eab394b0` reaches the real chest detail card, then
stops at another stale test label: the visible primary action is **Add to active
Scene**, while the test requested **Add to Scene** (the unopened card menu uses
the latter). Its original FAIL and cleanup PASS remain retained. The repair
targets the visible primary action. It does not bypass a disabled control or
change the product.

Attempt five at `ccb26230` renders the inserted chest and edits/inserts effects,
then saves the composition through canonical membership. It fails at owned
composition discovery. Inspection of its isolated stored row confirms `SAVED`,
`SCENE_TEMPLATE`, and the `composition` tag, but `library.type: SCENE` inherited
from the draft factory. The catalog therefore lists it as a Scene. This is a
confirmed integration defect. New extraction writes TEMPLATE metadata; read-only
catalog projection also recognizes earlier explicitly marked composition templates
without rewriting historical records. The two focused files pass 124 checks.
Attempt five remains FAIL; reuse/playback/mobile assertions were not reached.

Attempt six at `12c52dab87275d45e48193f0ba0be890c7e82d71`, tree
`edbbcbdc98ef7e5ca6a2787f46df92334e62b09a`, passes the combined authenticated
production-browser journey (1/1, 17.7 s). It inserts the chest and light, saves and
discovers an owned composition, inserts an independent second copy, verifies two
roots in the same persisted Scene after reload, and observes two preview audio
voices during playback and zero when paused. It captures desktop and 390 px
Library/view controls and records no page errors. The production build includes
full TypeScript validation. The D: source remained clean at the exact candidate;
server/proxy cleanup passed. Four PNGs and the complete recording are retained
under `browser-attempt-6`. Independent rendered review is pending. This single
journey does not establish all visual, keyboard, theme, physical or consumer gates.

Builder screenshot inspection found the phone View disclosure's body missing
from the visible canvas despite its buttons satisfying the original visibility
assertion. The older three-selector rule made the disclosure `position: static`,
overriding the new relative positioning; its absolute body was consequently
anchored beyond the canvas. The bounded correction restores the disclosure as
the positioning parent without changing camera pivots. The browser check now
requires Frame scene to be in the viewport and clicks it. This repair still needs
fresh captured proof. Attempt six's PASS is retained at its original, weaker
assertion scope and does not claim that the phone menu was usable.

The immutable independent attempt-six review (`490d1f78`, retained beside its
receipts) records `REPAIR_AND_RECAPTURE` for blocking P2 `SC02-PHONE-01`.
Attempt seven at `32401cb5b70829c4d828e8f66f088f054f5477cd`, tree
`f6ac9507c56c905485eac170c056e05dccee37b8`, passes the strengthened browser
journey (1/1, 16.1 s), including the on-screen Frame scene click; source remains
clean and cleanup passes. The original log and all media are retained. Native
phone pixels show the lower menu controls now, but independent inspection finds
the editing toolbar covering its first row. This is a partial repair, not closure
of the phone finding. A second bounded correction raises the phone disclosure's
stacking context above the toolbar, and the next browser check must actually
click Camera perspective and Reset view as well as Frame scene. No prior
receipt, finding or review count is replaced.

Attempt eight at `776bda873a039b97559f28f77e29a11bcd2c982b`, tree
`af8a8a42f60f1e92b968aaa35f8ecd7e19e1d121`, passes the actual camera, reset and
frame actions with cleanup PASS. The independent immutable review (`d89fab22`)
records `VERIFY_FINAL_EVIDENCE`, resolving `SC02-PHONE-01` within this finite
phone-control outcome. It also identifies nonblocking P3 `SC02-PHONE-02`: the
closed viewport summary paints over the active Library's heading/count. The next
bounded correction keeps viewport controls above their toolbar at z-index 3,
below the existing Library overlay at 12. It adds an actual Library-heading click
and a separate room-aware insertion/Undo/reload/no-fit browser journey. Those
new results remain unclaimed until captured. Attempts six and seven retain their
original `REPAIR_AND_RECAPTURE` dispositions; no counters or receipts are reset.

Attempt nine at `ddf6522965c228656e18e1d6912c70f652a4eb90`, tree
`1e3633a46746d343f54cd73c92dce9d439a7d1e0`, passes **2/2** production-browser
journeys (32.9 s), full build typing and cleanup. It verifies the Library heading
and phone camera controls, physical floor/table/wall insertion, canonical
Undo/Redo, unchanged Scene content after reload, and visible no-fit recovery with
unchanged stored content. Six PNGs, both full recordings and original receipts
are retained. Independent review (`7bfca772`) records `VERIFY_FINAL_EVIDENCE`,
resolving both phone findings. Nonblocking P3 `SC02-PLACEMENT-01` remains: the
default painting view shows its black reverse against a hidden cutaway wall,
without intelligible attachment/front-face proof. The four-wall source geometry
excludes a confirmed missing-support conclusion. The browser did not capture
the exact selected surface ID/pose; geometry tests and counts are separate proof.
This bounded result precedes SC-01/Inspector/publication integration and does not
qualify those later changes or physical device behavior.

## Current-room physical insertion

The bounded planner from `d489a649` is adopted as two additive files. Studio's
catalog insertion now plans physical models against the actual displayed
Environment, known supports, room bounds, exclusions, full model height and
occupied solids. A physical composition moves its parent with its physical child,
not its members independently. World placement is converted through the existing
root frame/anchor and installed by the existing single history operation. NO_FIT
leaves the draft unchanged and shows recovery; no model shrink or replacement
room is invented. Adaptive recipes and explicit showcase layouts keep their
existing paths. Unknown legacy geometry remains fail-closed until its exact
version projection is connected; multi-solid or offset physical assemblies and
open-articulation collision bounds require reviewed manual placement.

Independent source review found blocking `PX-SC02-INSERT-BOUNDS-01`: occupied
physical bounds omitted the renderer's editable width ratio. The repair multiplies
descriptor dimensions by entity width / descriptor width in addition to the
resolved world scale. Root and parented enlarged-model regression cases cover
the missed volume. The focused suite passes 167 checks in three files. The first
adapter run's one failure used an invalid 0.3 m room fixture, which hit the existing
minimum-dimension schema before placement; the valid 1.8 × 2 m no-fit fixture
passes without changing product validation. Both original and repaired logs are
retained. Independent source re-review resolves that bounds finding against
planner SHA256 `44a834c1642b8da07cdf803ed8de0b006a5018f78617ceb08f762bc0f0f7037c`
and test SHA256 `d8b8ce6903ce5354d9beee320f67cd85d6213e1deca085816eed52caed6e0d7f`.
Actual-browser insertion/Undo/save/reload proof remains separate; this paragraph
does not grant rendered or physical acceptance.

The owner held the iPhone upright and steady and saw no error after the second
corner set. Physical calibration remains failed/unqualified. Current providers
return no admitted detected planes. The existing synthetic corner tests do not
explain the physical failure, establish camera-pose accuracy, or justify retaining
corner rays across changed maps. No owner runtime is modified by this integration.

SC-01 Scene Manager/CAS integration, SC-00B Inspector integration, Community
composition provenance, combined mobile/rendered proof, Crossdeck design gates,
protected qualification and owner/device acceptance remain separate pending work.
No paid inference was run for this integration.

## Bounded immutable-release loading candidate

The root integration owns this shared service/API/host correction. SC-01 reviews
the consumer contract independently; SC-00C retains its Collection and paged-card
work. There is no product-main integration during the Crossdeck qualification
window. This section is engineering implementation evidence, not protected,
rendered, owner or device acceptance.

The measured 2,000-Scene fixture has five immutable releases per Scene. Compact
Library cards did not remove the full Studio initialization response: SC-00C's
source `2ecf9790f6eb422b383bfd876430a71ee882087f` records 23,990,373 bytes and
11,006 ms to the heading; an earlier source records the same bytes and 3,724 ms.
The timing variability is material. No numeric acceptance threshold is invented
from the brief, and a small page alone does not close whole-Studio scale.

The candidate initializes full version-zero working documents and an explicit
`INDEX_ONLY` release index. It does not construct partial `SpatialVersion`
objects. A parameterized, owner-scoped database projection extracts release
identity, semantic version, checksum, date, notes and reference metadata in pages
of 256. Complete release envelopes, entities, room geometry and animation content
are not selected by that projection. SQLite executes the actual JSON SQL in the
focused tests; both string-valued and object-valued JSON results are covered.
Live MySQL execution is not claimed. This introduces no schema, migration,
persisted cache or separate version authority.

Selecting the active definition hydrates its full snapshots through the existing
owner-scoped exact-item endpoint. Version preview/open and composition reuse use
that checked content. A changed revision, different identity or mismatched pin
fails visibly. Hydration merges immutable content into the prior working read
model; it does not install a server draft, advance editor CAS, reset history or
discard dirty edits. Generation and request guards reject stale host loads.
Attachment Undo checks indexed identity and checksum across definitions, rather
than treating unhydrated releases as absent. Scene Manager retains version counts
from the explicit index. Comparison reads one exact target instead of loading
the whole inventory. Canonical save, release, attach, archive, installed-content
permission and immutable integrity checks remain authoritative.

Historical usage still includes archived and active Scenes, current drafts and
every immutable release, asset instances, and Chronicle usage rows. The canonical
root Environment pin wins over an optional editor binding. Its timestamp is used
only when binding identity, version and checksum match. Counts deduplicate by
Scene identity, and released-only consumers survive removal of the working pin.
Environment discovery first identifies typed working Environments, then fetches
releases only for those IDs; it no longer decodes unrelated Scene releases. The
`ENVIRONMENT_CATALOG` refresh uses the same projected historical usage path.

The index is a read model, not proof that the full snapshot is valid. Exact
selection still validates the entire published capsule and checksum; a focused
regression deliberately changes a release body without recomputing its checksum
and verifies that opening it fails. Existing full-list server consumers retain
their checked default contract.

The initial focused run passes 58 checks; the next four-file run passes 37.
A broader run finds 89/90 passing: exact-item parity differs on the pre-existing
optional `readOnly: false` field. The root adopts the explicit boolean already
used by the full reader and SC-00C's newer candidate. The repaired seven-file
suite passes 90/90. TypeScript and changed-file ESLint pass. These are overlapping
local suites, not 185 independent acceptance cases. A further pin-completeness
guard rejects missing full snapshots; its two affected files pass 11 checks.
The first read-only service
probe on the retained synthetic 2,000-Scene database measures 23,990,029 bytes /
2,023 ms for full inventory and 7,764,029 bytes / 2,105 ms for the index before
removing duplicate legacy metadata. This is neither a browser timing nor evidence
of a latency improvement.
After removing duplicate legacy release metadata, the same read-only service
probe records 6,626,029 bytes / 2,170 ms for the index, versus 23,990,029 bytes /
1,983 ms for the full inventory. The [service observations](evidence/bootstrap-release-index-20261015/service-observations.json)
retain both probes and the measured service-file hashes. These unfrozen local
measurements support response-size comparison only; they are not browser
acceptance or a claim of faster service execution.

Working documents and release indexes still grow with inventory, and Environment
snapshots retain their existing full representation. Database-side JSON
extraction still reads historical metadata to preserve accurate use counts. A
fresh production-browser run must measure the same 2,000-Scene natural entry,
selected history/reuse, Manager counts, dirty/CAS recovery and pin behavior before
scale acceptance. No additional OpenAI calls or physical calibration claims are
made by this change.

Independent SC-01 review of frozen `61eb353f7` finds a blocking missed transition:
**Edit original asset** hydrates the previous active Scene before installing the
original definition, and the retry fallback can adopt a different first item.
Both paths now choose the destination before hydration. Two host regressions
exercise those transitions; the complete Studio host file passes 19/19. The
first two local attempts retain one passing retry and one failing test selector:
opening an original asset resets the Inspector destination, and its header is
installed asynchronously. The corrected test waits for that visible destination
and reopens Scene settings before selecting version history. A TypeScript pass
also rejected three Playwright-only `exact` options in the new React test; those
unsupported test options are removed. The
[development-check context](evidence/bootstrap-release-index-20261015/browser-attempt1-14db7ecf6a01/development-checks/context.json)
retains these four original pre-freeze logs separately from the frozen browser
receipt. No product guard is relaxed.

The scale test adopts SC-00C `2ecf9790`'s 1,000/2,000 fixture parameter and bounded
response measurement, then adds explicit zero-full-release-body/index checks,
one initial exact selection and a real historical-version click. Its canonical
generic isolation allowance requires the task-owned HTTP profile, exact source
prefix, strict validation database filename and an empty database. These are
planned assertions until the new frozen production run completes. The experience
planner at `61eb353f7` remains blocked by
`PRODUCT_EXPERIENCE_EXPERIENCE_DESIGN_REQUIRED:crossdeck.phase2.continuity`;
local browser support does not discharge that separate trusted gate.

The fresh source-bound production run at
`14db7ecf6a0135f00cc34c22b58798b45754d4e5` passes build/full TypeScript and
**1/1** Chromium scale journey (36.1 s). Its
[archived manifest](evidence/bootstrap-release-index-20261015/browser-attempt1-14db7ecf6a01/manifest.json)
binds the complete recording, four captures, measurements and original runtime
receipts. The 2,000-Scene bootstrap is 6,626,374 bytes, measured through a repeat
authenticated read; all 10,000 indexes and zero full release bodies are asserted.
Only the active definition is fetched initially, and its v1 control is selected
successfully. The heading appears in 5,149 ms, the 48-card page is 26,345 bytes,
distant-Scene search takes 962 ms, and Show more renders 96 cards. Keyboard detail
and 210/420 px panel resizing pass; a 390 px phone viewport has a 390 px document.
Timing is one local observation, not a general speed guarantee. This measured
heading lies between the earlier 3,724 and 11,006 ms observations.

The isolated worktree remains clean at the built source. Browser, proxy and
server cleanup pass with released ports; the server's escalated exit is recorded
as observed cleanup, not a successful application exit code. One earlier wrapper
launch stopped before fixture/build because its task-local log directory did not
exist; creating that directory fixes invocation only. The production build emits
16 broad-file-tracing warnings outside the changed loading paths, and runtime
reports socket listener warnings; neither is hidden or treated as a new pass.
No real photographs, OpenAI calls or shared owner database are used.

The [independent SC-01 source re-review](evidence/bootstrap-release-index-20261015/engineering-source-review.json)
accepts the repaired bounded loading consumer seam. Independent
[media review](evidence/bootstrap-release-index-20261015/browser-attempt1-14db7ecf6a01/independent-review.original.json)
records `VERIFY_FINAL_EVIDENCE` for this local bounded outcome, with all 17
dimensions and explicit limits. Review SHA256 is
`af99a516fc5a100fbeb51cd2661dc1a196e4bc7cf559545cb506e0cf67ba3e12`.
The reviewer inspected four current native captures, two references and the full
recording interval through timed samples before reading source. All nine original
artifact hashes and the manifest digest match. Heading visibility is not complete
Studio readiness; response bytes are not the initial wire/total transfer; the
distant Scene is searched, not opened; v1 is selected, not applied. The original
asset/retry transitions have host-test proof, and phone interaction/reduced-motion
behavior are not newly exercised by this run. The exact `14db7ecf6` planner still
records the separate Crossdeck design gate in its
[retained original log](evidence/bootstrap-release-index-20261015/browser-attempt1-14db7ecf6a01/experience-plan.original.log).
This root-only scale journey does not qualify the newer
Community/expanded-Library combined candidate, large complex Scenes, live MySQL,
protected integration, complete Studio acceptance or physical iPhone calibration.
