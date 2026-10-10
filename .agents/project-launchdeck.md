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

The requested entrypoint is a regular ChatGPT Chat creating a VoyageWright Work chat inside this same desktop app. The verified optional GitHub connector supplies repository context. All task-relevant project/repository sources remain available; Project Trim changes initial context selection, not access. v0.3.1 treats regular Chat, Work and Codex as first-class invoking surfaces and does not globally require a local executor. The required launch creates a separate native Work chat directly while preserving the source Chat; source continuation and executor relays are excluded. Native operations still require actual host exposure. Source-Chat direct creation remains unverified; missing operations produce a prepared contract labeled automatic creation unavailable.

Run focused helper checks with `python -B .agents/plugins/tests/test_launchdeck.py`. Export a private distribution copy with `python -B .agents/plugins/package-launchdeck.py --output <absolute archive path outside package>`. Upload through Plugin Creator, preserving private audience and the observed plugin/release IDs on updates. Do not edit installed plugin caches or replace current repository governance with the packaged source snapshots.

Instructions/references/manifests/icons are active automation assets; helpers/tests are automation tooling. Engineering verification belongs in the Project Launchdeck program record. This workflow adds no product capability or new release authority.

Installed/private v0.3.1 remains an instructions/helper implementation. Source v0.4.0 is an unpublished development candidate with local MCP components tested through stdio. Normal launches stop before creation because app-server naming/project assignment did not establish native desktop membership without a separate host operation. It is not installed or privately published; ordinary-Chat acceptance remains unverified. See [executable component findings](plugins/project-launchdeck/skills/launch-task/references/executable-launch.md). Keep draft PR #696 unmerged until complete acceptance.
