---
title: Parallax 776 bounded software scope and pending coverage
audience: product-engineering
status: pending-qualification
canonical_for: parallax-776-bounded-software-acceptance
last_reviewed: 2026-10-24
---

# Bounded software scope and pending coverage

The owner authorized this bounded #776 software-delivery scope on October 24, 2026. Authorization fixes the intended scope; fresh source-bound capture,
protected qualification and independent product acceptance remain pending.
This record does not claim complete Parallax, live-provider, native AR or physical
hardware acceptance. The earlier mainline qualification remains historical.

The source boundary for this change is `2c9865d8adc5fd81a8d3197af2a5fc2a71c4520b`.
The authorized scope proposal is `dd01cd8fd78b815e5b68694cec5fdda5c6d76449b5dc4051ba7e8aae8dc32631`.
Existing source, dedicated tests, development runners and their assertions remain
available. The 48 states listed below are explicitly pending acceptance; removing
them from this bounded production contract does not establish their correctness
or remove their implementation.

## Current production contract scope

| Contract                                              | Required declared states for this delivery                                                           | Pending expansion       |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------- |
| `parallax.authored-library-and-simulation.experience` | `LIBRARY_READY`, `ASSET_SAVED`, `INSTANCE_SAVED`, `SIMULATION_READY`, `SIMULATION_RESET`, `RETURNED` | 39 states listed below  |
| `parallax.protected-photo-room.experience`            | `PHOTO_UNAVAILABLE`, `RETURNED`                                                                      | 9 states listed below   |
| `parallax.spatial-community-publishing.experience`    | All 10 current states, including `PROFILE_REQUIRED` and `PROFILE_READY`                              | No reduction authorized |

The first two state sets have source-bound screenshots in retained capture
`40132865908`; that capture does not qualify the later corrected source. Existing
registered journeys, causal actions, assertions, accessibility requirements,
recordings and return obligations are unchanged. The current 118-context matrix
(112 generic plus six paired contexts) remains required. Only
`tests/e2e/parallax-room-photo.spec.ts` is removed from the new photo production
contract's ordinary `browserTests` declaration; its source, assertions and
synthetic-development runner are retained. This changes the unique ordinary
browser-file declarations from 52 to 51, without removing a generic or paired
context.

## Authored Library and simulation: 39 pending states

- `ASSISTANT_PROPOSAL`
- `ASSISTANT_CLARIFICATION`
- `ASSISTANT_CANCELLED`
- `ASSISTANT_UNAVAILABLE`
- `PREFERENCE_CONTINUITY`
- `OPACITY_PREVIEW`
- `TRANSPARENT_RECOVERY`
- `NATIVE_OPACITY_UNSUPPORTED`
- `CINEMATIC_TAKE`
- `TIMELINE_POSE_SELECTED`
- `ROOM_EDITOR_OPEN`
- `GROUPS_EMPTY`
- `GROUP_MEMBERS_SELECTED`
- `GROUP_NAMED`
- `GROUP_LIVE_TRANSFORM`
- `GROUP_CANCELLED`
- `GROUP_LOCKED`
- `GROUP_MEMBERS_EDITED`
- `GROUP_RELOADED`
- `ASSISTANT_GROUP_PROPOSAL`
- `EXCLUSIONS_DISCOVERED`
- `EXCLUSION_LIVE_EDIT`
- `EXCLUSION_RELOADED`
- `EXCLUSION_DELETED`
- `EXCLUSION_EDITING_FINISHED`
- `INDIVIDUAL_GROUP_MEMBER`
- `GRAPH_ORDER_PREVIEW`
- `GROUP_SURFACE_PLACEMENT`
- `ASSISTANT_THINKING`
- `ASSISTANT_CLARIFICATION_CHAT`
- `WORKING_IDENTITY_STABLE`
- `EXPLICIT_LIBRARY_MEMBERSHIP`
- `NAMED_SAVE_AS`
- `INDEPENDENT_ENVIRONMENT_DEFINITION`
- `LIBRARY_COLLECTION_FILTER`
- `IMMUTABLE_VERSION_PREVIEW`
- `PENDING_WORK_RECOVERY`
- `STALE_ENVIRONMENT_RECOVERY`
- `VERSION_COPY_RETRY_INTENT`

These expanded Assistant, opacity, animation, grouping, exclusion, placement and
Library recovery outcomes require their own genuine causal browser evidence.
For example, `GROUP_LIVE_TRANSFORM` needs evidence during the live pointer
interaction, not a relabeled committed frame. `NATIVE_OPACITY_UNSUPPORTED` does
not gain native-device evidence from a software screenshot. Existing dedicated
browser tests are retained; a passing generic journey is not acceptance of this
pending expansion.

## Photo reconstruction: nine pending states

- `PHOTO_READY`
- `PHOTO_PERMISSION`
- `PHOTO_PROCESSING`
- `PHOTO_PROPOSED`
- `PHOTO_CLARIFICATION`
- `PHOTO_FAILED`
- `PHOTO_CANCELLED`
- `ROOM_SAVED`
- `PHOTO_WITHDRAWN`

The bounded production journey proves unavailable-provider/manual-edit recovery
and return. The dedicated photo test requires the explicit
`SYNTHETIC_DEVELOPMENT` runtime and a task-owned development fixture. Its upload
and provider outcomes must not be represented by unavailable-production frames.
The existing test source does not by itself supply all nine pending states.

## Community Profile recovery remains required

`PROFILE_REQUIRED` and `PROFILE_READY` remain mandatory for both DESKTOP and
MOBILE. The current generic capture omitted these four device/state frames; they
must be collected through the real prerequisite and recovery path before this
contract can be accepted. No frame may be copied, aliased or relabeled from
another contract or state.

The existing normal UI case is
`a Creator without a public Profile gets a direct setup route and returns to the saved source`
in `tests/e2e/parallax-spatial-community.spec.ts`. Its ordinary selector is:

```powershell
node node_modules/playwright/cli.js test tests/e2e/parallax-spatial-community.spec.ts --grep "^a Creator without a public Profile gets a direct setup route and returns to the saved source$"
```

This is a pending execution route, not a recorded result. Use the supported
owned-fixture/runtime and protected evidence route. The case saves an Asset and
Library membership for a synthetic Creator without a public Profile, opens that
same saved definition, and selects `Publish to Community…`. In the
`Publish to Community` dialog, verify the public-Profile prerequisite and disabled
`Continue`; collect `PROFILE_REQUIRED` on both devices. Follow the visible
`Set up public Profile` link, fill the Handle field, select `Public` in
`Default visibility`, and select `Save Profile`. Verify return to the exact same
saved definition, reopen its publishing dialog, and verify the warning is absent
and `Continue` enabled; collect `PROFILE_READY` on both devices. The source stays
saved and this recovery does not publish a listing.

The existing case records the required state on both devices but the ready state
on desktop only. An additional real mobile-ready frame and correct source-bound
contract metadata are still required. If a shared generic Creator already has a
Profile, use ordinary Profile UI to establish the prerequisite and restore the
owned Handle/Public setting per context; do not rotate accounts, call hidden
setup endpoints, skip the prerequisite or claim an already-true recovery.

## Qualification boundary

The retained all-context semantic result is not full state-coverage acceptance.
Before delivery, regenerate the source-bound plan, collect the remaining
Community Profile evidence, complete required accessibility and ordinary
qualification checks, and review the exact resulting tuple. Preserve previous
failed and incomplete receipts. Generated documentation/catalog changes must be
reviewed through the normal docs and feature governance commands.
