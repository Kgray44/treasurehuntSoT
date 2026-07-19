# KG Original Animation Audit Reconciliation Source

## Purpose

This document preserves the **238 distinct animation additions** from the original external animation audit so they can be reconciled one-by-one against:

- `Development_Docs/Animation_System_Full_Audit.md`
- `Development_Docs/Animation_System_Audit_Matrix.csv`
- `Development_Docs/Animation_System_Implementation_Roadmap.md`
- `Development_Docs/Animation_System_Test_Plan.md`

The current Codex audit contains 139 `missing_animation` rows. Those rows often consolidate several ideas. Consolidation is acceptable for architecture, but **none of the 238 source ideas may be silently lost**.

For every item below, the reconciliation must assign:

- a unique source ID (`OA-001` through `OA-238`);
- the matching current matrix row or rows;
- coverage status: `exact`, `combined`, `partial`, `missing`, `rejected`, or `superseded`;
- the exact implementation phase;
- acceptance criteria;
- correct animation library;
- replay policy;
- reduced-motion behavior;
- test-plan references;
- and a rationale for any rejection or supersession.

---

# Original 238 Animation Additions

## Landing and role gateway

### OA-001
Star-field twinkle with randomized restrained timing.

### OA-002
Moon glow breathing.

### OA-003
Distant ship parallax.

### OA-004
Fog depth separation.

### OA-005
Dock foreground parallax on pointer movement.

### OA-006
Role-object hover states unique to each role.

### OA-007
Player journal clasp twitch.

### OA-008
Captain wheel slight bearing correction.

### OA-009
Creator quill ink pulse.

### OA-010
Shared-layout transition from selected role object into its sign-in page.

### OA-011
Status-loading reveal when session information arrives.

### OA-012
“Session remembered” badge animation.

### OA-013
Responsive transition from three cards to mobile stacked objects.

### OA-014
Short reentry animation when returning from a role.

### OA-015
Theme/color-scheme transition shared across the entire shell.

## Player sign-in

### OA-016
Account form entrance.

### OA-017
Invitation-code panel entrance.

### OA-018
Animated switching between sign-in modes.

### OA-019
Seal or compass response while submitting.

### OA-020
Incorrect-password response without page shake abuse.

### OA-021
Invitation-code scanning or ink-search motion.

### OA-022
Success transition into Player Library.

### OA-023
Persistent account continuation reveal.

### OA-024
Rate-limit cooldown indicator.

### OA-025
Offline-state entrance and recovery.

## Captain and Creator sign-in

### OA-026
Captain key-turn sequence.

### OA-027
Creator quill authorization sequence.

### OA-028
Permission mismatch transition to correct role options.

### OA-029
Chart-room light reveal.

### OA-030
Drafting-table light reveal.

### OA-031
Secure lock idle behavior.

### OA-032
Authentication failure recovery.

### OA-033
Role-specific page transition after success.

## Invitation ceremony

### OA-034
Envelope or folded-sheet entrance.

### OA-035
Name handwriting.

### OA-036
Cover image mask reveal.

### OA-037
Expiration ink clock or subtle seal cooling.

### OA-038
PIN field unlock state.

### OA-039
Accept seal fracture.

### OA-040
Ribbon release.

### OA-041
Voyage title emergence.

### OA-042
Decline refold.

### OA-043
Revoked invitation lock state.

### OA-044
Expired invitation weathering.

### OA-045
Route transition into waiting room.

### OA-046
QR or code reveal animation on Captain side.

### OA-047
Invitation replacement crossfade with explicit old/new status.

## Player Library

### OA-048
Library shelf entrance.

### OA-049
Cards staggered by group.

### OA-050
Gallery/list shared-layout transition.

### OA-051
Search filtering with presence animation.

### OA-052
Group collapse/expand.

### OA-053
Pin-to-top FLIP movement.

### OA-054
Hide-to-archive motion.

### OA-055
New invitation wax badge.

### OA-056
Waiting Captain lantern pulse.

### OA-057
In-progress journal breathing.

### OA-058
Completed volume closing and archival ribbon.

### OA-059
New-edition badge change.

### OA-060
Server-confirmed indicator update.

### OA-061
Empty-state illustration animation.

### OA-062
Card-to-waiting-room shared transition.

### OA-063
Card-to-journal shared transition.

## Waiting room

### OA-064
Closed journal breathing should respond to connection state.

### OA-065
Crew member arrival animation.

### OA-066
Crew readiness stamp.

### OA-067
Live-to-polling signal transition.

### OA-068
Scheduled countdown behavior.

### OA-069
Captain launch event.

### OA-070
Journal latch release.

### OA-071
Full transition into the Player journal.

### OA-072
Revoked-access seal closure.

### OA-073
Reconnect success recovery.

### OA-074
Background ocean or cabin ambience.

### OA-075
Planned-start arrival emphasis.

## Journal introduction

### OA-076
Better continuity from atmospheric prelude to physical book.

### OA-077
Camera move toward closed book.

### OA-078
Shadow grounding before latch movement.

### OA-079
Real Rive clasp response.

