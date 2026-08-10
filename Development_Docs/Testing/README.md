# Project Sounding Line Testing Documentation

**GOVERNING BASELINE COMPLETE — IMPLEMENTATION NOT STARTED**

This directory defines the testing-system architecture; it does not replace `scripts/test-all.ps1` or implement the future planner, orchestrator, lease broker, cloned-baseline service, or CI distributor.

The preserved v1.0 charter is amended by the canonical [Part I](../Governing/Project_Sounding_Line_Part_I_Governing_Document_v1.1_Amendment_Edition.pdf), [Part II](../Governing/Project_Sounding_Line_Part_II_Governing_Document_v1.1_Amendment_Edition.pdf), and [Part III](../Governing/Project_Sounding_Line_Part_III_Governing_Document_v1.1_Amendment_Edition.pdf) v1.1 editions. Where those amendments conflict with v1.0, v1.1 controls.

- [Governing charter](../Project_Sounding_Line_Governing_Document.md)
- [Current testing-system audit](Current_Testing_System_Audit.md)
- [Target architecture](Testing_Architecture.md)
- [Taxonomy and ownership](Test_Taxonomy_and_Ownership.md)
- [Resource isolation](Parallel_Execution_and_Resource_Isolation.md)
- [Impact analysis](Test_Impact_Analysis.md)
- [Browser strategy](Browser_and_Compatibility_Strategy.md)
- [Database and fixtures](Database_and_Fixture_Strategy.md)
- [Failure evidence](Failure_Classification_and_Evidence.md), [flake policy](Flake_and_Quarantine_Policy.md), and [Codex obligations](Codex_Testing_Obligations.md)
- [Release policy](Release_Validation_Policy.md), [security/privacy](Testing_Security_and_Privacy.md), and [budgets](Testing_Performance_Budgets.md)
- [Implementation roadmap](Sounding_Line_Implementation_Roadmap.md), [integration manifest](Sounding_Line_Integration_Manifest.md), and [validation report](Sounding_Line_Documentation_Validation_Report.md)

The initial machine-readable baseline is in `testing/*.json`. It is representative and conservative, not a claim that every existing test is already migrated.
