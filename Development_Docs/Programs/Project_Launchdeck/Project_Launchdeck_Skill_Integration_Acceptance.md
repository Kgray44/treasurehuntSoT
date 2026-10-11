---
title: Launchdeck Skill integration and acceptance
audience: engineering
status: current
canonical_for: project-launchdeck-skill-integration-acceptance
last_reviewed: 2026-10-10
---

# Launchdeck Skill integration and acceptance

The canonical editable Skill is `.agents/skills/launchdeck/SKILL.md`. Existing planning,
request fingerprints, the owner-local locked journal and historical integration evidence
were moved into that Skill rather than rebuilt. `project-launchdeck` and `launch-task`
remain compatibility entrypoints with no independent rules. The latter's old executable
path forwards to the same planner. Existing Project Trim is retained as its own skill.

The owner's current request permits supported host-required Work/Codex handoffs. Earlier
handoff exclusions remain historical evidence. The Skill chooses among real host capabilities,
preserves the source conversation, prefers direct creation and reports actual approvals,
intermediaries and limitations. Installing it cannot grant missing APIs. Gibbs's configuration,
personality, memory, permissions and existing tasks were not changed.

## Source and distribution

Branch: `codex/project-launchdeck-20261010`; existing [draft PR #696](https://github.com/Kgray44/treasurehuntSoT/pull/696).
Protected-main source inspected: `2e367c372a6d44e4e6a68bb38266196954f8d486`; preserved starting candidate:
`350f2187c12c1aa34f657d366050430baaf0cb60`. The PR head identifies the final repository commit;
the [package verification receipt](Project_Launchdeck_Skill_Package_Verification.json) binds exact canonical file digests.

Private [Project Launchdeck](https://chatgpt.com/plugins/plugins_6acaae49c3b48191952700f8888120d0)
was updated from v0.3.1 to v0.4.2 under the same USER/PRIVATE identity
`plugins_6acaae49c3b48191952700f8888120d0`. Final saved release:
`pluginrel_6acad6a8b18c8191ab62bce6c367f68d`. Interim v0.4.1 was superseded after repository
formatting and line-ending normalization; no additional acceptance task was created.

The default packager injects canonical Skill files into the distribution without a second
maintained copy. Two exports produce the same ZIP hash. All 20 archive files were compared
against the supported local installation cache and Creator readback; all 11 canonical Skill
files match byte-for-byte. The root manifest matches semantically. Creator normalizes the
legacy manifest's skills trailing slash and supplies empty keywords/capabilities defaults;
all other fields match. GitHub binding, Project Trim, logos, prompt array/order and audience
are preserved. Obsolete launch-task references were deleted from the saved package.

Archive SHA-256: `13a1d0df7625b51deb0aec94cd870358a57ef5c6c36592bfc09bf3fbd0f31fa8`.
Supported `codex plugin add` and `plugin list` confirm local
`project-launchdeck@voyagewright-launchdeck` v0.4.2 installed/enabled; its cache matches
the archive. That does not prove ordinary ChatGPT or Gibbs selected the installed Skill.

Prior v0.3.1 remains in release history as `pluginrel_6acab71f9e748191ac966cb961f5e3f0`,
and its complete rollback archive was downloaded before update (SHA-256
`f22dc663e29773165f4e3c0fd4cc61d9a61d38becee98e27ca2ae7ee97496b20`). The prior local
cache remains available. Restore through the supported release/install workflow; no
settings, private identities or caches are edited manually.

The optional v0.4.0 app-server implementation is preserved, with its normal launch gate
still failing before reservation/creation. Default archives and local installation staging
exclude `mcp.json`, `.mcp.json` and the server. `--include-adapter` is a development export
and cannot be combined with `--stage-local`. No registration investigations were restarted.

## Caller acceptance

| Environment      | Skill accessible                | Native task launch                                  | Correct project | Extra handoff |
| ---------------- | ------------------------------- | --------------------------------------------------- | --------------- | ------------- |
| Codex Desktop    | PASS: real repository discovery | PASS: exact-marker execution; native Goal gate FAIL | PASS            | No            |
| Gibbs / Dot      | UNVERIFIED                      | UNVERIFIED                                          | UNVERIFIED      | Unknown       |
| Ordinary ChatGPT | UNVERIFIED                      | UNVERIFIED                                          | UNVERIFIED      | Unknown       |
| ChatGPT Work     | UNVERIFIED                      | UNVERIFIED                                          | UNVERIFIED      | Unknown       |

Real `skills/list` at the owned worktree reported enabled `launchdeck`, scope `repo`,
the correct path/name/description/UI metadata, and zero errors. This proves discovery
there. The primary checkout has no committed repository Skill yet; discovery there did
not report launchdeck through that app-server read. A supported CLI installation reports
installed/enabled and contains the correct files, but runtime plugin selection on other
callers remains unverified.

One Desktop-native task was created: `01a12852-fde5-7d82-a8f9-21c454487cf2`,
title `Launchdeck: Desktop Acceptance`, destination VoyageWright native Codex Project
`fd21b701-3215-417a-a413-0a17e02badbb`. Its native readback preserved the exact request
marker and full prepared initial contract, objective
`Return exactly LAUNCHDECK_DESKTOP_ACCEPTANCE. Do not modify any files.`, correct title,
Codex type and project membership. Both completed turns returned the exact marker.
The second turn continued the same task; no replacement was created.

Native Goal acceptance **failed**: the target claimed Goal activity in prose, but its
visible turns contained no Goal tool calls; independent `thread/goal/get` returned
`goal:null`. A follow-up requested actual Goal calls or an unavailable report; readback
still supplied no Goal. A marker response is not Goal proof. The durable receipt records
verified project/title separately with `goal_verified:false`. No fully automated or
supported-assisted end-to-end classification is awarded for this incomplete Goal gate.
Native dispatch/execution is proved; preparation-only would understate that observed result.

Primary-checkout status and tracked diff hashes match before/after this read-only test.
The target's visible traces contain no filesystem actions. Exactly **one disposable chat
was created and one was archived**, after execution and native identity inspection; archived
inventory confirms its ID/title. Zero relay conversations, zero Dot invocations and zero
ordinary-ChatGPT/Work-origin test launches were created. Existing user chats were untouched.

This caller exposes no Gibbs/Dot invocation operation, ordinary-ChatGPT conversation
creation/Skill invocation interface, or supported Chat-to-Work mode-transition request.
Its `handoff_thread` moves existing Codex checkouts and cannot stand in for that transition.
No host confirmation was observed, so whether ordinary ChatGPT requires one is Unknown.
Official [Dot task documentation](https://learn.chatgpt.com/docs/dots/tasks-and-memory)
describes local task delegation; it does not supply that missing interface here.

Owner-side Gibbs test: invoke the installed launchdeck Skill in Gibbs on his existing
connected computer; request VoyageWright Codex title `Launchdeck: Dot Acceptance`, Goal
`Return exactly LAUNCHDECK_DOT_ACCEPTANCE. Do not modify any files.` Inspect the discovered
Skill, exact delivered Goal, project/type/title, completion and relay count. Do not
reconfigure him. Ordinary ChatGPT test: invoke Project Launchdeck's launchdeck Skill in
the original discussion with title `Launchdeck: ChatGPT Acceptance` and equivalent
`LAUNCHDECK_CHATGPT_ACCEPTANCE` Goal; observe the actual supported handoff, approvals,
source preservation and target execution. Work requires its own caller-origin test.
These inaccessible gates are UNVERIFIED, not failed simulations or package bugs.

## Validation and documentation classification

38 planner/adapter checks and three actual-archive checks pass. Coverage includes canonical
routing, missing verified destination refusal, governing phase names, multi-project titles,
V2/V3, dependency delivery, retry/uncertain/pending identity, concurrency, Project Trim
scope/gates, explicit budgets and the blocked adapter. Actual ZIP testing exercises both
canonical and compatibility CLI paths. Skill Creator validates required frontmatter and
the real discovery call validates metadata. Invocation/discussion/continuation boundaries
were reviewed as instructions; no mocked agent decision is reported as host acceptance.

New/moved Skill files, references and interface metadata are active automation under
`.agents`; packaging/tests/forwarders are automation tooling. This record and its digest
receipt are engineering evidence under `Development_Docs`. Automation and engineering
navigation and the changelog are updated; generated document indexes are refreshed.
Product features, current status, feature status and user guides were reviewed: no product
behavior changes require edits there. The owning feature fragments remain unchanged because
this consolidates existing launch workflow/distribution and does not close the missing
end-to-end capability gates. Documentation and feature generation/validation pass.

No merge, tag or repository release is authorized by package installation. Historical
Sounding Line run `38088974932` belongs to the older candidate and is not reused. The final
candidate's ordinary qualification is reported on PR #696 separately from these package
and caller results. Draft status and the owner's merge gate remain intact.
