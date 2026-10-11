# Project Trim task contract

Use existing Project Trim, not a second planning system. Its bundled skill remains
`project-trim`; repository source is `.agents/plugins/project-launchdeck/skills/project-trim`.
Relevant governing sources are `AGENTS.md`, `.agents/README.md`, and
`Development_Docs/Programs/Project_Trim/Project_Trim_Context_Profile_and_Schema.md`.
Refresh source bindings at the target's actual revision. Current documented profiles:
product-phase, bug-repair, documentation-only, infrastructure, security-sensitive,
integration, release-closure. Choose the task's actual profile.

Carry only populated fields: formal initiative/phase/title; unique objective; approved
scope; non-goals; decisive governing sources; dependencies; execution profile; required
outputs; acceptance criteria; special owner authorizations and completion gates.
Use STANDARD_AUTONOMOUS unless the owner requests UNATTENDED_CONTINUATION. Direct the
target to read its current governance rather than repeat permanent Git/privacy/testing
rules. Include an accessible context-packet pointer or ask the target to construct one.
If a source is inaccessible, carry its necessary excerpt, not a useless path.

The retained planner emits `LAUNCHDECK_PROJECT_TRIM_ADAPTATION`, not a schema-valid
canonical packet. Referenced `scripts/agent-context` generators are absent on inspected
current source; do not fabricate packet evidence or restore historical generators just
to launch. Expand autonomously for stale/unknown sources, missing ownership, dependencies
or proof. Scope and required governing reads survive context optimization.

Prompt bytes/words and token proxies are advisory; actual usage is null/UNAVAILABLE.
Do not convert soft bands into Goal token_budget. Preserve existing Sounding Line,
protected-main and explicit owner acceptance gates. Never persist raw prompts,
transcripts, credentials or unrelated private content in the shared journal.
