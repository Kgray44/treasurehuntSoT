---
title: Fresh two-photo room reconstruction check
audience: product-engineering
status: bounded-layout-verification
canonical_for: parallax-fresh-two-photo-check-20261014
last_reviewed: 2026-10-14
---

# Actual inference and rendering

At the owner's request, one fresh real Sol-low request processed the same two
owner-supplied room photographs. Source is
`3767e490818a81eae0c6ff9be2bfc2f776fcba34`. The guarded run allowed one generation
request with a USD 0.15 ceiling, default service tier, no tools, no stored OpenAI
response and no automatic retry or Astra escalation. The initial selector matched
no test and made no call; that failed attempt remains preserved at 55f22c4f.

The real request returned PROPOSED. The app rendered it, applied it through
ordinary persistence, displayed plan/front views and reloaded the saved room.
The original proposal equals the saved initial room. Construction validation
reports no findings across 139 inspected modeled parts. All three table and
four chair renderer X/Z extents match the canonical geometry within 0.001 m.
Optional relative-scale editing and Undo also executed without another inference.

The whole live browser test is **FAIL**, not PASS: its final withdrawal check
failed because the permission disclosure was unmounted during a request and
remounted closed. The subsequent UI correction preserves the disclosure across
updates. Its lifecycle test and synthetic browser continuation pass separately.
This does not retroactively change the paid run's receipt or prove completed
withdrawal for its remaining owner-photo grant.

# Photo correspondence and limits

A separate independent private comparison inspected both original photos,
rendered views, recording and saved geometry before model observations/source.
Its immutable SHA256 is
`90c0a45581df7b7e16151746bb0092a2afcfaed6e5d305276b65623bf8fa1366`.
Original photos, observations, exact derived geometry and that detailed review
remain in ignored private artifacts.

The specific earlier right-table axis discrepancy resolves in this sample: its
axis now follows the owner's requested quarter-turn relation to the teaching
wall. Identifiable center/left behind-table seating and right far/near seating
correspond more closely to the photos. The open doorway, ceiling-mounted
projector, layered board/screen, cabinet and wall-mounted panels are represented.
The renderer propagates the returned geometry; this improvement did not come
from a room-specific coordinate patch. A bounded 0.100 m right-rear chair fit is
disclosed first in the returned warning list; it is a separate software fit.

This is a simplified authoring aid. Only four chairs are reconstructed;
additional cropped seating remains omitted or uncertain. Generic four-leg
chairs, repeated equipment primitives and a tan cabinet do not establish full
office-chair/rack geometry, color fidelity, chair count or tuck fidelity. The
center-table width estimate is about 8.6% smaller than the owner's earlier
7 ft reference, which was not supplied as an input. Scale remains estimated.
No new one-photo comparison closes earlier cross-run agreement findings.
No physical survey accuracy, browser world tracking or owner room acceptance
is claimed. The independent disposition is VERIFY_FINAL_EVIDENCE only for
this bounded major-layout correspondence and renderer propagation.

The isolated photo test selected Sol explicitly. At this source the running
owner's standard Assistant/photo policy was Luna. The owner subsequently
requested separate Sol photo and Luna Assistant routing. The newer
[model routing increment](AI_Model_Routing_and_Overrides_20261014.md) records that
change; this earlier comparison does not establish equivalent Luna quality.

The owner subsequently observed that this sample's rear cabinet was backed
onto the wrong wall and turned a quarter rotation. Earlier bounded layout
review does not establish its correct facing. The next observation contract
adds generic front-face evidence for cabinets, wardrobes and shelves rather
than applying a room-specific coordinate correction. Room layout reliability
remains separate from construction validity.

# Accounting

The single generation request settled USD 0.071196, with 9,507 input tokens and
4,743 output tokens. No new paid request was made to repair the later disclosure
failure. A fresh read-only aggregate of the owned interactive preview includes
27 consuming requests, USD 0.016047885 settled and USD 0.019547885 exposure,
including its retained timeout reservation. Combined with earlier retained task
reports and unknown reservations, the conservative task exposure is USD
3.838100280, leaving USD 1.161899720 under the owner's USD 5 ceiling. The
[safe reconciliation](evidence/openai-fresh-two-photo-spend-20261014.json)
preserves these boundaries. Unrelated projects and global OpenAI account use
are not audited by this task-scoped accounting.
