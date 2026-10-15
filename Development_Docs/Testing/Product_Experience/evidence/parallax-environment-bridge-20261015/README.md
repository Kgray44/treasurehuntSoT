---
title: Parallax Environment compatibility browser attempts
audience: engineering
status: supporting-evidence-reviewed
canonical_for: parallax-environment-bridge-browser-20261015
last_reviewed: 2026-10-15
---

# Evidence boundary

The original [independent supporting review](independent-review.md) records
`BLOCK_WITH_EVIDENCE` for the first three attempts. The appended
[attempt-four review](independent-review-attempt-4.md) closes its preservation
evidence gap for the bounded synthetic journey. Earlier failed receipts and the
original report remain unchanged.

These are actual isolated production application screenshots and recordings with
synthetic accounts/rooms and an unpaid provider. Each directory's `run.json`
retains its exact source/tree/package identity and complete exit status. No
physical phone, room fidelity, whole Studio, protected or owner acceptance is
claimed. The source checkout and server used by the owner were untouched.

| Source         | Existing Library journey               | Pinned Environment copy journey                                        |
| -------------- | -------------------------------------- | ---------------------------------------------------------------------- |
| `03fd8a318c3b` | Passed                                 | Failed before UI in fixture release: TypeScript dynamic-import loading |
| `8e612f7ad96f` | Passed                                 | Reached copy dialog; failed Type label test locator                    |
| `cde8957a8f14` | Passed                                 | Copied/edited room; failed final serialized Scene comparison           |
| `ff98bce2b1a5` | Passed                                 | Passed exact stored-byte preservation, return, reload and reopening    |
| `d4512186bb9f` | Stopped at Source filter test selector | Passed exact stored-byte preservation, return, reload and reopening    |
| `45a6f23e379d` | Passed integrated Library journey      | Passed exact stored-byte preservation, return, reload and reopening    |

The first three FAIL attempts are retained. Attempt three compared serialized
objects with equal values but different key ordering. Attempt four deeply compares
Scene content and separately compares actual stored working-envelope bytes and
immutable Environment-envelope bytes before/after editing and again after return,
reload and reopening. Both production-browser journeys pass (2/2). Independent
review inspected all six PNGs and both recording chronologies at 4 fps before
frozen source and found no new blocker.

The local fourth attempt uses existing human continuation authority. It does not
reset protected review iterations or Crossdeck's separate history; the repository's
three-review-iteration limit is not a local browser-attempt counter. The original
report and its no-fourth-dispatch checkpoint remain historical records. Combined
Studio, protected, owner and physical-device acceptance remain pending.

Attempt five at `d4512186` introduces the integrated Library. The copy journey
passes all preservation and reopening checks. The second journey stops before
selecting its Source filter: exact label-text lookup does not match this nested
select label, while the failure snapshot exposes combobox **Source** and both
expected source options. Its overall receipt remains FAIL, with successful
task-owned cleanup. The test correction selects the accessible combobox by
role/name; it does not change the Library or weaken assertions. This failure is
separate from the earlier copy-preservation gap, which remains closed at attempt
four. Later integrated rendering still requires a passing source-bound run.

The concrete human objective is to open a Scene with a released Environment,
choose room editing, deliberately create an independent Environment copy, edit
and autosave it, and retain the original Scene and immutable Environment. The
bounded journey includes desktop 1440×1000 and phone-sized 390×844 layouts.
Phone-sized Chromium is not iPhone Safari or physical tracking proof.

The existing Library journey exercises discovery, organize/rename, explicit
Environment use, editing the original independently, archive/restore and reload.
Its successful earlier images do not relabel the failed copy-journey assertions.
Attempt four independently closes that bounded preservation gap.

Attempt six at `45a6f23e` passes both integrated Library journeys (2/2, 16.0 s).
The copy checks compare the actual stored Scene and immutable Environment
envelopes after editing and after returning/reloading/reopening the renamed copy.
The second journey uses the visible Source/Show comboboxes, organizes, applies,
edits, archives/restores and reloads an independent room while preserving the
Scene snapshot, and asserts Environments remains selected after workspace return.
Source binding and task-owned cleanup pass. Its six PNGs and two recordings have
been supplied for independent rendered review; that disposition is still pending.
The 390 px Library capture shows compressed global header controls and a scrollable
Library panel. It does not establish combined mobile Studio or phone AR acceptance.
