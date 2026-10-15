---
title: Parallax Environment compatibility browser attempts
audience: engineering
status: evidence-pending-review
canonical_for: parallax-environment-bridge-browser-20261015
last_reviewed: 2026-10-15
---

# Evidence boundary

The [independent supporting review](independent-review.md) records
`BLOCK_WITH_EVIDENCE` for final preservation qualification and no confirmed visible
product blocker. It does not convert any failed receipt to PASS.

These are actual isolated production application screenshots and recordings with
synthetic accounts/rooms and an unpaid provider. Each directory's `run.json`
retains its exact source/tree/package identity and complete exit status. No
physical phone, room fidelity, whole Studio, protected or owner acceptance is
claimed. The source checkout and server used by the owner were untouched.

| Source         | Existing Library journey | Pinned Environment copy journey                                        |
| -------------- | ------------------------ | ---------------------------------------------------------------------- |
| `03fd8a318c3b` | Passed                   | Failed before UI in fixture release: TypeScript dynamic-import loading |
| `8e612f7ad96f` | Passed                   | Reached copy dialog; failed Type label test locator                    |
| `cde8957a8f14` | Passed                   | Copied/edited room; failed final serialized Scene comparison           |

All three attempts are retained. The final comparison's parsed objects have no
differences; property ordering differs. The next test revision compares parsed
Scene content and separately captures/compares the actual stored working
envelope bytes. That revision has **not** been browser-verified. Original failed
results must not be relabeled PASS. No fourth capture or repair-budget reset is
performed by this record; independent review and later combined verification
remain pending.

The concrete human objective is to open a Scene with a released Environment,
choose room editing, deliberately create an independent Environment copy, edit
and autosave it, and retain the original Scene and immutable Environment. The
bounded journey includes desktop 1440×1000 and phone-sized 390×844 layouts.
Phone-sized Chromium is not iPhone Safari or physical tracking proof.

The existing Library journey exercises discovery, organize/rename, explicit
Environment use, editing the original independently, archive/restore and reload.
Its successful images do not discharge the failed copy-journey assertion.
