# Responsive behavior

## Product shell and non-immersive workspaces

Public discovery and Player, Captain, and Creator workspaces use a capped full-width shell. Desktop keeps the product mark and route-aware navigation in one sticky row. At compact widths, a named Menu control opens an overlaid navigation panel, moves focus to its first link, closes on Escape or backdrop activation, and returns focus to the trigger. The page remains available to assistive technology in document order, and the skip link targets the shared main-content wrapper.

Public catalog filters collapse from four columns to one readable stack. Player library controls disappear when the library is genuinely empty. Captain section tabs use two balanced rows at phone widths rather than a horizontally scrolling strip; voyage and Studio cards expand at wide widths instead of leaving empty grid tracks. All controls retain a minimum touch height, shell padding includes safe-area insets, and mobile product chrome never overlays the landing role actions.

## Complete shell

Desktop uses the available monitor as a layered story workspace with persistent one-action navigation and compact objective access. Mobile switches to a single content column, labeled bottom navigation, safe-area padding, separate section views, and a compact return-to-clue control. The map always has a text alternative. Artifact inspection becomes a full-screen sheet on narrow screens. Fullscreen mode removes secondary chrome without removing navigation or the objective.

Above 1100px, chart, open journal, and relic display form a three-region physical workspace. At 1100px and below, bottom navigation exposes one view at a time. At 650px, the journal becomes one vertically readable parchment sheet with safe-area-aware bottom controls. Short phone landscape hides the spine/left sheet and uses a compact single-page composition. Capability choices use CSS width, height, orientation, hover-independent controls, safe-area insets, and `prefers-reduced-motion`; no user-agent sniffing is used.

The published Chronicle journal follows the same physical rules while keeping supporting controls secondary. Desktop preserves the dominant open book and contextual side drawers. Compact widths reduce header and tray density while retaining two-page structure. Phone portrait and short landscape use one readable sheet, full-width bottom drawers for chapters/maps/artifacts/messages, touch-safe actions, and a persistent Return to Current Objective control when the reader is behind live progress. Text scaling changes ink size without transforming the entire interface, and reduced motion replaces ceremonial motion with direct, semantically equivalent state changes.

Validated viewports: 2560×1440, 1920×1080, 1440×900, 390×844, 430×932, and 844×390. Product-shell, catalog, Captain, and Studio bounds were also inspected at their representative breakpoints with no document-level horizontal overflow.
