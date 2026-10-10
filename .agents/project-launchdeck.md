---
title: Project Launchdeck repository entrypoint
audience: automation
status: current
canonical_for: project-launchdeck-automation
last_reviewed: 2026-10-10
---

# Project Launchdeck

Repository-owned package: [plugin manifest](plugins/project-launchdeck/plugin.json).
Project-local skill: [project-launchdeck](skills/project-launchdeck/SKILL.md).
Package workflow: [launch-task](plugins/project-launchdeck/skills/launch-task/SKILL.md).
Project Trim adaptation: [project-trim](plugins/project-launchdeck/skills/project-trim/SKILL.md).

The requested entrypoint is a regular ChatGPT Chat creating a VoyageWright Work chat inside this same desktop app. The verified optional GitHub connector supplies repository context. All task-relevant project/repository sources remain available; Project Trim changes initial context selection, not access. The package declares local-executor requirements, but native conversation and Goal operations still require actual host exposure. The first same-app Chat acceptance reported missing native tools and created nothing; that handoff remains unvalidated. Missing operations produce an honest ready-to-launch prompt.

Run focused helper checks with `python -B .agents/plugins/tests/test_launchdeck.py`. Export a private distribution copy with `python -B .agents/plugins/package-launchdeck.py --output <absolute archive path outside package>`. Upload through Plugin Creator, preserving private audience and the observed plugin/release IDs on updates. Do not edit installed plugin caches or replace current repository governance with the packaged source snapshots.

Instructions/references/manifests/icons are active automation assets; helpers/tests are automation tooling. Engineering verification belongs in the Project Launchdeck program record. This workflow adds no product capability or new release authority.
