---
title: Project Homeport Staging Origin Interaction Validation Record
audience: product-engineering
status: current
canonical_for: project-homeport-staging-origin-interaction-validation-record
last_reviewed: 2026-08-07
---

# Project Homeport staging origin interaction validation record

## Decision

`STAGING_DESKTOP_VALIDATED_PENDING_OWNER_PHONE_ACCEPTANCE`

The retained Project Homeport branch restores interactive hydration through the
Cloudflare staging hostname without broadening origin trust. Automated direct
and reverse-proxy host regression and authenticated staging desktop journeys
pass. Physical-phone acceptance remains an explicit owner action; this record
does not convert desktop, synthetic, or automated evidence into phone proof.

Exact implementation source: `4ee88a0a07dcb249a7c281bf484c8982b41afee2`.

Exact evidence-expansion source:
`b914b8a3a9ce8f3674ecc992ffaec5c9d1332126`.

Exact automated authority source, including the governed runtime-adapter
disposition: `e4c5120217cf63b46d800757dbfbd01b266fe703`.

## First divergence and root cause

Before the fix, the loopback owner-laptop path rendered and interacted while
the staging document and JavaScript resources returned 200 but remained in the
server-rendered `loading` state. The Next.js development server log identified
the first divergence: its cross-site development-resource guard rejected the
staging `/_next/webpack-hmr` origin. The staging HMR WebSocket consequently
failed before the client account bootstrap ran. The page had no settled inert
root or hit-target overlay, and the client had no hydration exception.

The application also disabled Sign In and Register inputs while the current-user
bootstrap was loading and had no request deadline. That secondary behavior made
an interrupted bootstrap look like a general pointer, touch, and keyboard
failure.

## Bounded implementation

- `allowedDevOrigins` trusts only governed exact hostnames plus exact
  comma-separated development hostnames. Schemes, ports, paths, wildcards, and
  malformed names fail closed.
- `scripts/start-dev.ps1 -Lan` adds only the machine's current preferred LAN
  IPv4 address for that process.
- The current-user request has an eight-second abort deadline and exposes
  non-production, non-identity hydration/state markers. Authentication inputs
  remain operable while bootstrap is pending; only an active form submission
  disables them.
- The optional origin diagnostic is non-production, explicitly enabled, and
  returns only sanitized host/protocol coherence metadata. It returns 404 when
  disabled and never projects cookies, credentials, or forwarding IPs.
- `HOMEPORT_PUBLIC_APP_ORIGIN` is the server-only exact origin for transactional
  account links. A non-origin URL fails configuration validation; the historical
  `NEXT_PUBLIC_APP_URL` remains a compatibility fallback.
- The staging acceptance runtime refuses databases outside its task root,
  refuses unrelated port owners, uses a synthetic fixture clone, and records
  its process/source/port ownership.

Cloudflare Access was not removed or weakened. No wildcard origin, broad CORS
rule, CSRF relaxation, touch-only handler, or global pointer-event override was
introduced.

## Validation evidence

| Scope                                | Result                                                                                                                                                                                                                                           | Truth boundary                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Focused origin/bootstrap/email tests | 36/36 passed                                                                                                                                                                                                                                     | Local focused source proof                                    |
| Dual-host Chromium regression        | Schema-v2 receipt passed both hosts: initial HTML 200; explicit hydration `pending` to `complete`; current-user bootstrap 200; click, focus, typing, paste, Tab, and `/tales` navigation; 11 exact hit targets; settled interaction checks       | Task-owned SQLite and local proxy; not staging or phone proof |
| Initial-load request classification  | Each host recorded 32 requests and 32 responses: 1 document, 26 Next static scripts, 1 stylesheet, 1 auth-context request, 1 other API request, and 2 other fetches; all responses were 200; browser-loopback request count was zero             | Automated dual-host request audit; not Cloudflare capture     |
| Browser diagnostics                  | Each host had live HMR frames, zero HMR errors, zero page/console/unhandled-rejection/non-canceled request failures, zero `inert`, zero viewport blockers, one interactive route layer, and zero outgoing layers                                 | Chromium instrumentation; touch evidence is emulated          |
| Native and emulated input events     | Direct host recorded trusted pointer, click, focus, input, native paste, and Tab behavior; reverse proxy recorded the same except paste used a labeled synthetic HTTP fallback; both recorded trusted emulated `touchstart`/touch-pointer events | Explicitly `physicalDeviceProof: false`                       |
| Normal Homeport validation gate      | Phase 0-7 validation plus the dual-host origin regression passed                                                                                                                                                                                 | Local automated source proof; not phone proof                 |
| Sounding Line subsystem authority    | `RELEASE_GO`; 2/2 receipts passed and clean at exact source `e4c5120`                                                                                                                                                                            | Governed subsystem authority                                  |
| Sounding Line mainline authority     | `RELEASE_GO`; 28/28 receipts passed and clean; zero missing, duplicate, unknown, or invalid receipts at exact source `e4c5120`                                                                                                                   | Governed mainline authority                                   |
| Staging anonymous desktop            | HMR 101; account context 200; Home menu, Explore Chronicles, Sign In, Register, and Forgot Password interacted; hydration completed                                                                                                              | Logged-in Cloudflare Access desktop session                   |
| Staging authenticated desktop        | Synthetic owner reached Chronicle Passport, Personal Harbor, and All Workspaces; settled routes had authenticated state, zero `inert`, and no visible dialog                                                                                     | Task-owned Patch A fixture; no real account content           |
| Current-LAN desktop                  | At `192.168.0.24`, hydration completed; menu and Explore Chronicles worked; Sign In accepted focus and typing; document and auth context returned 200; all 24 discovered static assets returned 200                                              | Current network address; desktop diagnostic, not phone proof  |
| Staging proxy metadata               | Host and forwarded host were `staging.absoluterelativesystems.com`; forwarded/effective protocol was `https`; diagnostic key set contained no cookie, credential, or forwarding-IP fields                                                        | Sanitized runtime diagnostic                                  |
| Physical staging phone               | Pending owner execution                                                                                                                                                                                                                          | Mandatory before owner acceptance                             |

