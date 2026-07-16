# Cinematic transition system

`useCinematicTransition` is the shared cancellable sequence runner for arrival, authentication, and progression presentation. A plan has named opening, success, and failure stages. For server-backed commands the real request starts immediately alongside the opening stage. The success branch cannot begin until that request succeeds; a rejected request runs the plan's physical reversal and never reveals authoritative state. Abort on unmount prevents orphaned stage timers, duplicate starts are rejected, and CSS ambience pauses while the document is hidden.

Major full-motion durations are approximately: first arrival 7.95s, same-session re-entry 1.55s, sign-in success 4.72s, prepare 2.5s, release 4.4s in the Quartermaster plus the 7.75s player reveal, solve 2.55s, relic award 3.6s, map reveal 4.15s, pause 2.55s, resume 2.55s, and undo 2.7s. Gentle motion keeps the order with 280-420ms stages. Reduced motion keeps the narrative ordering with stages capped at 120ms.

The browser session key `forever-intro:<campaign>` selects the long first arrival once per session. The always-available **Replay introduction** control forces it locally and never changes story state. Development builds also expose an **Animation lab** containing every named sequence; production builds omit it.

All added material effects are original procedural CSS. No third-party visual or audio assets were added.
