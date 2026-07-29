---
title: Animation architecture
audience: developer
status: current
canonical_for: animation-architecture
last_reviewed: 2026-07-27
---

# Animation architecture

Presentation components coordinate approved Rive, Lottie, CSS, and page-flip assets with route lifecycle. Runtime identity is stable within an active scene host; inactive shells must not own a second live instance. Animation enhances state that the domain has already authorized.
