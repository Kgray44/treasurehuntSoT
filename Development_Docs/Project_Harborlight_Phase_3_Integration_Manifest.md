# Project Harborlight Phase 3 - Integration Manifest

- Original base: `6bd8209d2d7f0edc73da9566fd06e825ae51a602`.
- Latest fetched main before this implementation: `6bd8209d2d7f0edc73da9566fd06e825ae51a602`.
- Main movement at implementation start: none.
- Branch changes add only Phase 3 Community models/migrations, isolated Harbor services/tests, Community route family, and Phase 3 evidence records.
- Convergence risks: Wayfarer/Sealed Hold Phase 3 branches may concurrently touch schema migration order, identity/consent seams, and provider contracts. Do not merge or rebase automatically. Reconcile migration order, canonical identity/completion adapters, and storage/scan ports by owning-domain review.
- Required future post-merge tests: ordered SQLite and owned MySQL migration rehearsal, full private-projection/IDOR suite, focused browsers/Axe/reduced-motion, restart proof, complete validation, and provider-state checks.
- Retained Phase 4 work: moderation console, production scanner/object storage, durable workers, distributed abuse controls, observability, incident response, scaled search, hostile-public hardening, and launch certification.