### OA-080
Cover weight and secondary bounce.

### OA-081
Page-stack compression as cover opens.

### OA-082
Seal pressure before fracture.

### OA-083
Wax fragment depth and landing.

### OA-084
Open-page handoff that visually matches the StPageFlip geometry.

### OA-085
Book-settle secondary motion.

### OA-086
Interface controls arriving as physical desk objects.

### OA-087
Objective note sliding from beneath the journal.

### OA-088
Short resume opening distinct from full replay.

### OA-089
Completed-archive opening.

### OA-090
Interrupted-opening recovery.

## Journal pages

### OA-091
Page-edge hover lift.

### OA-092
Drag-intent affordance.

### OA-093
Page-turn midpoint shadow.

### OA-094
Chapter-tab-to-page travel.

### OA-095
Queued-turn indicator.

### OA-096
New chapter divider ribbon.

### OA-097
Handwritten annotation animation.

### OA-098
Illustration reveal on entering a page.

### OA-099
Page bookmark movement.

### OA-100
Current objective highlight.

### OA-101
Hint reveal foldout.

### OA-102
Read/unread ink mark.

### OA-103
Completed chapter stamp.

### OA-104
Historical edition watermark entrance.

### OA-105
Safe locked-page shimmer without implying hidden text.

## Chapter release

### OA-106
Global ceremony host.

### OA-107
Player-section-aware transition.

### OA-108
Seal pressure build.

### OA-109
Fracture with synchronized audio.

### OA-110
Parchment unfolding.

### OA-111
Chapter heading writing.

### OA-112
Prose ink progression.

### OA-113
Objective card placement.

### OA-114
Riddle line reveal.

### OA-115
Quill-followed handwriting.

### OA-116
Map inset reveal.

### OA-117
“Open chapter” action transition.

### OA-118
Restore previous section.

### OA-119
Replay from history.

### OA-120
Gentle-mode shortened composition rather than uniform speed multiplication.

### OA-121
Reduced-mode semantic staged reveal.

## Voyage Chart

### OA-122
Map parchment unfolding when section opens.

### OA-123
Compass bearing response.

### OA-124
Smooth zoom centered around focus.

### OA-125
Drag/pan inertia.

### OA-126
Fog mask genuinely revealing only new territory.

### OA-127
Single new-marker stamp.

### OA-128
Route scratch drawing only for the new route.

### OA-129
Ship token movement for actual progress.

### OA-130
Region label emergence.

### OA-131
Coordinate-hover or focus response.

### OA-132
Reset-chart return animation.

### OA-133
New-location pulse that settles.

### OA-134
Route selection emphasis.

### OA-135
Accessible reduced-mode route highlight.

### OA-136
Current position wake trail.

## Treasure Altar

### OA-137
Cabinet curtains opening.

### OA-138
Empty mounts waking when new state arrives.

### OA-139
Silhouette reveal.

### OA-140
Awarded artifact pedestal entrance.

### OA-141
Light sweep.

### OA-142
Shared-layout move from event overlay into real slot.

### OA-143
Connection thread drawn only between changed artifacts.

### OA-144
Artifact hover tilt.

### OA-145
Inspection shared-element transition.

### OA-146
Engraving light reveal after inspection settles.

### OA-147
Return-to-slot transition.

### OA-148
Completed assembly alignment.

### OA-149
Subtle brass mount response.

### OA-150
New-item badge removal once inspected.

## Side Quest Ledger

### OA-151
Ledger cover opening.

### OA-152
Filter tabs as physical divider movement.

### OA-153
Rumor note sliding from envelope.

### OA-154
Pin insertion.

### OA-155
Red-thread drawing.

### OA-156
Objective checkbox ink.

### OA-157
Partial-completion state.

### OA-158
Completion stamp.

### OA-159
Reward pocket opening.

### OA-160
Completed note repositioning.

### OA-161
Page preservation when filters change.

### OA-162
No full PageFlip teardown for every filter.

## Ship’s Log

### OA-163
Fresh line writing.

### OA-164
Date stamp.

### OA-165
Symbol seal.

### OA-166
New day divider entry.

### OA-167
Filter transition without transform conflicts.

### OA-168
Unseen-to-seen ink change.

### OA-169
Route-back button emphasis.

### OA-170
Offline event entry.

### OA-171
Captain annotation handwriting.

### OA-172
Event importance treatment.

### OA-173
Moon-phase change.

### OA-174
Log-page turn when history becomes long.

## Finale

### OA-175
Real Rive mechanism.

### OA-176
Dormant idle.

### OA-177
Tease wake-up.

### OA-178
Outer and inner ring inertia.

### OA-179
Individual requirement socket illumination.

### OA-180
Requirement progress transfer from event overlay to permanent socket.

### OA-181
Ready state.

### OA-182
Unlock sequence.

### OA-183
Final seal fracture.

### OA-184
Chamber light expansion.

### OA-185
Finale completion.

### OA-186
Replay-safe historical pose.

### OA-187
Reduced-motion static state progression.

### OA-188
Sound-reactive mechanical accents without making audio mandatory.

