---
title: Project Homeport Community Search and Review Correction Contract
audience: product-engineering
status: current
canonical_for: project-homeport-community-search-review-correction-contract
last_reviewed: 2026-08-04
---

# Community search and review correction contract

One compact search form sits directly beneath the Harbor heading and introduction. It contains an accessible query field,
Enter/Search icon action, `Full Search`, and active-search summary. Enter, icon, keyboard activation, advanced filters,
reset, collapse, and browser Back/Forward all use the existing canonical URL/query contract. Full Search animates the same
form into the current detailed filter surface, preserves value and focus, exposes `aria-expanded`, has a reduced-motion
instant state, and replaces the old bottom-of-page duplicate.

Harborlight remains authoritative for reviews. Homeport presents a truthful average/count/distribution summary without
zero-star fiction, a coherent accessible rating/title/body/spoiler composer, validation and character guidance, and
pending/success/failure/rate-limit/moderation states. Safe review cards contain public reviewer identity, rating, dates,
edited state, body, spoiler treatment, and only supported response/helpful/report actions. Own-review edit/delete and a
deliberate empty state are responsive, keyboard-complete, zoom-safe, and privacy bounded.
