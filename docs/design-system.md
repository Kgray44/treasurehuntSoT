# Design system

## Cinematic companion sections

The shared ocean-dark, parchment, brass, moonlight, and muted-crimson tokens remain authoritative. Journal uses ink/page hierarchy; Chart uses fog and cartographic marks; Altar uses wood/brass placement; Ledger uses secret-note rhythm; Log uses an engraved timeline; Finale uses a dormant celestial mechanism. All retain the same focus ring, corner language, shadows, texture ceiling, typography scale, and motion tokens.

Tokens live in `src/styles/tokens.css`: abyss navy `#061316`, ocean green `#123b3a`, parchment `#d9c69a`, antique brass `#b89551`, crimson `#782f35`, and moonlit teal `#79d2c3`. Georgia/system serif keeps story text readable; Arial is reserved for small operational labels. Paper grain, edge wear, chart lines, brass frames, restrained glow, and vignette are original CSS/SVG materials. Focus is a 3px warm-gold outline. Layers reserve 20–35 for persistent chrome, 60 for journal opening, 70 for ceremony controls, and 90 for GM confirmations.

`globals.css` now imports logical material modules: tokens, landing, player, GM, animation runtime, and development showcase. Physical section components own their nearby scene targets. Each GSAP target uses a dedicated inner element so Motion can own the interactive outer wrapper without property conflicts.

Motion is semantic: full, gentle, and reduced retain the same content and order. Reduced mode removes page curl, travel, parallax, particles, and ambient loops but keeps clear state changes. Typography remains one coherent DOM copy during SplitText animation; the split wrappers are reverted after the scene.
