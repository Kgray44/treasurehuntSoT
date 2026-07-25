# Project Harborlight Phase 3 - Gap Ledger

Status vocabulary: `COMPLETE_AND_VALIDATED`, `IMPLEMENTED_NEEDS_VALIDATION`, `PARTIAL`, `NOT_IMPLEMENTED`, `BLOCKED_EXTERNAL`, and `PHASE_4_NON_GOAL`.

| Gate | Requirement | Current source/routes/tests | Status | Exact remaining work and disposition |
| --- | --- | --- | --- | --- |
| 84.1 | Public Harbor and governed destinations | `/community`, category routes, Creator/collection/Guide/Voyage Log details, loading/error boundary | PARTIAL | Public persisted route families and safe empty/error states are implemented; authenticated ownership and browser journeys remain. Owner: Harborlight UI. |
| 84.2 | Search/filter/sort/privacy facets | `src/community/discovery.ts`, `GET /api/community/discover`, Discovery Browser tests | IMPLEMENTED_NEEDS_VALIDATION | Strict service/API supports bounded filters, sorts, cursor; browser exposes search/sort/content/difficulty/free/remix filters with URL state. Cursor control, expanded facets and hostile privacy browser proofs remain. |
| 84.3 | Creator profile | `/community/creators`, `/community/creators/[handle]` | PARTIAL | Persisted public profile routes exist; aggregate, badges, featured work, attribution and social controls remain. |
| 84.4 | Follows, blocks, saves/favorites | `src/community/social.ts`, strict CSRF mutation routes, focused contract tests | PARTIAL | Persisted service and strict mutation API exist; UI, rate/audit proof and cross-resource block enforcement remain. |
| 84.5 | Collections | public routes and strict create/item/reorder API contracts | PARTIAL | Public and mutation routes exist; depth/cycle handling, keyboard reorder UI, noindex and IDOR proof remain. |
| 84.6 | Reviews and eligibility | social service only | PARTIAL | Add derived install/completion eligibility, routes/UI, author snapshots, dedicated authorized spoiler route and privacy tests. |
| 84.7 | Helpful votes | social service only | PARTIAL | Add API/UI, self/block/rate enforcement proof and aggregate reconciliation. |
| 84.8 | Comments/reporting | social service only | PARTIAL | Add subject policy, APIs/UI, sanitizer proof, author snapshots and browser tests. |
| 84.9 | Private Keepsakes | `src/community/keepsakes.ts`, fail-closed canonical-identity route, focused tests | PARTIAL | Policy/generation interface and a fail-closed API seam exist; canonical DB adapter, owner API/pages, safe download and no-session-mutation integration proof remain. |
| 84.10 | Participant/media consent | Keepsake policy helpers | PARTIAL | Add persisted lifecycle/status, checksum binding, revocation deindexing and user flow. |
| 84.11 | Media/location safety | schema/policy only | PARTIAL | Add Sealed Hold adapter, synthetic EXIF fixture sanitizer, derivative persistence, public-location enforcement and tests. |
| 84.12 | Voyage Logs | consent/restriction-aware public list/detail APIs and public routes, route tests | PARTIAL | Safe public projection is implemented; transactional lifecycle, editor/crew/unlisted routes, search and Open Graph handling remain. |
| 84.13 | Guides/recommendations | persisted Guide public routes/APIs; discovery recommendation helper | PARTIAL | Public Guide surfaces exist; safe body policy, recommendations UI and integration validation remain. |
| 84.14 | Safe sharing/Open Graph | listing metadata only | PARTIAL | Add allowlisted metadata for Creator/collection/Guide/Voyage Log and unlisted robots policy. |
| 84.15 | Lanternwake scenes | none in Phase 3 source | NOT_IMPLEMENTED | Register real Community contracts/hosts/triggers and reduced-motion tests under existing Lanternwake authority. |
| 84.16 | Security | discovery rate limiting, strict social/collection/Keepsake contracts, safe Voyage Log projection | PARTIAL | Add negative authorization/IDOR/privacy/network tests and safe audit/outbox coverage. |
| 84.17 | Performance/accessibility | basic semantic markup; no measured evidence | NOT_IMPLEMENTED | Add keyboard/mobile/Axe/performance journeys and record measured budgets. |
| 84.18 | Git/docs/validation | dedicated branch, schemas/migrations, focused unit/TS/build, ordered SQLite rehearsal | IMPLEMENTED_NEEDS_VALIDATION | Expand evidence after all locally attainable product/browser/full-validation gates; branch remains unmerged. |
| 27 | Scanner/object store/workers/distributed rate/monitoring/incident tooling | fail-closed Phase 2 seams | PHASE_4_NON_GOAL | Keep explicitly unconfigured; no production claim. |
| 25 | MySQL execution | MySQL schema and reviewed migrations | BLOCKED_EXTERNAL | Safe probe found no owned isolated MySQL instance or credentials. Do not contact any other database; validate schema/review only. |

The ledger is intentionally conservative: a model, pure service, or API route does not constitute a complete feature. The next implementation order is owner-facing social/collection UI, reviews/comments/report routes, then Keepsake/Voyage Log/Guide flows, Lanternwake, and representative browser/security validation.
