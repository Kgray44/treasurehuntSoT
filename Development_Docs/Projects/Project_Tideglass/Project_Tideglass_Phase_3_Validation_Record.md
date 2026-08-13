---
title: Project Tideglass Phase 3 Validation Record
audience: product-engineering
status: current
canonical_for: project-tideglass-phase-3-validation
last_reviewed: 2026-08-13
---

# Project Tideglass Phase 3 validation record

Status: `ACCEPTED_MAINLINE`.
The original product decision and the explicit Wakebook Journey Detail addendum
acceptance are recorded; protected integration and the record-only closeout are
complete.

The reconciled product source is
`c2fc8fcc414db4c2f3fab6108ba7c2e7becb16c6`, subsequently reconciled to accepted main
`541e914f481883200569f8cc7ec5ec9428d7cbb7`. Phase 2's accepted merge
`3219fd1b5598d1997b7f85d641f2f3cb1fe3f1b3` is an ancestor of that mainline.

| Evidence                                                  | Result                                                      | Boundary                                                                                                                                         |
| --------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run tideglass:phase3:validate`                       | PASS                                                        | Source-contract validation; no release authority dispatched.                                                                                     |
| Focused Tideglass, Passport, navigation, and Studio tests | PASS: 138 tests / 19 files                                  | Development verification of the passage, history ownership, semantic Studio cutover, return safety, performance, and component behavior.         |
| `npm run db:generate && npx tsc --noEmit`                 | PASS                                                        | Generated Prisma client refreshed for accepted Drydock schema; no Prisma schema or migration changed.                                            |
| `npm run tideglass:phase3:journeys`                       | PASS: real production build plus visible-entry journeys A-J | Task-owned synthetic SQLite, one isolated Chromium worker, mobile, keyboard, effective 200% zoom, reduced motion, and Axe serious/critical zero. |

The fixture uses only reserved synthetic accounts and Chronicle content. Comparison is read-only: the suite does not change a published edition, a live Voyage, a Wayfarer history record, an annotation, or canonical `prisma/dev.db`. It also verifies foreign history denial, server-derived audience, bounded return paths, and absence of raw snapshot product output.

The owner accepted this reconciled product on `2026-08-12`; the accepted reviewed
source is recorded in `Project_Tideglass_Phase_3_Owner_Decision_Record.md`.
The original product subsequently received its governed release evidence and
entered protected main as `bb7676a75581d8d415c3ff7712cc38bc8decb031`. The
record-only closeout merged at `0fb9dfe96e1d414b45edf1841198beeda40e9c27`
after its sealed `RELEASE_GO` receipt, so this document records the
accepted-main state. No Deepwater finding closure, deployment, or Phase 4 work
has been started.

## Current accepted-Wakebook reconciliation

Wakebook Phase 1 at `cbf634d4d5db9cf47edebb89e005e8cc910068bd` replaces the
old Passport detail with Journey Detail; current `origin/main`
`770404dd11cdfc1b86658a488979c43c22ed1711` adds accepted Deepwater/Helm/Homeport
work without direct Tideglass or Wakebook product-source overlap. The
new Tideglass-owned adapter preserves the exact owned-history handoff without
copying a checksum, raw snapshot, annotation, or semantic record into the
Wakebook DTO. Focused proof is 34 tests across the direct Tideglass and
Wakebook files, plus passing `npm run tideglass:phase3:validate`, TypeScript,
documentation, catalog, and targeted lint/format checks. A fresh task-owned
production A-K browser journey passed for source
`e99bbe3174a6d0c94c88ef6cc7b4f33c4eff28d0`; it includes the direct Journey
Detail entry capture, exact-record return, privacy assertions, mobile,
reduced-motion, effective 200% zoom, and Axe serious/critical zero. This is
still local, non-authoritative evidence only; the owner explicitly accepted the
addendum, and candidate freeze is next.

The full `npm run homeport:validate` qualification initially exposed three
missing required `notes` fields in existing Wakebook-owned API inventory records
and one `AccountSession` model-name reference where the governed Journey catalog
requires authority ID `HP-SES-001`. The narrow metadata repair passed the full
Homeport contract, reachability, surface, visual, accessibility, and host-origin
validation stack. It does not change a product route, visibility, capability,
or Tideglass behavior.

## Hosted authority failure and focused repair

Hosted `Sounding Line / Mainline Decision` run `31658984596` was explicitly
bound to candidate `a70e9f6c6800249f21f8aa9edca322a4a4e39369`, PR `#68`, and
base `770404dd11cdfc1b86658a488979c43c22ed1711`. It ended `RELEASE_NO_GO`.
The plan, runtime conformance, 18 other wave-0 workers, and access-sentinel
browser worker passed. The sole failure was `unit.feature-catalog`, whose sealed
receipt identifies the stale FT-B009 expected program label in
`scripts/features/feature-catalog.test.ts`.

