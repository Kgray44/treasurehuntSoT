# Project Ledgerlight design record

**Status:** accepted historical design record. **Base:** 676b21ed. **Scope:** canonical documentation architecture.

Ledgerlight separates audience-specific current documentation, indexed engineering records, and automation-only instructions. Current documents use the shared frontmatter schema and one `canonical_for` subject. The documentation validator enforces structure, navigation, links, indexed records, root policy, and restricted automation language. Historical records are preserved by Git-aware relocation and classified through the index.

This is original Ledgerlight design evidence. Current mainline reconciliation is
recorded in `Project_Ledgerlight_Mainline_Truth_Reconciliation.md` in this
directory; the historical base and acceptance context remain preserved.
