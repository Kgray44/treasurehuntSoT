---
title: Documentation governance
audience: developer
status: current
canonical_for: documentation-governance
last_reviewed: 2026-07-27
---

# Documentation governance

Current human documentation has one primary audience and the required frontmatter fields: `title`, `audience`, `status`, `canonical_for`, and `last_reviewed`. Product, user, administrator, developer, and reference material belongs under `docs`; historical evidence belongs in `Development_Docs`; active automation instructions belong in `.agents`.

Before adding a document, choose its audience and canonical topic, place it in the appropriate hierarchy, link it from the documentation hub or a section index, and update the engineering-record index if applicable. Do not create root status notes, task prompts, or handoffs. The validator enforces the root allowlist, frontmatter, link reachability, canonical-topic uniqueness, record indexing, navigation, and restricted automation vocabulary.

When behavior changes, update features, current status, feature status, affected guides, and the changelog. This page is the documented exemption for discussing the category of automation instructions; it contains no task handoff.
