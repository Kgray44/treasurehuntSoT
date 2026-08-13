---
title: Project Wakebook Phase 2 Privacy and Consent Matrix
audience: product-engineering
status: draft
canonical_for: project-wakebook-phase-2-privacy-consent-matrix
last_reviewed: 2026-08-13
---

# Project Wakebook Phase 2 privacy and consent matrix

| Resource               | Owner                               | Participant                                            | Foreign account / public      | Enforcement                                     |
| ---------------------- | ----------------------------------- | ------------------------------------------------------ | ----------------------------- | ----------------------------------------------- |
| Rich Voyage Detail     | Full bounded DTO                    | No implicit access                                     | Neutral not-found             | Owner predicate before projection               |
| Reflection and Memory  | Read/write own record only          | No implicit access                                     | Neutral not-found             | Account session, CSRF, record ownership         |
| Memory reference/media | Validated owned-Voyage context only | No implicit access                                     | Neutral not-found             | Opaque reference plus authorized delivery       |
| Keepsake               | Private presentation                | Own consent mutation only when an eligible participant | No access                     | Wayfarer consent authority and owner projection |
| Crew snapshot          | Historical safe snapshot            | No broader private history                             | No public Wakebook projection | Tombstone and consent-aware representation      |
| Technical provenance   | Owner-only bounded metadata         | No access                                              | Neutral not-found             | Server-side DTO redaction                       |

The owner cannot grant, deny, or revoke consent for another participant.
Consent absence is not a grant. A revocation removes the affected dependent
Keepsake representation on regeneration while retaining unrelated owner
Memories and the canonical Voyage history.