The original automated receipt is retained outside Git at
`C:\Users\kkids\AppData\Local\ForeverTreasureCompanion\Homeport_Origin_Runs\20260807-124217\host-origin-regression-receipt.json`.
The exact schema-v2 evidence-expansion receipt is retained at
`C:\Users\kkids\AppData\Local\ProjectHomeport\Staging-Origin-20260807-124423\evidence\origin-regression-b914b8a\host-origin-regression-receipt.json`.
It contains neither the task credential candidates nor the known synthetic
Sera identifiers.
The owner-review runtime uses
`C:\Users\kkids\AppData\Local\ProjectHomeport\Staging-Origin-20260807-124423`
and `http://192.168.0.24:3000` / `https://staging.absoluterelativesystems.com`.
Synthetic credentials remain only in the task-owned private handoff.

Runtime control commands are:

- `npm run homeport:origin:runtime -- status "C:\Users\kkids\AppData\Local\ProjectHomeport\Staging-Origin-20260807-124423"`
- `npm run homeport:origin:runtime -- stop "C:\Users\kkids\AppData\Local\ProjectHomeport\Staging-Origin-20260807-124423"`
- `npm run homeport:origin:runtime -- start "C:\Users\kkids\AppData\Local\ProjectHomeport\Staging-Origin-20260807-124423"`

## Data and security boundary

The canonical retained-worktree database began and completed automated
validation with SHA-256
`12dd7fdc725673207cdc6aeef0ca1d958f1d7b0bb58e578135e42080c31e8898`.
Fixture preparation copied it into the task root, then all seeding and browser
mutations targeted the disposable clone. The pre/post hashes match. No Access
token, cookie value, provider credential, or real private content belongs in
this record.

The task-owned `SERA_OWNER` test account password was rotated at the owner's
request. Policy assessment, bcrypt verification, the private handoff override,
and a real staging sign-in succeeded; active Sera sessions were revoked before
verification. The password remains only in the private task-root handoff and is
not reproduced in this record or the repository. Other fixture aliases retain
their original task password.

Because raw diagnostic tooling exposed the active Access session headers during
investigation, the owner should expire that Access session after acceptance.

## Remaining acceptance

On a physical phone through the staging URL, the owner must verify menu click,
Explore navigation, Sign In/Register/Forgot Password focus and typing, soft
keyboard and password-control behavior, scrolling, and one synthetic
authenticated Personal Harbor/All Workspaces/Player/Captain/Creator/Community
journey. The original direct-LAN phone reproduction should also be repeated at
the current LAN address while that route is technically available.

The owner must also record cookie metadata for loopback and staging without
values: name, present/absent, `Secure`, `HttpOnly`, `SameSite`, `Domain`, `Path`,
and expiry/max-age. The staging physical-device pass must cover native paste,
Tab or equivalent focus traversal where the device supports it, and the
Profile/account trigger. Automated Chromium touch emulation and the labeled
reverse-proxy paste fallback do not satisfy those checks.

Any failure keeps the decision pending and must include route, action, visible
state, and device details. Automated readiness never changes the owner
decision.
