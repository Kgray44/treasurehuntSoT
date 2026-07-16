# Responsive behavior

Above 1100px, chart, open journal, and relic display form a three-region physical workspace. At 1100px and below, bottom navigation exposes one view at a time. At 650px, the journal becomes one vertically readable parchment sheet with safe-area-aware bottom controls. Short phone landscape hides the spine/left sheet and uses a compact single-page composition. Capability choices use CSS width, height, orientation, hover-independent controls, safe-area insets, and `prefers-reduced-motion`; no user-agent sniffing is used.

Validated viewports: 1920×1080, 1440×900, 390×844, 430×932, and 844×390. 2560×1440 was layout-reviewed through the same capped workspace rules; automated retained capture remains next-pass work.
