---
title: Project Launchdeck repository entrypoint
audience: automation
status: current
canonical_for: project-launchdeck-automation
last_reviewed: 2026-10-10
---

# Project Launchdeck

Repository-owned package: [plugin manifest](plugins/project-launchdeck/plugin.json).
Canonical Skill: [launchdeck](skills/launchdeck/SKILL.md).
Compatibility aliases: [project-launchdeck](skills/project-launchdeck/SKILL.md) and [launch-task](plugins/project-launchdeck/skills/launch-task/SKILL.md).
Project Trim adaptation: [project-trim](plugins/project-launchdeck/skills/project-trim/SKILL.md).

The canonical Skill prepares authorized tasks with existing Project Trim, routing, titles and durable request identities, then selects supported native delegation on the actual caller. VoyageWright means the existing Codex Project for `Kgray44/treasurehuntSoT`. Prefer direct creation; supported host-required Work handoffs and approvals are permitted under the current owner request. Preserve the original conversation and minimize relays. Skills cannot grant missing APIs. Gibbs remains unchanged. Each caller's acceptance is independent.

Run focused checks with `python -X utf8 -B .agents/plugins/tests/test_launchdeck.py` and `python -X utf8 -B .agents/plugins/tests/test_package_launchdeck.py`. Export with `python -B .agents/plugins/package-launchdeck.py --output <absolute archive path outside package> --stage-local`; generated staging is ignored and never independently edited. The existing marketplace points to that versioned Skill-only output. Use `codex plugin add project-launchdeck@voyagewright-launchdeck --json` for supported local installation. Upload the same ZIP through Plugin Creator with the existing private identity and guarded release ID. Do not edit installed caches.

Instructions/references/manifests/icons are active automation assets; helpers/tests are automation tooling. Engineering verification belongs in the Project Launchdeck program record. This workflow adds no product capability or new release authority.

The v0.4.2 Skill-only distribution excludes MCP configuration and server activation. The optional v0.4.0 executable adapter remains preserved and blocked; `--include-adapter` is development export only and cannot be combined with local installation staging. See [component findings](skills/launchdeck/references/executable-launch.md) and [current acceptance evidence](../Development_Docs/Programs/Project_Launchdeck/Project_Launchdeck_Skill_Integration_Acceptance.md). Keep draft PR #696 unmerged pending applicable repository acceptance and owner authorization.
