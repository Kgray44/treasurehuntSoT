---
title: Project Homeport Phase 0 Natural-Journey Audit
audience: product-engineering
status: current
canonical_for: project-homeport-phase-0-natural-journey-audit
last_reviewed: 2026-08-01
---

# Project Homeport Phase 0 natural-journey audit

## Method and truth boundary

**FACT:** Every ordinary journey began at `/` and used only visible product controls until it reached its destination or blocked. Direct URL entry occurred only afterward to inspect an orphan, dynamic/detail route, bookmark/deep-link behavior, unauthorized entry, or route-level failure. A direct URL never counted as proof of ordinary reachability.

**FACT:** The audit ran against source `8d142227d712d27e363b15903dba9b0c99a04bc8`, synthetic fixture `homeport-phase0-synthetic-v1` with fixture checksum `f3580be9bda0e747b1b0b9a4013f00ea4517847f5405eddd32d2efb0894c1135`, Codex in-app Chromium 150, and an isolated SQLite database. Session authority names were recorded; values were not.

**FACT:** Result totals are 13 attempted, 0 `PASSED`, 5 `PASSED_WITH_NONCONFORMITY`, 3 `BLOCKED_BY_PRODUCT_DEFECT`, 1 `BLOCKED_BY_FIXTURE`, 0 `BLOCKED_BY_ENVIRONMENT`, and 4 `UNREACHABLE`.

## Journey result matrix

| ID         | Journey                                  | Result                    | Root      | Evidence                                |
| ---------- | ---------------------------------------- | ------------------------- | --------- | --------------------------------------- |
| HP-JRN-001 | Anonymous arrival to account creation    | UNREACHABLE               | HP-NC-001 | HP-EV-001, 003, 028                     |
| HP-JRN-002 | Anonymous arrival to sign-in             | PASSED_WITH_NONCONFORMITY | none      | HP-EV-004, 027, 032                     |
| HP-JRN-003 | Player sign-in to Player library         | PASSED_WITH_NONCONFORMITY | none      | HP-EV-007, 009                          |
| HP-JRN-004 | Signed-in Player to Profile              | UNREACHABLE               | HP-NC-006 | HP-EV-005, 016, 017                     |
| HP-JRN-005 | Signed-in Player to Passport and history | BLOCKED_BY_FIXTURE        | HP-NC-009 | HP-EV-013, 015                          |
| HP-JRN-006 | Signed-in user to Community Harbor       | UNREACHABLE               | HP-NC-010 | HP-EV-018, 020                          |
| HP-JRN-007 | Community district journey               | UNREACHABLE               | HP-NC-012 | HP-EV-021–024                           |
| HP-JRN-008 | Account menu to security and sessions    | PASSED_WITH_NONCONFORMITY | none      | HP-EV-025                               |
| HP-JRN-009 | Workspace switching                      | BLOCKED_BY_PRODUCT_DEFECT | HP-NC-004 | HP-EV-011, 012                          |
| HP-JRN-010 | Sign-out                                 | PASSED_WITH_NONCONFORMITY | none      | HP-EV-029, 030                          |
| HP-JRN-011 | Session expiry                           | PASSED_WITH_NONCONFORMITY | none      | HP-EV-026                               |
| HP-JRN-012 | Permission-restricted route              | BLOCKED_BY_PRODUCT_DEFECT | HP-NC-017 | route/redirect observation              |
| HP-JRN-013 | Mobile navigation                        | BLOCKED_BY_PRODUCT_DEFECT | HP-NC-016 | HP-EV-002, 006, 008, 010, 014, 019, 031 |

## HP-JRN-001 — Anonymous arrival to account creation

**OBSERVATION:** The gateway has no account control. The visible Explore path reaches `/tales`, whose anonymous Account menu reaches Sign In but exposes neither Create Account nor password recovery. `/register` works only after direct entry. Validation rejected mismatched passwords, and unique synthetic registration returned “Your account request was completed,” but remained on the filled form until Return to Voyagewright was chosen.

**GOVERNING REQUIREMENT:** Account creation must be a clear primary action and must end in an intentional authenticated destination. Result: `UNREACHABLE`; related HP-NC-001, 003, 024.

## HP-JRN-002 — Anonymous arrival to sign-in

**OBSERVATION:** Gateway → Explore Chronicles → anonymous Account → Sign In reaches `/sign-in`. The form has no Create Account or Forgot Password affordance. Sign-in succeeds, but this is an indirect generic path instead of a gateway account path. Result: `PASSED_WITH_NONCONFORMITY`; related HP-NC-001, 025.

