---
title: Product Experience Engineering activation closure
audience: engineering
status: current
canonical_for: product-experience-activation-closure
last_reviewed: 2026-10-16
---

# Product Experience Engineering activation closure

This engineering evidence record preserves activation of the experience gate
installed by [PR #714](https://github.com/Kgray44/treasurehuntSoT/pull/714).
The protected capture, authenticated review and installed verification passed
for source `6d13c357be93514c94e7f36db1a8c930265e65e2`.
The activation receipt records `ownerAcceptance=NOT_CLAIMED`.
Changed product candidates require their own applicable evidence and ordinary
Sounding Line decision.

The closure and its hosted records were retained on the evidence branch, rather
than included in that protected source checkpoint. This reconciliation restores
the expected closure location and links the preserved records at evidence
revision `93777825037040fd5b5db25f1e367d70c7726021`.
GitHub run and artifact metadata were initially checked on 2026-10-11 and
[reverified on 2026-10-16](../../Projects/Project_Crossdeck/evidence/r8-verification-20261016/activation-reconciliation/reverification.json).
The same three successful workflow/artifact identities were unexpired, with
January 2027 expiry. This restores the missing closure location without reopening
the activation program or using its historical proof as Crossdeck acceptance.

## Protected integration identities

| Checkpoint                                    | Exact identity                             |
| --------------------------------------------- | ------------------------------------------ |
| Original protected base                       | `678dd1156d39537d288ba3c2e5ce5c6efc2259d0` |
| Final integration base, incorporating PR #710 | `ee8caa83e79b6b5802f8773689e802705c5154d3` |
| PR #714 qualified candidate                   | `a11fb295832a41e820bf71b01c3a717ce461f370` |
| PR #714 protected merge                       | `1b550935ce9ede271e858faf37b9244437723dc0` |
| Candidate and merged tree                     | `bb0442cd37dd4a5ee523a3371fbb35ad27cb46f3` |
| Activation source after PR #715               | `6d13c357be93514c94e7f36db1a8c930265e65e2` |

The required [ordinary Sounding Line decision, run 38181745859](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38181745859)
passed for the qualified candidate against the final integration base.
PR #714 merged on 2026-10-11 at 22:48:34 UTC. The candidate and merged Git trees
were checked and match. The later activation source retains the subsequent
Parallax qualification records in PR #715.

## Installed activation and immutable artifacts

All three activation runs used `.github/workflows/sounding-line-ordinary.yml`
through `workflow_dispatch` on protected `main`, with actor `Kgray44` and exact
workflow source `6d13c357be93514c94e7f36db1a8c930265e65e2`.
Their completed conclusions are `success`.

| Stage                  | Protected run                                                                      | Artifact identity | Artifact name                                    |
| ---------------------- | ---------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------ |
| Refreshed capture      | [38182762332](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38182762332) | `11718023011`     | `product-experience-capture-6baba262a7ca0340`    |
| Authenticated review   | [38184309355](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38184309355) | `11718683388`     | `product-experience-review-6baba262a7ca0340`     |
| Installed verification | [38184457949](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38184457949) | `11719171730`     | `product-experience-activation-6baba262a7ca0340` |

The preserved [activation receipt](https://github.com/Kgray44/treasurehuntSoT/blob/93777825037040fd5b5db25f1e367d70c7726021/Development_Docs/Testing/Product_Experience/activation-proof/activation.json)
records `diagnostic=true`, `decision.status=PASS`, capture artifact
`11718023011`, review artifact `11718683388`, and provenance
`PROTECTED_WORKFLOW_AUTHENTICATED_SUBMISSION`. It also records
`missingEvidenceRejected=true` and `backendOnlyExempt=true`.
Preparation and diagnostic activation issue no required PR mainline decision;
the required integration decision is the separate ordinary run above.

The [effective gate probe](https://github.com/Kgray44/treasurehuntSoT/blob/93777825037040fd5b5db25f1e367d70c7726021/Development_Docs/Testing/Product_Experience/activation-proof/effective-gate.json)
records the installed ordinary planner rejecting an isolated UI specimen with
`PRODUCT_EXPERIENCE_EVIDENCE_MISSING`, while classifying an unrelated backend
specimen as `BACKEND_ONLY` and exempting it from experience capture/review.
Ordinary fallback test selection remains applicable. The probe records an
unchanged source head and no publication of its synthetic commits.

At reconciliation, all three artifacts were unexpired. GitHub metadata records
their expiry on 2027-01-09. Future qualification must check availability and
obtain fresh capture/review when required by the existing workflow.

## Historical capture and independent review

[Campaign evidence](Campaign_Evidence.md) retains its original local checkpoint
`93f1cc80584c5aa2cf15bc857d3476444c04b280` and source/product digest
`d5e1f66e0513a06cf247047c27049ff8b4e68225ca40642632f5f9df2daaf15c`.
The committed [local capture](evidence/local-93f1cc80584c/capture.json) and
[local review](evidence/local-93f1cc80584c/local-review.json) remain local
development proof at that identity. They are preserved separately from the
later protected activation records.

The preserved [hosted independent report](https://github.com/Kgray44/treasurehuntSoT/blob/93777825037040fd5b5db25f1e367d70c7726021/Development_Docs/Testing/Product_Experience/candidate-review.json)
binds the activation source and these exact review identities:

| Identity                  | Value                                                              |
| ------------------------- | ------------------------------------------------------------------ |
| Source/product digest     | `6baba262a7ca0340ceb85e7fd895908d126302966f9111c6bd399b7a48669a12` |
| Contract digest           | `98fbeda9cd33e7a771a42a171e33ae23dff549f00ba5943df130d905769b982e` |
| Review packet digest      | `d116aa970e8a9af647ec023dfe7185b692dc88088e373a7ef065a7b1b3d68fe7` |
| Contract                  | `homeport.transition.auth-routes`                                  |
| Builder context           | `/root`                                                            |
| Separate reviewer context | `/root/experience_visual_review`                                   |
| Review status             | `ACCEPTED`                                                         |
| Qualification scope       | `PROTECTED_MAIN_ACTIVATION_DIAGNOSTIC`                             |

The report records substantive observations across all 17 dimensions and no
unresolved blocking findings. It retains two optional findings:
`HOSTED-6D13C357-VIS-01` concerns recovery-link discovery effort, and
`HOSTED-6D13C357-VIS-02` concerns action capitalization consistency.
Their recorded severity is `NON_BLOCKING`; this reconciliation grants no new
acceptance or waiver.

## Scope and remaining acceptance

The protected activation proves the installed qualification path for the
representative anonymous account navigation: gateway to sign-in, recovery,
and return through visible keyboard-operated controls on desktop and mobile
Chromium viewports with reduced motion. The report preserves its recording
attribution and browser emulation limits. Mail delivery, live OAuth, successful
credential or reset submission, physical assistive technology and real mobile
hardware remain outside that navigation proof.

The existing [automatic workflow](../../../.agents/product-experience-workflow.md)
continues to govern UI changes. Independent graphical review runs in a supported
agent context; authenticated submission records technical provenance and does
not establish cryptographic model identity. Dedicated Admiralty profile
adapters still require supported provisioning.

Spatial experience repair and the current Crossdeck experience refit require
their own applicable rendered journeys, independent criticism and qualification.
The historical activation does not supply those completion states. No explicit
owner acceptance record was available in this reconciliation. `PRODUCT_ACCEPTED`
remains unclaimed, as recorded by the preserved receipt and both review records.
