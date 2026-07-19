# Animation library ownership

Each visual property has one owner at a time. The development registry warns when two runtimes claim a conflicting property on the same element.

| Runtime    | Owns                                                                                                                                                              | Must not own                                                                                      |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| GSAP       | Cinematic sequencing, SVG draw/morph/motion paths, SplitText reveals, coordinated transforms, filters, opacity, and clip paths on `[data-gsap-owned]` scene parts | Button hover/tap feedback, React presence, journal page physics, Rive internals, Lottie internals |
| Motion     | React enter/exit, layout/presence transitions, press/hover/focus feedback, small draggable or spring interactions                                                 | Long narrative timelines or any GSAP-owned property during a scene                                |
| StPageFlip | Page curl, book orientation, manual/programmatic turns, page index                                                                                                | Content reveals inside a page or section navigation                                               |
| Rive       | State machine and inputs inside one stateful vector object                                                                                                        | Page-level orchestration or server timing                                                         |
| Lottie     | Playback inside its own container                                                                                                                                 | DOM outside that container or authoritative state                                                 |
| CSS        | Static layout, material appearance, restrained ambient keyframes                                                                                                  | Narrative order or properties claimed by an active runtime                                        |

`claimAnimationOwnership` records owner/property claims in a `WeakMap`, adds a diagnostic `data-animation-owner`, and releases the claim during director cleanup. GSAP scene roots use `gsap.context(..., root)` so selector scope and reversion stay local.

Nested ownership is encouraged: Motion may animate a card's outer wrapper while GSAP animates a dedicated inner scene part, or GSAP may move a Lottie container while Lottie draws only within it. Two runtimes must not write `transform` or `opacity` to the same element.

The rule for additions is simple: choose the smallest runtime that naturally owns the behavior, place its target on a dedicated wrapper when necessary, declare the ownership in markup, and add cleanup before the scene begins.

## Phase 3 progression ownership

The persistent `player-progression` host owns global ceremony targets for all sections. Section components may register exact event/keyed targets with their nearest nested `player-section-enhancement` host, but those handles are identity-only capabilities rather than permission to animate. The controller resolves an eligible handle only after global semantic commit, obtains the declared runtime/property permit, and revokes it during completion, cancellation, status retraction, access revocation, or unmount.

Global and local work never write the same visual property concurrently. Local enhancement is optional and nonblocking; it cannot delay the global receipt, provide fallback, or acknowledge an event. Motion may own an outer presence wrapper while GSAP owns a dedicated inner scene part. StPageFlip remains the sole owner of page-curl geometry, and Rive/Lottie remain confined to their own containers. Final-state handoff occurs before cleanup releases any property or runtime claim.
