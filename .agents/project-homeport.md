# Project Homeport automation guidance

Project Homeport work must follow these canonical authorities:

- `Development_Docs/Governance/Voyagewright_Global_Product_Governance_Standard.md`
- `Development_Docs/Projects/Project_Homeport/Project_Homeport_Governing_Document.md`
- `Development_Docs/Projects/Project_Homeport/Project_Homeport_Phase_0_Audit_Report.md`
- `Development_Docs/Projects/Project_Homeport/Project_Homeport_Design_Record.md`

Continue work only in the owned worktree and branch `codex/project-homeport-product-reality-recovery`. Preserve the canonical checkout and shared databases. Use synthetic, isolated fixtures. Never commit raw traces or task-owned databases. Keep direct-URL inspection separate from ordinary reachability evidence. Known product nonconformities are data; artifact validation must fail only on malformed, incomplete, inconsistent, private, or checksum-invalid evidence.

Phase 0 freezes evidence and vocabularies, not the Phase 1 implementation. Do not begin identity, navigation, shell, Profile, Passport, Community, or schema behavior changes under the Phase 0 scope. Run `npm run homeport:validate`, the Sounding Line-selected focused plan, documentation checks, privacy checks, and feature-catalog governance before a Homeport handoff.
