---
title: Project Confluence Replay Guide
audience: engineering
status: current
canonical_for: project-confluence-replay
last_reviewed: 2026-08-17
---

# Replay guide

Run `npm run confluence:replay -- --last-7-days`. The operation calculates a bounded America/New_York period, creates a unique replay identifier, reuses matching canonical evidence, collects only missing engineering evidence, and never overwrites a canonical journal.

When human evidence is missing, the resulting durable run is `WAITING_FOR_HUMAN_EVIDENCE`; supply a ChatGPT-created weekly human packet at the requested private path, then resume with the run identifier. When both packets exist, the run becomes `READY_FOR_SYNTHESIS`, after which ChatGPT alone produces the theme analysis, outline, and master journal. Codex resumes at validation and approved exact delivery only.
