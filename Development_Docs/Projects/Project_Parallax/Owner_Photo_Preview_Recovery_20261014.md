---
title: Owner photo preview recovery and live canaries
audience: product-engineering
status: partial-verification
canonical_for: parallax-owner-photo-preview-recovery-20261014
last_reviewed: 2026-10-14
---

# Configuration correction

The resumed owner server had OpenAI configured but omitted the private-content
storage root, local master key and scanner selection. The disabled photo setup
accurately reflected that configuration failure. The new
`scripts/parallax/resume-owner-studio-preview.ps1` reuses the existing isolated
owner database and loads persistent, database-scoped local private media settings.
The Windows user OpenAI variable stays in process memory. The local media master
key is persisted outside the checkout under CurrentUser DPAPI protection.

The current-user discretionary ACL is applied through DirectoryInfo rather than
PowerShell Set-Acl, which required an unavailable security privilege on this host.
Repeated CheckOnly launches reuse the same encrypted key file. Only the verified
3130 process was stopped and resumed; the phone server and HTTPS tunnel remain
running. Saved owner scenes were not reset or reseeded.

The existing synthetic development scanner is explicitly reported as uncertified
malware protection. This is an owner-authorized local development configuration,
not production private-provider qualification. Camera tracking, image accuracy
and owner acceptance are separate from import readiness.

# Actual browser and live-provider observations

Authenticated Library → Environments → plus → From photos renders an enabled
file input. Two supplied owner photos are accepted. The reconstruction button
remains disabled until explicit processing consent. Actual private imports
return 201; no mock OpenAI response or replacement geometry is used.

| Attempt                               | Result                                                                                       | Accounting                                |
| ------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Two photos, original 20-second policy | Upstream timeout; scene unchanged                                                            | UNKNOWN exposure USD 0.003500000 retained |
| Two photos, 90-second policy          | Live response settled; geometric clarification for chair support and overlapping wall panels | USD 0.002435300 settled                   |
| One photo, 90-second policy           | Live response settled; wall-mounted panel too far from a modeled wall                        | USD 0.001719400 settled                   |

The timeout correction used the canonical Admiralty preview, password assurance
and audited execute endpoints. Only timeout changed; request allowances, models
and spending ceilings did not. The three manually initiated requests used Luna;
there were no automatic retries, Astra calls or escalations. Settled additional
usage is USD 0.004154700; conservative additional exposure is USD 0.007654700.
Against the retained prior task upper bound of USD 3.757200805, the new
conservative upper bound is USD 3.764855505, leaving USD 1.235144495 under the
owner's USD 5 ceiling. Unknown usage is not released or assumed free.

The [safe spending record](evidence/openai-photo-resume-spend-20261014.json)
preserves this accounting separately from the earlier reconciliation snapshot.

No client exceptions were observed. These runs do **not** establish a valid new
3D room proposal, successful Apply/reload, improved orientation, or reconstruction
fidelity. The existing authored room was not replaced after failed inference.
Raw photos, private provider paths, credentials, auth state and raw responses are
excluded from this public record.

# General floor-support correction

The mapper previously resolved declared wall, ceiling and furniture attachments
but skipped FLOOR. Initial explicitly floor-standing observations can now resolve
height gaps up to 0.15 m onto the declared floor. Horizontal placement, yaw and
dimensions remain intact. Adjusted height is marked inferred, confidence capped,
and a review warning retained. Larger gaps fail; existing-room refinement is
untouched. Parameterized tests cover tables, desks, chairs and cabinets.
This correction is independent of the supplied room's particular layout; it
does not resolve the wall-panel failures observed in these live runs. No live
call has yet qualified the floor correction.

Full-Studio acceptance, protected integration and real-device browser AR remain
unfinished. This document is engineering evidence for a narrow recovery, not
an accepted product-experience package or a completion declaration.
