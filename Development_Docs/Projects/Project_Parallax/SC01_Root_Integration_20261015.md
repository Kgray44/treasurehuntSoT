---
title: Scene Manager and exact Environment integration checkpoint
audience: engineering
status: in-progress
canonical_for: parallax-sc01-root-integration-20261015
last_reviewed: 2026-10-15
---

# Scope and source

This engineering evidence records the additive integration of SC-01 source
`c361d60c20333099359a2540b380dc36b4dfba28`, tree
`bb6807bbdcd8be8fe4e4b7cf3b957f790db6d382`, into PR #722 after root
`ddf6522965c228656e18e1d6912c70f652a4eb90`. The common ancestor is `e073eaa2`.
The merge preserves current Scene Graph/groups, continuous surfaces, timelines,
Assistant, unified Library, typed elements, room-aware insertion and phone controls.
SC-01's original PR #727 source, reviews and captures remain separate evidence;
they do not qualify this combined candidate.

The handoff mounts Scene Manager through canonical Scene history/save/CAS, retains
the independent rich Environment workspace, adds typed mutable legacy working
documents separate from positive immutable releases, and preserves base lighting
before Scene overrides. It includes the bounded SC-00C working projections and
actions. Its new browser journeys and experience contract are retained. Existing
493 contract objects remain structurally unchanged in the source handoff.

# Exact legacy preview

The root adapter resolves all fields of the Scene's immutable Environment pin
against the loaded catalog. Missing or mismatched versions show a visible recovery
state; they do not produce a Bedroom replacement. Selecting another preview is
explicit and the pinned Environment remains selectable. Scene installation selects
its actual bound Environment immediately.

Legacy fixture boxes render with their original identities, dimensions, positions
and colors. An empty fixture list stays empty. No rich features, room shell,
furniture or private image evidence are invented. Semantic candidates are copied
from that exact version, including their normal-derived rotations. The Canvas,
fixed entity frames and physical-insertion planner consume that same projection.
The current rich room format and its constructed surfaces keep their existing path.
Scene lighting overrides apply after the Environment's base lighting.

Room-aware Assistant preparation currently refuses a legacy-only pin with an
explicit explanation and unchanged Scene. It must not pin an unrelated rich room
under an existing immutable legacy reference. Full Assistant manipulation of
legacy fixtures remains a limitation, not an accepted capability.

SC-01 separately owns the impact-review correction to use target-version poses
and verify retained surface-frame dependencies before accepting an Environment
update. Its exact two-file follow-up `6a476d05` is adopted after the merge.
Generic default-room impact calculations cannot establish target-version usability.
The first combined run reports four failures because the stricter root resolver
correctly rejects missing/unsafe/incompatible retained supports before impact
review can return its existing INVALID findings. The adapter now preserves those
findings, or adds the actual resolver error, and omits unresolved bounds rather
than inventing a pose. The unchanged safety criteria still force INVALID. The
rerun passes 29 checks across three files; original failure and rerun logs remain
in the evidence folder. This correction does not change canonical save or CAS.

# Development verification and limits

The first root projection/domain suite passes **130 checks across seven files**.
The root host/API/working-document/Scene Manager suite passes **130 checks across
thirteen files**, including the Canvas's exact fixture/candidate projection and
existing Assistant, graph, history and autosave regressions. Raw logs are retained
under `evidence/sc01/root-integration-20261015/`. Typing, independent source review,
combined actual-browser journeys and final evidence review remain separate gates.

Independent source review identified `PX-LEGACY-PREVIEW-01` (a broad preview
override hid rich-room Assistant proposal geometry) and `PX-LEGACY-FRAME-01`
(legacy wall IDs or missing retained supports could take a synthetic/cached frame).
The override is now restricted to the typed legacy projection; a changed rich
proposal drives its own room geometry. Initial frames use actual safe candidates
and normals; missing or incompatible legacy supports fail explicitly, with the
host showing recovery before mounting the Canvas. The first correction suite
passes 135 checks/eight files; the retained-support follow-up passes 34 checks
in three files. Original and partial review findings remain historical; final
source re-review is separate from rendered acceptance.

The final bounded source re-review resolves both findings. Reviewed authoring
SHA256 is `1102162dba51f1aa720a79743e2038976b9615647ecffda7c76d5ca109e68d01`;
legacy preview tests are
`2c9a49cbb78f55adc7afd34bfab57a7795b83d8f1978690c1a474241c10e9837`.
Reviewers inspected logs and source without running tests or changing the product.
Documentation index generation uses an ignored process-local Node preload solely
to raise the read-only Git `ls-files` stdout buffer to 16 MiB: this tree's tracked
path inventory exceeds the tool's default 1 MiB limit. No tracked tool or validator
is weakened. Documentation and Feature Catalog validation pass.

SC-02's earlier two-journey production-browser PASS at `ddf65229` precedes this
merge. It does not qualify the Scene Manager, exact Environment rendering or
subsequent Inspector and publication changes. The Library's measured large-catalog
payload problem remains assigned to SC-00C; slicing rendered cards is insufficient.

