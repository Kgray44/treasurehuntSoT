# Responsive behavior

## Complete shell

Desktop uses the available monitor as a layered story workspace with persistent one-action navigation and compact objective access. Mobile switches to a single content column, labeled bottom navigation, safe-area padding, separate section views, and a compact return-to-clue control. The map always has a text alternative. Artifact inspection becomes a full-screen sheet on narrow screens. Fullscreen mode removes secondary chrome without removing navigation or the objective.

Above 1100px, chart, open journal, and relic display form a three-region physical workspace. At 1100px and below, bottom navigation exposes one view at a time. At 650px, the journal becomes one vertically readable parchment sheet with safe-area-aware bottom controls. Short phone landscape hides the spine/left sheet and uses a compact single-page composition. Capability choices use CSS width, height, orientation, hover-independent controls, safe-area insets, and `prefers-reduced-motion`; no user-agent sniffing is used.

The published Tall Tale journal follows the same physical rules while keeping supporting controls secondary. Desktop preserves the dominant open book and contextual side drawers. Compact widths reduce header and tray density while retaining two-page structure. Phone portrait and short landscape use one readable sheet, full-width bottom drawers for chapters/maps/artifacts/messages, touch-safe actions, and a persistent Return to Current Objective control when the reader is behind live progress. Text scaling changes ink size without transforming the entire interface, and reduced motion replaces ceremonial motion with direct, semantically equivalent state changes.

Validated viewports: 1920×1080, 1440×900, 390×844, 430×932, and 844×390. 2560×1440 was layout-reviewed through the same capped workspace rules; automated retained capture remains next-pass work.
