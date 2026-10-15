---
title: Independent Environment bridge experience review
audience: engineering
status: qualification-blocked
canonical_for: parallax-environment-bridge-independent-review-20261015
last_reviewed: 2026-10-15
---

# Independent supporting review

Recorded from the separate `studio_foundation_review` reviewer context by the
builder. Reviewer inspected media before frozen source and made no file, runtime,
Git or original-evidence changes. This is supporting review provenance, not a
protected decision or owner acceptance.

**Disposition: BLOCK_WITH_EVIDENCE.** No confirmed visible product blocker or
changed Scene content was found. All three overall receipts remain FAIL. The
existing Library journey passed in each attempt.

Reviewed candidate: `cde8957a8f1436387f5528f89949e0abb695e32c`.
Tree: `ef6983d29ebff2c251b7307ac0385d285c8e18db`.
Independent Git comparison found no `src` changes from `8e612f7ad96f`.

## PX-BRIDGE-PRESERVATION-EVIDENCE-01

Qualification blocker; no established product defect. Reviewer independently
decoded Expected/Received from the final browser log: both are 14,148-character
Scene documents with deeply equal values. Only key order at `$.content` and
`$.content.studio` differs. No geometry, identity, binding, checksum or metadata
value changed. The frozen test failed its serialization comparison before reaching
the immutable Environment release-envelope assertion. It did not capture actual
pre/post persisted Scene envelope bytes. Therefore semantic Scene preservation is
supported, but stored-byte and immutable-release preservation are not established
by the complete journey. Copy-workspace return/reload was not demonstrated.

The pending harness correction compares content structurally and separately
captures stored envelope bytes. It remains unrun. No fourth browser dispatch,
counter reset or product persistence/geometry repair is justified by this finding.
Later combined qualification must close the remaining assertions.

## Dimensions observed

| Dimension    | Observation and limit                                                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Composition  | Desktop central dialog and phone-width dialog keep the decision together; phone workspace stacks canvas above fields.                            |
| Hierarchy    | Scene source, explanation, Type/Destination and Create form an understandable sequence; copied workspace has its own name.                       |
| Typography   | Native screenshots show readable text/labels; phone explanatory copy is dense but fits.                                                          |
| Spacing      | Visible phone margins and separated fields/action; no demonstrated dialog overlap.                                                               |
| Controls     | Explicit Create succeeds. Workspace exposes Back/Undo/Redo/Library/Save as/Versions; broader controls not exercised here.                        |
| Contrast     | Dark text/background/control boundaries readable; no fresh light-theme qualification.                                                            |
| Consistency  | Existing blue Library/workstation family and established independent workspace.                                                                  |
| States       | Original Scene, copy dialog, preparation, rendered workspace, renamed definition and saved feedback observed; no copy error/retry demonstration. |
| Responsive   | 1440×1000 desktop and 390×844 phone dialog fit. No onscreen keyboard, landscape or Safari evidence.                                              |
| Keyboard     | Native controls support keyboard semantics; full traversal not demonstrated.                                                                     |
| Focus        | Name field receives editing focus; focus trapping/return not independently demonstrated.                                                         |
| Feedback     | New identity and Working draft saved confirm the demonstrated operation; no visible application error accompanies the test assertion failure.    |
| Motion       | Sampled chronology supports preparation-to-room continuity; no new motion-preference comparison or precise latency qualification.                |
| Continuity   | Copied features/empty release history pass before failure; Scene content unchanged in failure payload. Byte/release closure incomplete.          |
| Complexity   | Independent-edit explanation avoids pin-schema knowledge; two paragraphs add reading load but are not a blocker.                                 |
| Role outcome | Creator creates/renames a separate Environment; entire preservation journey remains unqualified.                                                 |
| Fallback     | Explicit copy replaces direct pinned editing; legacy/no-room/backend-failure states not visually exercised.                                      |

## Actual media inspected

Reviewer inspected all 11 retained PNGs and sampled start-to-end chronology of all
six recordings at 2 fps, with denser 8 fps inspection of the final copy transition.
This is sampled chronology, not frame-by-frame playback.

- `03fd8a318c3b`: blank copy recording/failure still supply no positive UI proof;
  Library chronology is meaningful.
- `8e612f7ad96f`: copy recording reaches the desktop dialog and stays there;
  Library chronology is meaningful.
- `cde8957a8f14`: desktop/phone copy stills and copy chronology show creation and
  rename in the independent rendered workspace. The failure screenshot proves its
  visible terminal state, not PASS. Library chronology shows organize/use/edit/
  return/archive/restore/reload and phone Library.

Reviewer independently verified all six recording hashes against their `run.json`
records. Final run receipt SHA256:
`1142e0f07aff72cba438283b839969c4a231d588bf36e20e89ce67ba3c91bfd1`.
Final browser-log SHA256:
`d82e47e6b0534928234fd934aaa5a3199a76a44dacfe241884a698a2c52962a3`.
The full log remains in the isolated D-drive attempt directory; no private owner
photos, credentials, endpoint data or existing live database is included here.

Prior bounded domain findings/resolutions remain in the integration handoff.
These unpaid synthetic production Chromium observations do not grant owner,
physical-device, room-fidelity, whole-Studio or protected-integration acceptance.