## HP-JRN-003 — Player sign-in to Player library

**OBSERVATION:** Gateway → Player → Player sign-in reaches the library. Immediately after authentication the shell still displayed anonymous “Account”; reload projected the profile. The flow wrote canonical `HP-SES-001`, while legacy Player compatibility remained an observed boundary. Result: `PASSED_WITH_NONCONFORMITY`; related HP-NC-004, 021.

## HP-JRN-004 — Signed-in Player to Profile

**OBSERVATION:** The authenticated account menu contains Passport, Security, Captain, Creator, and Sign out, but no View My Profile. Direct `/profile/homeport-mariner` works and is evidence only of route existence. Result: `UNREACHABLE`; related HP-NC-006, 014.

## HP-JRN-005 — Signed-in Player to Passport and history

**OBSERVATION:** Passport is reachable from the authenticated account menu without reauthentication. The seeded fixture intentionally contained no history records, so history detail could not be exercised. The surface is a dense engineering form with provider lists and a test simulator. Result: `BLOCKED_BY_FIXTURE`; related HP-NC-009. No reauthentication contradiction was reproduced.

## HP-JRN-006 — Signed-in user to Community Harbor

**OBSERVATION:** Neither gateway nor ordinary shell/account controls expose Community. Direct `/community` works but does not establish reachability. Result: `UNREACHABLE`; related HP-NC-010, 014.

## HP-JRN-007 — Community district journey

**OBSERVATION:** Direct Community root visibly links Featured, Chronicles, Artifacts, Guides, and Voyage Logs. Creators, Collections, Audio, Maps, Templates, and Moderation routes exist but are absent from the visible district navigation. Synthetic detail, save/unsave, self-follow denial, and no-results behavior were exercised; save visibly updated and self-follow produced understandable denial. Result: `UNREACHABLE`; related HP-NC-012, 026.

## HP-JRN-008 — Account menu to security and sessions

**OBSERVATION:** Security is directly available in the authenticated menu, bypassing the governed Profile-first hierarchy. The security/session surface is reachable and synthetic session controls are present. Result: `PASSED_WITH_NONCONFORMITY`; related HP-NC-006, 008.

## HP-JRN-009 — Workspace switching

**OBSERVATION:** A full-capability linked account showed Captain and Creator menu entries after Player authentication, but Captain required a second staff sign-in because canonical `HP-SES-001` and staff `HP-SES-002` disagreed. After staff sign-in, Captain and Creator libraries were reachable. Community and Profile remained absent from switching controls. Result: `BLOCKED_BY_PRODUCT_DEFECT`; related HP-NC-004, 022, 023.

## HP-JRN-010 — Sign-out

**OBSERVATION:** Sign out revoked the task-owned session, returned a visible anonymous state, and a protected Player library reload redirected to `/player/sign-in?return=/player/library`. This is dependable for the exercised session, but Phase 0 did not prove global multi-authority or stale-second-tab invalidation. Result: `PASSED_WITH_NONCONFORMITY`; HP-NC-005 is closed by current evidence while broader convergence remains Phase 1 work.

## HP-JRN-011 — Session expiry

**OBSERVATION:** After expiring the task-owned AccountSession record, protected reload redirected to `/player/sign-in?return=/player/library`. The intended return is preserved, but no explicit expiration explanation appears. Result: `PASSED_WITH_NONCONFORMITY`; related HP-NC-017, 027.

## HP-JRN-012 — Permission-restricted route

**OBSERVATION:** An authenticated non-moderator opening `/community/moderation` was redirected to generic `/sign-in`, flattening authorization denial into authentication. No deliberate locked or denied experience was shown. Result: `BLOCKED_BY_PRODUCT_DEFECT`; related HP-NC-017, 027.

## HP-JRN-013 — Mobile navigation

**OBSERVATION:** Mobile gateway, account menu, Player sign-in/library, Passport, Community root, and sign-out were exercised at 390 by 844. Player navigation exposed only Explore Chronicles for the linked Player identity and lacked Community and Profile. Sign-out worked. Result: `BLOCKED_BY_PRODUCT_DEFECT`; related HP-NC-016, 022.

## Unresolved environmental state

**UNRESOLVED:** Dependency-unavailable behavior was not safely inducible without manufacturing a false infrastructure failure. It remains `UNREACHABLE/NOT_REPRODUCED` in the screen-state catalog, not an inferred pass or fail.
