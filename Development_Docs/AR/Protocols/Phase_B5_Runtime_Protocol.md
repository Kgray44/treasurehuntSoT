# Phase B-5 Runtime Protocol

## Trust boundary

The Player surface and Companion are untrusted result producers. The server owns attempt authorization, runtime policy, story freshness, Captain decisions, canonical progression, and presentation requests. Raw runtime frames never cross the Companion boundary.

## Attempt creation

`POST /api/vision-runtime/attempts` accepts the session, active block, exact waypoint version, platform, adapter type, and Companion instance. The authenticated session must currently be on that published block. The coordinator resolves the immutable published binding and completed B-4 package, enforces one active attempt per Player/stage, records policy, and returns:

- attempt, waypoint, waypoint-version, package ID and package hash;
- configured and effective runtime mode plus any safe-demotion reason;
- current story sequence and short-lived stage token;
- scan interaction, guidance, and privacy/readiness truth.

`GET /api/vision-runtime/packages/{packageId}?attemptId={attemptId}` returns only the exact data-only package authorized for that attempt. The Companion independently validates manifest, artifacts, hashes, schema, engine/model compatibility, memory bounds, and waypoint version before caching it.

## Result submission

`POST /api/vision-runtime/attempts/{attemptId}/result` accepts one strict derived-result envelope: attempt token, waypoint/package/Companion identity, result, guidance code, failed gates, evidence digest, engine/model/provider identity, bounded frame counts, duration, `rawFramesRetained=false`, sanitized diagnostics, and observation time.

Stable results are `VERIFIED`, `INSUFFICIENT_VISUAL_EVIDENCE`, `NOT_AT_TARGET`, `AMBIGUOUS`, `SYSTEM_ERROR`, and `CANCELLED`. The coordinator may record `STALE` when the current published version, stage, story sequence, request, or binding no longer matches.

The server rejects unknown fields, mismatched identity, bad/expired signatures, impossible counts, retained-frame claims, evidence-digest mismatch, incompatible packages, and future/old timestamps. A byte-equivalent logical retry with the same result and evidence identity returns the stored result. A different second result is `RESULT_CONFLICT`.

## Mode behavior

| Effective mode      | On `VERIFIED`                                                                |
| ------------------- | ---------------------------------------------------------------------------- |
| `DEVELOPMENT_MOCK`  | Existing deterministic development-only consumer; never production evidence. |
| `SHADOW`            | Persist result and wait; no progression.                                     |
| `CAPTAIN_CONFIRMED` | Persist result and wait for Captain approval.                                |
| `AUTOMATIC`         | Recheck live eligibility/control, then deliver once or demote safely.        |
| `DISABLED`          | Do not arm.                                                                  |

Non-success results never progress. Guidance is intentionally distinct: insufficient/ambiguous suggest a better scan, not-at-target avoids exposing the target, system error promises that progress is safe, and stale reports that the story already moved.

## Captain protocol

`POST /api/vision-runtime/attempts/{attemptId}/captain-action` requires Captain authentication, CSRF, the Vision decision permission, reason, and idempotency key. Actions are `APPROVE`, `REJECT`, `REQUEST_RESCAN`, `MANUAL_OVERRIDE`, `LABEL_TRUTH`, `PAUSE_AUTOMATIC`, `DEMOTE_TO_CAPTAIN_CONFIRMED`, `PROMOTE_TO_CAPTAIN_CONFIRMED`, and `PROMOTE_TO_AUTOMATIC`.

Manual approval obeys the immutable binding fallback policy. Approval of an engine result requires `VERIFIED`; otherwise the explicit audited `MANUAL_OVERRIDE` path is required. Promotions rerun package, certification, field-evidence, and rollout preflight. The current B-4 packages fail automatic preflight by design.

## Offline protocol

The Player queue stores at most derived `vision.result` envelopes in local storage. Each event has a stable event ID, idempotency key, attempt ID, story sequence, observation time, and SHA-256 payload hash. `POST /api/vision-runtime/offline/reconcile` accepts at most 50 events. The server persists pending-event truth, validates the payload hash, applies normal result validation, and returns `SYNCED`, `CONFLICT`, or `REJECTED`. Replays of the same event return the prior terminal disposition.

Offline mode never relaxes certification or freshness. A changed story sequence is surfaced as `STORY_STATE_VERSION_CHANGED`; it is not overwritten.

## Presentation protocol

After canonical delivery, B-5 records a presentation request for the existing Phase A story event. The Player acknowledges `STARTED`, `COMPLETED`, or `FAILED` through the presentation route. Failure stores a recovery action for Captain retrigger/continue and does not redeliver the story success event.

## Compatibility and common failures

`PRODUCTION_PACKAGE_REQUIRED`, `PACKAGE_INTEGRITY_FAILED`, `PACKAGE_CACHE_UNAVAILABLE`, and `RESULT_IDENTITY_MISMATCH` require package/Companion repair. `STAGE_TOKEN_INVALID`, `RESULT_TIME_INVALID`, `STORY_STAGE_CHANGED`, and `RESULT_CONFLICT` protect freshness/replay. `FIELD_EVIDENCE_REQUIRED`, `CERTIFICATION_REQUIRED`, and disabled rollout flags prevent unsafe promotion. All failures preserve canonical story progress.
