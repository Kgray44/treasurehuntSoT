---
title: Project Homeport Chronicle Preview and Player Alias Contract
audience: product-engineering
status: current
canonical_for: project-homeport-chronicle-preview-player-alias-contract
last_reviewed: 2026-08-04
---

# Chronicle preview and Player alias contract

`Preview Chronicle` resolves the existing public-safe Community Chronicle detail projection. Preview is read-only: it
does not create a Chronicle session, participant, invitation acceptance, crew, or name request. It shows the safe
applicable title, Creator, synopsis, theme/categories, timing/difficulty/player count, accessibility/language, warnings,
requirements, public version/dates, rating/reviews, save state, license/remix state, Start action, and return path.

`Start Chronicle` alone enters preparation. A signed-in account with a usable canonical display name sees that name
prefilled and read-only. `Edit for this Chronicle` reveals a validated participation alias and explains that the change is
Chronicle-specific. Persistence is on the authoritative participation/playthrough/session boundary; reload retains it and
the account display name and public Profile remain unchanged. Anonymous people retain the editable guest-name flow.

The public preview excludes answers, private prose, Captain notes, hidden clues, draft content, private locations, crew
state, object keys, and unapproved participant identity. Acceptance requires nonmutation proof, signed-in/anonymous
journeys, alias persistence and isolation, Back behavior, mobile, keyboard, screen-reader semantics, effective 200-percent
zoom, and reduced motion.
