---
title: Animation architecture
audience: developer
status: current
canonical_for: animation-architecture
last_reviewed: 2026-08-06
---

# Animation architecture

Presentation components coordinate approved Rive, Lottie, CSS, and page-flip assets with route lifecycle. Runtime identity is stable within an active scene host; inactive shells must not own a second live instance. Animation enhances state that the domain has already authorized.

Project Homeport route transitions use one monotonically increasing navigation
generation to own readiness, snapshots, loading, focus, settlement, and
cleanup. Ordinary navigation crossfades for 280 ms with a restrained 4 px
incoming settle. The 500 ms loading threshold is cancelled permanently when
that generation becomes ready; stale generations cannot restore loading or an
old route. Reduced motion removes spatial movement and settles immediately.