The smallest registered reproduction failed 1/9 with the same assertion. The
single-string expectation repair passes the same focused test 9/9 plus
`npm run features:sync` and `npm run features:validate`. This is a repair of a
governed test expectation, not a semantic, product, or authority-policy change.
The hosted authority run has completed and released its lane; no retry is
authorized until current-main requalification and a new frozen candidate exist.

## Reconciled current-main qualification

After explicit infrastructure-lane release, PR `#69` reached protected main as
`d3ed7c4cd1877be601e6854b376cb1dd9eb668a3`. The three-file advance changes
only Sounding Line's protected-binding workflow, finalizer source, and
record-only test. The Tideglass branch reconciled it as `89fb1df6`; no
Tideglass, Wakebook, Wayfarer, Studio, route, schema, policy, or navigation
source changed.

On that reconciled source, Tideglass unit/history/Studio suites, typecheck,
lint with zero errors, format, documentation, Feature Catalog, Tideglass
contract, and full Homeport validation pass. The registered task-owned
production browser wrapper passes A--K for `89fb1df6`, with the same synthetic
fixture checksum and zero serious/critical Axe findings. Its only runtime data
is under `%LOCALAPPDATA%\\ProjectTideglass\\phase3-qualification`; canonical
`prisma/dev.db` remains untouched. No replacement authority has been dispatched.

Deepwater record-only closure `582f32a3` subsequently advanced main. Its diff
contains only Deepwater governance records, documentation inventory, and
generated catalog provenance. Tideglass contract, documentation, and catalog
validation reran on the reconciled source; the product/browser source is
unchanged, so the task-owned A--K result above is retained without an
unnecessary shared-runtime rerun.

Admiralty record-truth repair `95cff272` then advanced main with only Admiralty
records, catalog fragment/provenance, and Ledgerlight documentation changes.
The affected documentation/catalog and Tideglass contract checks reran cleanly;
the Tideglass browser source remains unchanged, so no duplicate browser run was
required. No replacement authority has been dispatched.

## Shipwright shared-Studio reconciliation

Accepted Shipwright Phase 2 at `25a5ecc3` changes the Studio UI and therefore
invalidates only the Tideglass browser evidence that enters Studio. Static audit
confirms `TaleEditor` still invokes the canonical Tideglass version comparison
endpoint and renders `TideglassStudioComparison`; direct Tideglass Studio
component/API tests pass. The Shipwright-owned large-editor/focus tests exceed
their 5-second defaults but pass under a 30-second diagnostic timeout, so the
observed issue is a test-budget boundary rather than a semantic comparison
failure. The refreshed A--K task-owned production browser journey passes on
`622ee2bcba025ddffd557aa0437af5c671d56b06`, including the accepted Journey
Detail entry, current Studio semantic comparison, privacy, mobile, keyboard,
reduced motion, effective 200% zoom, and zero serious/critical Axe findings.
Wakebook Phase 1 then protected-merged documentation/catalog/registry-only
source at `0cdaa802`. The branch merges it as `836ef9d3`; its interval has no
Tideglass runtime, route, schema, or Tideglass-test source. Tideglass 109/109,
direct Journey Detail/history handoff 24/24, Studio 2/2, contracts, Prisma
generation/typecheck, lint with zero errors, formatting, documentation, and
Feature Catalog validation pass on that source. No replacement authority has
been dispatched; the candidate awaits an explicitly assigned serialized slot.

## Shared-format qualification boundary

After Shipwright's record-only closeout protected-merged at `9867e3d4`, the
focused Tideglass/Wayfarer/Wakebook/Studio suite passes 136/136 across 19 files,
including all 18 `TaleEditor` cases. Contracts, Prisma generation/typecheck,
lint with zero errors, documentation, and Feature Catalog validation pass. The
only failed qualification command is `npm run format:check`, which identifies
only Shipwright-owned accepted-main closeout documents. Tideglass has handed the
exact paths to Shipwright and will not edit cross-project accepted records or
dispatch authority before the owner supplies a narrow repair.

