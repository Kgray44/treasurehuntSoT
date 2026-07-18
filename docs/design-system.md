# Design system

## Product application foundation

The ocean-dark, parchment, brass, moonlight, and muted-crimson materials now serve both the immersive story runtime and the surrounding product. `src/styles/tokens.css` defines semantic background, surface, text, border, accent, state, radius, control-height, content-width, shadow, motion, font, shell, and layer tokens. Product surfaces should use those semantic tokens before adding route-local values. Primary, secondary, subtle, destructive, icon, disabled, loading, and focus states share one control language; disabled controls must remain readable on both ocean and parchment surfaces.

`ProductShell` is the shared application frame for public discovery and Player, Captain, and Creator workspaces. It owns the skip link, route-aware product mark, active navigation, keyboard-safe mobile menu, workspace language, and restrained footer. Immersive routes—including the role gateway, legacy live companion, platform journal, active Tale runtime, Quartermaster, and development showcase—deliberately remain outside that chrome so story play is not visually demoted.

`AsyncState` supplies stable loading, recoverable error, intentional empty, and status-banner patterns. Loading reserves meaningful space and names the work in progress; error states say what failed and offer an in-place retry or a safe return; empty states explain what can happen next; successful and destructive mutations use polite status or alert regions. Route-family layouts provide meaningful document titles while the root metadata remains reusable product copy.

System copy uses the shared product vocabulary: a Creator authors a reusable **Tall Tale**, a Captain configures a version-pinned **Voyage**, an invited **Player** waits for launch, and the **Journal** is the canonical in-session and completed-history surface. The collective word _participant_ is used when a role distinction is unnecessary; _crew_ remains optional flavor rather than permission language. Personal names and event-specific language belong to authored content and invitations, not generic product controls.

## Semantic application themes

All application chrome and operational surfaces consume the `--color-*` aliases in `tokens.css`. **Verdant Depths** is the default deep green-black, muted emerald, warm-brass, cream-parchment scheme. **Moonlit Blue** replaces water, fog, glow, surfaces, borders, text, focus, and navigation values with a controlled navy/cyan family. Vision Waypoint and Companion screens use those same aliases and are not independent blue applications.

Theme precedence is: explicit Experience override, persisted Player or staff application preference, then Verdant Depths. `APPLICATION` on a Tall Tale means inherit. Stable parchment pigments may remain material-specific, but surrounding atmosphere, focus, metal, shadow, status, form, and navigation colors must use semantic tokens. New visual experiments extend this theme layer; they must not introduce a separate root palette or alternate frontend runtime.

Navigation has four deliberately separate levels: ProductShell global workspace links, stable Captain/Creator workspace sections, the four routed Player Experience tabs, and local content controls. Deeper Studio and Captain routes add explicit breadcrumbs. The global shell never replaces the Experience tabs, and contextual controls never masquerade as global navigation.

## Cinematic companion sections

The shared ocean-dark, parchment, brass, moonlight, and muted-crimson tokens remain authoritative. Journal uses ink/page hierarchy; Chart uses fog and cartographic marks; Altar uses wood/brass placement; Ledger uses secret-note rhythm; Log uses an engraved timeline; Finale uses a dormant celestial mechanism. All retain the same focus ring, corner language, shadows, texture ceiling, typography scale, and motion tokens.

Tokens live in `src/styles/tokens.css`: abyss navy `#061316`, ocean green `#123b3a`, parchment `#d9c69a`, antique brass `#b89551`, crimson `#782f35`, and moonlit teal `#79d2c3`. Georgia/system serif keeps story text readable; Arial is reserved for small operational labels. Paper grain, edge wear, chart lines, brass frames, restrained glow, and vignette are original CSS/SVG materials. Focus is a 3px warm-gold outline. Layers reserve 20–35 for persistent chrome, 60 for journal opening, 70 for ceremony controls, and 90 for GM confirmations.

`globals.css` imports logical material modules: tokens, shell, landing, platform, Tall Tale, Studio, player, GM, animation runtime, and development showcase. Physical section components own their nearby scene targets. Each GSAP target uses a dedicated inner element so Motion can own the interactive outer wrapper without property conflicts.

Motion is semantic: full, gentle, and reduced retain the same content and order. Reduced mode removes page curl, travel, parallax, particles, and ambient loops but keeps clear state changes. Typography remains one coherent DOM copy during SplitText animation; the split wrappers are reverted after the scene.
