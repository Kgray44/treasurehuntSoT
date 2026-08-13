---
title: Project Tideglass Phase 3 Completion Receipt
audience: product-engineering
status: current
canonical_for: project-tideglass-phase-3-completion
last_reviewed: 2026-08-13
---

# Project Tideglass Phase 3 completion receipt

Status: `ACCEPTED_MAINLINE`.

| Field                          | Accepted value                                                                                                                                                                                                       |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project / Phase                | Project Tideglass / Phase 3 — Choose the Passage                                                                                                                                                                     |
| Original base                  | `236c27241bb8d1630274f5d5412ec9addbdb8893`                                                                                                                                                                           |
| Qualified base                 | `4e88ba5463878e3b2cab8d03bb4471201bb1f039`                                                                                                                                                                           |
| Owner-reviewed source          | `c2fc8fcc414db4c2f3fab6108ba7c2e7becb16c6`                                                                                                                                                                           |
| Owner decision                 | Accepted 2026-08-12, including the explicit Wakebook Journey Detail addendum                                                                                                                                         |
| Final implementation candidate | `aa161a377f87a4cbdbc6a8f308cee25493962bc5`                                                                                                                                                                           |
| Authoritative decision         | [Run 31670646385](https://github.com/Kgray44/treasurehuntSoT/actions/runs/31670646385): `RELEASE_GO`                                                                                                                 |
| Authority evidence             | 38 mandatory receipts; no missing, duplicate, unknown, invalid, or runtime-conformance evidence; digest `85ebf2da23aff5162dc9437a029b11058b2c586b2c022261194c2df607d4c229`                                           |
| Protected binding              | [Run 31671905583](https://github.com/Kgray44/treasurehuntSoT/actions/runs/31671905583): passed                                                                                                                       |
| Protected integration          | [PR #68](https://github.com/Kgray44/treasurehuntSoT/pull/68), merge `634312adbf72a8a4279a755b20fb06957ced7e77`                                                                                                       |
| Record-only closeout           | [PR #79](https://github.com/Kgray44/treasurehuntSoT/pull/79), [run 31673540201](https://github.com/Kgray44/treasurehuntSoT/actions/runs/31673540201): `RELEASE_GO`, merge `0fb9dfe96e1d414b45edf1841198beeda40e9c27` |
| Prisma / migrations            | None                                                                                                                                                                                                                 |
| Phase 4                        | Not started; Harborlight, final Helm integration, historical-corpus hardening, distributed comparison work, observability, and localization remain deferred                                                          |

The protected merge parents are qualified base
`4e88ba5463878e3b2cab8d03bb4471201bb1f039` and exact implementation candidate
`aa161a377f87a4cbdbc6a8f308cee25493962bc5`. The integrated merge tree is
`d424a1c9038bbd917d0ea8108d9d1a20381c8c86`, equal to the candidate tree, and
the candidate is an ancestor of fetched protected main.

## Product and safety result

Phase 3 supplies the ordinary, discoverable **What Changed?** experience.
Chronicle Detail reaches edition comparison through visible controls; Passport
history and accepted Wakebook Journey Detail select the owner-bound exact played
edition and return safely to its record; and Creator Studio presents the
canonical `CREATOR_FULL` Tideglass projection rather than raw snapshot fields.
The human-facing route is `/chronicles/[taleSlug]/compare`, with the exact
history redirect at `/passport/history/[recordId]/compare`.

The result uses Phase 1/2 semantic, policy, change-code, projection, summary,
and annotation contracts without redefining them. Client state can select and
render only server-authorized edition projections; it cannot widen audience,
fetch raw snapshots, reveal withheld spoilers, or read a foreign history record.
Comparison remains read-only for live Voyages, personal history, published
editions, annotations absent an explicit mutation, and Captain operations.

The accepted source includes source/target selection and swap, authoritative
recommended-edition comparison, exact played-history selection, multiple
playthrough choice, up-to-date, historical, partial/redacted, no-change,
failure/retry, concise/detailed, filtering, explicit spoiler disclosure,
compatibility and accessibility presentation, responsive layout, keyboard,
reduced motion, effective 200% zoom, and serious/critical Axe findings of zero.
The source-bound synthetic A--K journey evidence is recorded by
`Project_Tideglass_Phase_3_Visual_Evidence_Manifest.json` (fixture checksum
`7798f816bedd71867d096d0543ee2135a7722388f262d089b4b078d9a50b2002`).

## Consumer and catalog disposition

The legacy Studio `comparePublishedVersions` product consumer is retired: the
ordinary published-version path renders `TideglassStudioComparison`, whose
tests cover branch rewire, ending, Captain requirement, captions, annotations,
and safe technical disclosure. The relevant Deepwater underutilization finding
remains open until its own governed owner records formal closure; Tideglass
provides the tested consumer evidence but does not self-close it. Helm has no
accepted ordinary edition/preflight comparison surface, so
`CAPTAIN_UI_DEFERRED_NO_ACCEPTED_CONSUMER` remains an explicit Phase 4 handoff.

FT-B009 truthfully records **Project Tideglass Phases 1-3**, including the
ordinary comparison route, Edition selection, Compare to recommended, Compare
to What I Played, history and Chronicle entries, and Studio semantic comparison.
No additional Tideglass feature fragment is required for this closeout.

## Record-only closeout result

The local post-merge observation on `634312ad` was terminal
`EVIDENCE_INVALID` solely because generated `FEATURE_CATALOG.md` still carried
the previous `4e88ba54` audit provenance. The hosted sealed authority and
protected merge remain valid; all Tideglass-specific receipts were clean. The
runtime was released (exclusive lock access, ports 3100/3101/3102/3200 free,
and no authority process). Governed record-only PR #79 then accepted exact
candidate `7c3da7a902d69372cd49db66ff745e2bcd4f4c27` over `634312ad`: its sealed
finalizer returned `RELEASE_GO` with one clean `record-only.closure` receipt and
evidence digest `f3bac06ae94128bb99c403db6fda1a1d4b79ab6b23fef9e9bdba7557c2b13cf3`.
It protected-merged as `0fb9dfe96e1d414b45edf1841198beeda40e9c27`; merge tree
`04a610e6ab892d0e075b49c0675858f0bb95a5ac` equals the record candidate tree.
This closure neither retried nor widened the product authority.