Shipwright's narrow repair protected-merged at `4e88ba54`; it restores the
global formatting gate without changing Tideglass runtime, route, schema, or
test source. `npm run format:check`, Tideglass contracts, documentation, and
Feature Catalog validation now pass on the reconciled source. The retained
136/136 semantic/history/Studio proof and source-bound browser proof remain
valid; one fresh Tideglass Mainline Decision is now permitted when the exact
candidate and free serialized lane are rechecked.

## Authority preflight and focused repair

The first local Mainline Decision invocation for documentation candidate
`897e7619d1c110824a22b93c9e7c5ecef24989aa` ended before a suite receipt or
finalizer decision. Its exact preflight failure was
`ENOENT ...\\prisma\\dev.db`: this owned worktree intentionally has no baseline
database. It is recorded as an infrastructure preflight failure, not as a
passing decision or a product-test result.

The repair created a fresh task-owned baseline at
`%LOCALAPPDATA%\\ProjectTideglass\\phase3-mainline-authority\\baseline-897e7619.db`
from the canonical database as an immutable copy. The canonical source hash,
the clone hash before focused proof, the canonical hash after focused proof,
and the clone hash after focused proof were all
`54647911F63C6A55E5C6B6C95E5EC0A2977B4580A42DE073C8C503A3D8C7A412`.
The non-authoritative, registered focused repair command
`node scripts/sounding-line/authority.mjs mainline --suite browser.access-sentinel --execute-only`
then passed all 3/3 access-sentinel cases with runtime conformance `PASSED`.
Only this infrastructure proof is carried forward; the next frozen candidate
must receive one replacement full Mainline Decision using that task-owned clone.

## Post-owner accepted-main reconciliation

The `4edc8de5..541e914f` advance contains Admiralty closeout documentation and
the accepted `4b346397` Helm browser-test stabilization only. No Tideglass route,
API, service, semantic, policy, schema, Studio consumer, or Chronicle/Passport
source changed. A direct product-path comparison against owner-reviewed
`c2fc8fcc` passed. The shared validation lane was occupied when the required
focused `browser.helm` rerun was requested, so it produced a governed
`validation-runtime.lock` refusal before any test was discovered or executed.
The lock was owned by another active process and was neither removed nor treated
as a product failure. After the governed lane released it, the focused command
passed all 3/3 `browser.helm` cases in its owned runtime (run
`validation-20260812T151554539Z-c62d2dc891ea`) with runtime conformance
`PASSED`. The canonical and task-owned baseline hashes remain
`54647911F63C6A55E5C6B6C95E5EC0A2977B4580A42DE073C8C503A3D8C7A412`.
The reconciled replacement candidate is now frozen for its one full authority
attempt.

## Hosted authority failure and registry repair

Hosted run `31634707413` was explicitly bound to PR `#59`, base
`541e914f481883200569f8cc7ec5ec9428d7cbb7`, and candidate
`3c03e7a1f0aaab79ad725cacd00fb3e4036b4f41`. It failed in the **Plan** job
before any worker suite, plan artifact, finalizer, or acceptance envelope was
created. The exact error was `TIDEGLASS_PHASE3_TASK_ROOT is required` while the
governed registry asked Playwright to list tests. The browser spec read its
task-owned execution variables at module import time, which is invalid during
environment-free registry discovery. This is an authority-infrastructure
failure, not a semantic, product, privacy, or browser-journey failure.

The failure was reproduced locally with the same environment-free
`node scripts/sounding-line/test-registry.mjs` command. The repair defers the
three required Tideglass runtime variables until Playwright `beforeAll`; normal
execution still fails closed before any test if the task-owned fixture contract
is absent. The focused registry command then passed, `npx tsc --noEmit` passed,
and `npm run tideglass:phase3:journeys` passed from a fresh synthetic fixture
at `%LOCALAPPDATA%\\ProjectTideglass\\phase3-final-dbbe2c49` for source
`dbbe2c49aa884f6a5e078cfa3c5df580344ca221`. It rebuilt production and passed
the visible A--J journey (including Axe serious/critical zero, mobile,
keyboard, reduced motion, and effective 200% zoom). The task-owned fixture
again reported the canonical database as untouched.