## Captain Library

### OA-189
Tab shared-layout indicator.

### OA-190
Voyage cards arriving and changing groups.

### OA-191
Needs Attention pulse.

### OA-192
Ready-to-launch state.

### OA-193
Launch confirmation ceremony.

### OA-194
Invitation status transitions.

### OA-195
Replacement invitation handoff.

### OA-196
Revocation close animation.

### OA-197
Published-version card updates.

### OA-198
New Voyage wizard entrance.

### OA-199
Wizard step transitions.

### OA-200
Progress path movement.

### OA-201
Player-row addition/removal.

### OA-202
Review page assembly.

### OA-203
Created invitation QR reveal.

### OA-204
Copy confirmation.

### OA-205
Schedule-state transition.

### OA-206
Poll updates without entire-list snapping.

## Quartermaster live control

### OA-207
Command confirmation morph into cinematic overlay.

### OA-208
Command-specific preflight state.

### OA-209
Real server-wait idle per action.

### OA-210
Failure reversal unique to each command.

### OA-211
Success overlay-to-dashboard reconciliation.

### OA-212
Event row insertion.

### OA-213
Campaign sequence gauge movement.

### OA-214
Player connection lamp transition.

### OA-215
Undo visualization using actual previous-state objects.

### OA-216
Pause ambience affecting the entire Player scene.

### OA-217
Resume restoration.

### OA-218
Map command should animate only the changed route/marker.

### OA-219
Artifact command should use unique source/destination handles.

### OA-220
Action queue or conflict indication.

## Studio

### OA-221
Library card layout transitions.

### OA-222
Editor route transitions.

### OA-223
Block drag placeholder motion.

### OA-224
Drag overlay with physical paper weight.

### OA-225
Inspector opening.

### OA-226
Validation error highlighting.

### OA-227
Autosave confirmation.

### OA-228
Version creation ceremony.

### OA-229
Publish seal.

### OA-230
Preview transition.

### OA-231
Asset upload progress.

### OA-232
Image placement.

### OA-233
Undo/redo state.

### OA-234
Chapter reorder.

### OA-235
Block insertion.

### OA-236
Deleted block collapse.

### OA-237
Compare-version diff reveal.

### OA-238
Immutable edition lock animation.

---

# Original Audit Findings That Must Also Remain Explicit

The reconciliation must also preserve the original audit’s non-addition findings:

1. The specialized multi-library ownership model is correct and must not be collapsed into one tool.
2. Production Rive objects are currently static fallback contracts, not completed production Rive animations.
3. Modern Player, Captain, Creator, and Invitation flows bypass significant legacy cinematic integration.
4. Registered scenes can exist without real production triggers.
5. Chapter release can run invisibly when Journal-specific targets are unmounted.
6. Ceremony replay can fail outside Journal and disappear after refresh.
7. Generic scene-part selectors can target duplicate permanent, temporary, hidden, cloned, or stale nodes.
8. Artifact FLIP selection is DOM-order-sensitive without explicit source/destination handles.
9. Side Quest and Log scenes can animate hidden PageFlip source content.
10. The runtime ownership system warns but does not enforce.
11. Motion and GSAP can write transforms/opacity to the same nodes.
12. PageFlip gentle-mode timing can remain stale after a mode switch.
13. Lottie can reload and restart on mode changes.
14. Lottie one-shots can autoplay before their intended semantic scene label.
15. Lottie lacks a stalled-load timeout.
16. CSS/WAAPI phase waits can hang forever or silently skip missing animations.
17. GSAP empty-target timelines can complete without visible work.
18. Director cleanup can cause route-transition snapback.
19. Reduced-motion behavior currently has competing authorities.
20. The global scene root is too broad and requires dedicated scene hosts.
21. Tests must prove visible, unique target truth, not merely completed timelines or screenshots.
22. Every live event must be tested from every Player section.
23. Replay must remain presentation-only and survive refresh.
24. Sound must be synchronized to semantic labels after visual target validation.
25. Animation correctness, ownership, replay, reduced motion, fallback, and lifecycle must be fixed before decorative expansion.

---

# Required Reconciliation Deliverables

1. Add `OA-001` through `OA-238` to a new reconciliation table.
2. Map every OA item to one or more current `MX-*`, `AS-*`, `AG-*`, `AR-*`, `AL-*`, `AC-*`, `AM-*`, or `AD-*` rows.
3. Never mark a broad MX row as exact coverage of multiple OA items without listing every included OA ID.
4. Add any missing OA items as new matrix rows. The final matrix may exceed 319 rows and that is acceptable.
5. Preserve all current Codex-discovered additions even if they were not in this original list.
6. Update the full audit, roadmap, and test plan so every accepted OA item has:
   - implementation phase;
   - correct library;
   - trigger;
   - replay policy;
   - reduced-motion behavior;
   - acceptance criteria;
   - and test references.
7. Produce exact totals:
   - original OA items exactly covered;
   - combined but fully covered;
   - partially covered;
   - missing and newly added;
   - rejected with rationale;
   - superseded with replacement.
8. Zero OA items may remain unmapped.