The owner's physical iPhone alignment failed with the phone upright and no visible
error. That failure remains unresolved. This Studio integration makes no physical
tracking, reconstruction-fidelity, audible-audio, owner or protected acceptance
claim and runs no paid inference.

## Combined contextual Inspector checkpoint

The root selectively integrates SC-00B's product commits `cae6de74` and `166e0ffe`
after `81e78b5f`, retaining the exact legacy projection/error guard and rich-room
Assistant preview. Inspector transform previews are added to the existing Canvas
input precedence and remain outside history until committed. Scene Manager,
room-aware insertion and phone layering remain on their current root paths.
SC-01's one-line discriminated Anchor guard `c4d65860` is also adopted; it changes
typing rather than the support-selection behavior.

The combined product passes full TypeScript, changed-source lint, 32 host/element/
legacy checks in four files, and 59 impact/insertion checks in three files.
These are separate suites rather than a sum of all historical reruns. Independent
technical review found `PX-SC00B-NUMERIC-01`: the numeric Particle count could
display a fractional value rejected by the typed integer schema. The bounded
correction rounds numeric commits to the declared increment within their bounds;
the new regression checks both valid typed output and displayed numeric/slider
values. Its first run had a wrong test-fixture enum and failed before reaching the
control; the corrected fixture passes two checks. Both logs are retained.
Independent source re-review resolves that finding against controls SHA256
`0a8e402c42bc8657e61d16c015b8be67c0f396569b23155ed52175041d5e3723`
and tests `2ee22d50485bda61d287b4814b9f7f3d814008fd2dd7f751ad4733dc3ca1cf42`.
It ran no tests or runtime and grants no rendered acceptance.

The two-journey SC-00B browser spec is copied from owner candidate `e733a99a` and
updated to find the actual Scene Manager context. Fresh root browser evidence and
independent experience review are still required. The earlier standalone and
combined owner captures retain their original source identities and do not
qualify this later root integration.

The first root Inspector production run passes **two journeys in 25.6 seconds**
at `d946541f2b29a9f83e38262fe75bc9773f66bb96`, tree
`bee41e32e194bbb19a39be0b544b01bb901fdf69`. It retains 34 stills, all three
recordings, original run/build/runtime receipts and observations under
[`inspector-browser-attempt1`](evidence/sc01/root-integration-20261015/inspector-browser-attempt1/packet.json).
The build includes TypeScript; owned cleanup passes. One journey covers eleven
selection contexts at three depths plus the phone layout; the other exercises
light edit/Undo/Redo/mode travel/saved reload and room-feature rename/reload.
Independent supporting media review gives `VERIFY_FINAL_EVIDENCE` within that
finite local scope. Its original report is retained with SHA256
`487e7db659f02ea10b14fd57f1394737575770374e04b05a64edae86153bcf7a`.
It inspects all 34 stills and all three recording spans; the first recording
contains only three blank frames and is not presented as interaction proof.
Two nonblocking hierarchy findings remain historical: Scene settings retained
the selected group's hero identity, and room-wide controls preceded the selected
feature's fields. The bounded root correction makes the hero identify the Scene
while editing Scene settings and collapses room-wide tools when a particular
feature is selected. Nineteen focused checks across two files pass after that
correction; new browser assertions require the selected name field in the actual
viewport and the Scene hero to identify the correct Scene.

The forthcoming root recapture also adopts the owner's additional scale-preview,
effect/depth/light-theme/keyboard and removed/mixed-selection journeys from
`f1e69e17`, with added fractional particle-count persistence and phone title edit/
scroll/Canvas return checks. These retain all five journeys' earlier source-bound
history. The old source's overwritten failed-selector media remains an explicitly
reported evidence gap, never a fabricated preserved recording. No new trusted
review budget or protected report is created by this supporting work. Later
additive Library API work is outside the first browser source and receives no
inherited browser claim.

The next actual production run passes **all seven journeys** at
`66699086cbcc86616679b039f33680c6d05588df`, tree
`7c4041543cb3dff4cd11555684e4367bf69b5e69`, with 70,392 ms of browser execution
and successful owned cleanup. Its [original packet](evidence/sc01/root-integration-20261015/studio-browser-attempt2/packet.json)
retains 54 Inspector stills, the separate SC-02 captures and every recording.
The stronger assertions exercise phone field editing and Canvas return, fractional
particle-count persistence, live scale preview before one history commit, effect
controls/light theme/keyboard, selection recovery, composition reuse/playback and
room-aware insertion/no-fit recovery. Supporting independent review is pending;
actual iPhone camera/alignment, audible audio, paged Library and protected/owner
acceptance remain outside this source-bound result.

Task-owned evidence was moved to D-backed storage with every file digest verified
unchanged. A subsequent Git content refresh exposed four pre-existing LF-index /
CRLF-working-cache log variants. Original indexed paths retain their exact Git
bytes; the cache variants and both hashes are preserved separately under
`working-cache-line-ending-variants/`. They are not new test results.
