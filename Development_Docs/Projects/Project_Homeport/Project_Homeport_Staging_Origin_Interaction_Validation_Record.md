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

| Scope                                | Result                                                                                                                                                                                    | Truth boundary                                                |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Focused origin/bootstrap/email tests | 36/36 passed                                                                                                                                                                              | Local focused source proof                                    |
| Dual-host Chromium regression        | Direct and exact reverse-proxy host passed hydration, bootstrap 200, click, keyboard focus/typing, `/tales` navigation, and settled overlay checks                                        | Task-owned SQLite and local proxy; not staging or phone proof |
| Normal Homeport validation gate      | Phase 0-7 validation plus the dual-host origin regression passed                                                                                                                          | Local automated source proof; not phone proof                 |
| Sounding Line subsystem authority    | `RELEASE_GO`; 2/2 receipts passed and clean at exact source `e4c5120`                                                                                                                     | Governed subsystem authority                                  |
| Sounding Line mainline authority     | `RELEASE_GO`; 28/28 receipts passed and clean; zero missing, duplicate, unknown, or invalid receipts at exact source `e4c5120`                                                            | Governed mainline authority                                   |
| Staging anonymous desktop            | HMR 101; account context 200; Home menu, Explore Chronicles, Sign In, Register, and Forgot Password interacted; hydration completed                                                       | Logged-in Cloudflare Access desktop session                   |
| Staging authenticated desktop        | Synthetic owner reached Chronicle Passport, Personal Harbor, and All Workspaces; settled routes had authenticated state, zero `inert`, and no visible dialog                              | Task-owned Patch A fixture; no real account content           |
| Staging proxy metadata               | Host and forwarded host were `staging.absoluterelativesystems.com`; forwarded/effective protocol was `https`; diagnostic key set contained no cookie, credential, or forwarding-IP fields | Sanitized runtime diagnostic                                  |
| Physical staging phone               | Pending owner execution                                                                                                                                                                   | Mandatory before owner acceptance                             |

The automated receipt is retained outside Git at
`C:\Users\kkids\AppData\Local\ForeverTreasureCompanion\Homeport_Origin_Runs\20260807-124217\host-origin-regression-receipt.json`.
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

Because raw diagnostic tooling exposed the active Access session headers during
investigation, the owner should expire that Access session after acceptance.

## Remaining acceptance

On a physical phone through the staging URL, the owner must verify menu click,
Explore navigation, Sign In/Register/Forgot Password focus and typing, and one
synthetic authenticated Personal Harbor/workspace transition. Any failure keeps
the decision pending and must include route, action, visible state, and device
details. Automated readiness never changes the owner decision.
