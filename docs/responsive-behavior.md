# Responsive behavior

## Product shell and non-immersive workspaces

Public discovery and Player, Captain, and Creator workspaces use a capped full-width shell. Desktop keeps the product mark and route-aware navigation in one sticky row. At compact widths, a named Menu control opens an overlaid navigation panel, moves focus to its first link, closes on Escape or backdrop activation, and returns focus to the trigger. The page remains available to assistive technology in document order, and the skip link targets the shared main-content wrapper.

Public catalog filters collapse from four columns to one readable stack. Player library controls disappear when the library is genuinely empty. Captain section tabs use two balanced rows at phone widths rather than a horizontally scrolling strip; voyage and Studio cards expand at wide widths instead of leaving empty grid tracks. All controls retain a minimum touch height, shell padding includes safe-area insets, and mobile product chrome never overlays the landing role actions.

## Complete shell

Desktop uses the available monitor as a layered story workspace with persistent one-action navigation and compact objective access. Mobile switches to a single content column, labeled bottom navigation, safe-area padding, separate section views, and a compact return-to-clue control. The map always has a text alternative. Artifact inspection becomes a full-screen sheet on narrow screens. Fullscreen mode removes secondary chrome without removing navigation or the objective.

Above 1100px, chart, open journal, and relic display form a three-region physical workspace. At 1100px and below, bottom navigation exposes one view at a time. At 650px, the journal becomes one vertically readable parchment sheet with safe-area-aware bottom controls. Short phone landscape hides the spine/left sheet and uses a compact single-page composition. Capability choices use CSS width, height, orientation, hover-independent controls, safe-area insets, and `prefers-reduced-motion`; no user-agent sniffing is used.

The routed Tall Tale Experience keeps its four section destinations visible as a horizontal parchment-and-brass tablist. Desktop and tablet show Chapters, Map, Artifacts, and Messages above a full-width routed content region; compact widths keep the same destinations in a touch-safe horizontally scrollable row. No essential section returns to a side drawer or covers the current content. The shell, connection, theme, audio, motion, and reading providers remain mounted while only the keyed tabpanel changes.

Chapters preserves the physical two-page book where space permits and becomes a readable single-page composition on phones and short landscape screens. Map receives its own chart viewport and stacks selected-location detail below it when narrow. Artifacts become a one-column gallery plus inspection flow, and Messages become a readable list/detail stack. The compact connection notice remains in document flow. Text scaling changes ink size without transforming the entire interface, and reduced motion replaces spatial ceremonies with fast, semantically equivalent opacity/state changes.

The consolidation responsive pass exercises 375, 430, 768, 1024, 1440, and 1920 pixel widths. The product shell switches between mobile and desktop navigation without horizontal overflow; Experience tabs remain reachable, and route content never becomes a narrow side overlay. Existing physical-workspace checks also retain short-landscape and safe-area coverage.
