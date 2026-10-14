---
title: Independent AI model routing and Admiralty exception controls
audience: product-engineering
status: bounded-owner-presentation-accepted
canonical_for: parallax-ai-model-routing-overrides-20261014
last_reviewed: 2026-10-14
---

# Implemented behavior

The [user development overview](Spatial_Studio_User_Development_Overview.md) collects
current user workflows, exact prompt snapshots, model-choice numbers, measured
tokens/cost/time, geometry validation, surfaces and exclusions.

Room reconstruction uses its own global model, defaulting to GPT-6.1 Sol.
Standard Spatial Assistant requests retain Luna; advanced Assistant selection
remains a separate, individually authorized option. The existing quota admission
selects the model by operation category, reserves that model's actual configured
prices, rechecks access before dispatch and preserves original accounting.
There is no second inference service or direct browser credential access.

Global Policy exposes the three model selectors. Each existing People dossier
can override them independently or inherit global values. Model exceptions
cannot bypass the allowed-model list, user/global spending or concurrency
limits; expired exceptions inherit global values. Optional JSON policy fields
preserve older stored records without a database migration. Room inference uses
the advanced reasoning setting, and default-tier pricing stays unchanged.

User Overrides provides a paginated inventory with exact model/quota/access
values, the reason from the matching policy revision, expiry and active/expired
status. It filters models or quota/access exceptions. Review/reset opens the
existing user panel, whose Reset to global action retains canonical preview,
privileged assurance, explicit confirmation and audited revision. Reset removes
the current exception from the inventory; historical usage and audit survive.
No duplicate general person search is introduced. Inventory access requires
configuration and account observation, and mutation still requires operation
authority. Neither private prompts nor scenes enter that projection.

# Browser and owner review

Seven isolated unpaid development journeys pass at
`81fda26f29ea96e1149e5e2e1979b4ef274f6a3a`. The owner directly accepted that
[presentation](../../Testing/Product_Experience/evidence/parallax-ai-model-overrides-20261014/81fda26f29ea/review.html).
Its independent receipt, SHA256
`1ed10f583dec995c22cd993908fc117f647450649c657f2c355a18ce2404bc5a`, verified
model selectors, actual reasons and privileged reset but required additional
narrow inventory keyboard evidence. Its desktop-named model capture was actually
narrow, and two very short auxiliary videos were blank; these remain explicitly
non-evidence. The main recording establishes the tested chronology.

The [final continuation](../../Testing/Product_Experience/evidence/parallax-ai-model-overrides-20261014/9225698ef70e/review.html)
has seven passing journeys at `9225698ef70eb88d1886dd1fd01d626c65607ecd`, tree
`264d32d1d4fc9c893681b6361059d80cad4a2d0e`. It verifies ArrowRight scrolling of
the actual narrow exception inventory and Tab focus to the reset action, and
captures those exposed controls. The global-model desktop capture is restored
to 1440 pixels. Independent re-review has disposition VERIFY_FINAL_EVIDENCE,
SHA256 `f5d1ddc58ae1ed30df1e3a8c5579e2ee15eb07e63bd7255564dd0f4f411a12dd`.
It closes the narrow keyboard and desktop-width evidence gaps; blank auxiliary
recordings remain non-evidence. Earlier owner
acceptance remains a bounded presentation reference, not a new source claim.
There are 129 focused policy/ledger/geometry/route/UI tests at the frozen UI source.
A subsequent seventh photo component test advances its controlled clock past
two minutes and verifies continued cancellation without false failure or retry.
Type checking passes. Earlier failed selector evidence
is retained; the test now uses the actual accessible combobox name.

# Reconstruction and waiting time

Earlier browser Luna observations failed screen/whiteboard intersection and
room-bound checks. Validation remains enforced, and failed inference never
creates substitute geometry. The owner requested Sol specifically for photos.
The running isolated preview now has that separate model, a 180-second timeout,
an audited USD 0.40 total preview cap and USD 0.11 request reservation cap; prior
usage and unknown cancellation exposure remain intact. This local cap is inside
the remaining USD 5 task authorization, not a spending target.

A new one-call, two-original-photo Sol test at
`431542671ebd4022db7ade4500f53d21f32253bc` passes the entire browser workflow:
private imports, real inference, 3D proposal, constructed-solid checks, Apply,
save/reload, relative scale/Undo and withdrawal of both photo grants. It settles
USD 0.0638935, with 9,906 input and 3,913 output tokens. Preparation/admission
take 44 ms, exact input counting 1,907 ms, provider response 67,898 ms and
validation 89 ms; total inference handling is 69,964 ms. The preceding interactive
Sol result took 69.288 seconds; its preparation-to-dispatch took 1.378 seconds.
The waiting time is principally generation, not uploading or a frozen timer.

The room request now asks for short discriminating evidence and uses low text
verbosity, while preserving required features/relationships and strict schema
validation. [Official API guidance](https://developers.openai.com/api/docs/guides/deployment-checklist)
describes lower verbosity as a way to reduce generated output. This one run
uses fewer output tokens than the earlier 4,743-token result but does not prove
a repeatable latency improvement over the contemporary 69-second result. No
premium service tier, Astra call or automatic retry was introduced.

The accepted thinking animation is preserved. The
[photo continuation](../../Testing/Product_Experience/evidence/parallax-photo-popup-20261014/9225698ef70e/review.html)
shows About 1–2 minutes and a live elapsed timer immediately. It is a waiting
estimate based on bounded local tests, not a countdown, guarantee or fictional
progress percentage. After two minutes it says the request is taking longer.
The timer uses non-announcing ARIA settings; actual screen-reader speech has not
been observed. The photo continuation's independent review has disposition
VERIFY_FINAL_EVIDENCE, SHA256
`55c6ee6085826ba439ecea92966ec468b640b3bcca9a0df7a62fa31c7ed108d9`.
Its captures observe immediate and twenty-second timing, not a real two-minute
wait. The longer-wait boundary is separately unit-tested with a controlled clock.
Phone light,
desktop dark, reduced motion, cancellation and visible recovery remain tested.

The cabinet issue was an observation convention gap: prior requests described
table axes and chair fronts but did not require a cabinet's front direction.
The new generic observation records door/handle/open-shelf-facing evidence for
cabinets, wardrobes and shelves. The mapper rejects confident contradictory
numeric headings and marks missing/ambiguous evidence uncertain; it does not
rotate furnishings based on their closest wall. In the fresh call, the cabinet
is generated against the return wall facing into the room, without a one-off
coordinate edit. The right table heading still differs between independent
runs, despite internally coherent edge evidence. Construction validity does
not close that fidelity/repeatability issue or establish physical accuracy.

Owner photos, derived geometry, observations and recordings remain private in
ignored task artifacts; only synthetic UI captures and safe accounting summaries
are committed. The [accounting snapshot](evidence/openai-model-routing-latency-spend-20261014.json)
retains unknown usage and the task ceiling. Complete Studio qualification,
Crossdeck experience integration and real Safari/physical acceptance remain open.