This repair supersedes the failed hosted attempt. The next authority dispatch
must target a newly frozen, documentation-qualified SHA exactly once; the
failed run must not be retried.

## Final current-main reconciliation

Before the repaired freeze, fetched `origin/main` advanced from
`541e914f481883200569f8cc7ec5ec9428d7cbb7` to
`08ab5cedbcd16bf421b03b638af5c3513fe02019` through accepted Admiralty record
PR `#57`. The intervening files are generated Feature Catalog provenance,
Ledgerlight documentation inventory, and Helm browser-test stabilization only.
There is no Tideglass product, policy, API, route, navigation, schema, Studio,
Wayfarer, Wakebook, Shipwright, or Captain-consumer overlap. The branch merged
this accepted mainline change without a source conflict. The owner-reviewed
Tideglass product-path comparison still passes. The registry and Feature Catalog
provenance were regenerated, and the affected `browser.helm` focused suite
passed all 3/3 registered cases with runtime conformance `PASSED` (run
`validation-20260812T160328209Z-a9cdb9cbddc0`).

Accepted main then advanced through Helm Phase 2 and the Sounding Line
record-only closure to `fb0f13e35fcdd98434d22c357aee02f24d6d9036`. Helm changes
the accepted Player/Captain handoff and its own records; record-only changes the
governed authority/binding implementation and records. Neither interval changes
Tideglass routes, APIs, services, Chronicle/Passport presentation, Studio
semantic consumer, policy, schema, or navigation. The product-path comparison
against owner-reviewed `c2fc8fcc` remains clean; current registry discovery
passes with 2092 definitions, and Tideglass contract, TypeScript,
documentation, catalog, and formatting checks pass before the new freeze.

# Protected integration and post-merge observation

The frozen implementation candidate
`aa161a377f87a4cbdbc6a8f308cee25493962bc5` received hosted Sounding Line
Mainline Decision [`31670646385`](https://github.com/Kgray44/treasurehuntSoT/actions/runs/31670646385)
with finalizer `RELEASE_GO`. Its sealed acceptance envelope records plan digest
`1d261623d02e9bc447ece8db33569a9c9efb9270f0f785bbda0959e231f432c3`, policy
digest `2da4d0e462d36d1b8c98d526fba0b2d6d09cd4da4f9dd518a4458549360c68e0`,
inventory digest `ec5576034e6d05b80863e8df65ae8c91fdbcf5fcc371d42ceecfa8cb970f27e3`,
and evidence digest
`85ebf2da23aff5162dc9437a029b11058b2c586b2c022261194c2df607d4c229`.
All 38 mandatory receipts and runtime-conformance records are present and
clean. Protected binding [`31671905583`](https://github.com/Kgray44/treasurehuntSoT/actions/runs/31671905583)
then passed before PR #68 merged as
`634312adbf72a8a4279a755b20fb06957ced7e77`. Its parents are exact qualified
base `4e88ba5463878e3b2cab8d03bb4471201bb1f039` and exact candidate `aa161a37`;
integrated tree `d424a1c9038bbd917d0ea8108d9d1a20381c8c86` equals the candidate
tree.

One local exact-main observation was then attempted with source identity
`634312ad`. It is terminal `EVIDENCE_INVALID`, not a new product authority and
not eligible for retry: its sole invalid receipt was `unit.feature-catalog`,
which correctly found that generated `FEATURE_CATALOG.md` retained the prior
`4e88ba54` audit provenance. Every Tideglass receipt is clean. The smallest
registered reproduction is `npm run features:validate`, which reports exactly
that stale generated file. The narrowly correct response was a record-only
catalog/record closeout, not a source change or a repeated Mainline Decision.
PR #79 then received sealed record-only `RELEASE_GO` through run `31673540201`,
with one clean closure receipt and evidence digest
`f3bac06ae94128bb99c403db6fda1a1d4b79ab6b23fef9e9bdba7557c2b13cf3`, before
protected merge `0fb9dfe96e1d414b45edf1841198beeda40e9c27`. The process exited;
`validation-runtime.lock` was exclusively openable and ports 3100, 3101, 3102,
and 3200 were free.
