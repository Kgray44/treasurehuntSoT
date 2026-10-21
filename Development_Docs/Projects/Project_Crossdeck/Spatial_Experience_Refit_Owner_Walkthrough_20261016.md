---
title: Crossdeck refit phone walkthrough and software evidence
audience: product-engineering
status: current
canonical_for: crossdeck-refit-owner-walkthrough-20261016
last_reviewed: 2026-10-16
---

# Bring a phone into the Chronicle

Use a build containing [PR #721](https://github.com/Kgray44/treasurehuntSoT/pull/721).
Enter an active Chronicle on the main screen and choose **Connect another device**
in the Journal. Scan the QR with the phone or choose **Use a code instead**.
Sign in with the same Voyagewright account on the phone, then join the Chronicle.
The connection dialog stays inside the adventure; **Continue the Chronicle**
returns the main screen to the book. Personal Harbor remains available for
device preferences and session security.

On the phone, open **Change companion purpose**. Ordinary choices are Chronicle
Lens, Voyage Chart, Journal companion and Continue the Chronicle. **More purposes**
contains the released artifact viewer and restricted crew display. A purpose
that needs unreleased content explains why it is unavailable. Purpose switching
preserves the authorized person and Voyage without another pairing ceremony.

| Purpose                | What it provides                                                        | Actual boundary                                                                |
| ---------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Chronicle Lens         | The published spatial clue and its interactions in Parallax Guided View | Browser evidence does not qualify camera/world tracking or native placement    |
| Voyage Chart           | The canonical Landfall Living Chart and current objective               | Requires a released Chart; location sensing remains capability-dependent       |
| Journal companion      | Released passages and reading-size controls                             | Reading a prior passage does not rewind canonical progress                     |
| Continue the Chronicle | The full Journal and canonical progression controls                     | Current-objective navigation remains distinct from remembered reading position |
| Artifact viewer        | A released artifact with room for its content and actions               | Unreleased artifacts remain unavailable                                        |
| Crew display           | Content deliberately shared with the crew                               | Private notes and personal views remain restricted                             |

Atmosphere, Captain companion, Accessibility companion and Creator preview explain
their current limitations rather than offering a false dedicated mode. Existing
Captain, accessibility and Creator tools retain their owning workspaces.

## Send, receive and return

From a released map, note or artifact, choose **Send to...**, select an active
device and send the view. The destination's **Receive** action opens the content;
pending delivery and acknowledged completion remain separate. Private notes ask
for confirmation. Decline, cancellation, expiry and unavailable destinations
retain understandable recovery, and **Recover view here** restores eligible
personal views when the controlling device is gone.

**Return to Chronicle** opens the full Journal for the same Voyage. If it resumes
an earlier reading position, **Return to Current Objective** takes the reader to
the latest passage. Continue Voyage uses the existing One Voyage progression
authority. Connected views use the existing committed-event notifications and
periodic reconciliation; no new synchronization or progression engine is added.

## Evidence and acceptance

The [R8 verification record](Spatial_Experience_Refit_R8_Verification_20261016.md) binds protected preparation18, independent review 7 accepting all seven contracts / 119 dimensions and [authenticated submission3](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38913515007). The [actual gallery](evidence/r8-verification-20261016/gallery/README.md) links fresh screenshots and participating-device recordings. Exact ordinary qualification, protected integration and landed verification are recorded with PR #721. Product-owner acceptance remains unclaimed.

The independent review retains one nonblocking concern: returning to the full phone Journal exposes dense header/replay controls before the reading area. Scrolling still reaches the passage and Continue Voyage remains usable. Normal captures used an animated-opening fallback; reduced captures retained a readable page-turn fallback. The evidence does not establish that every cinematic opening completed.

Paired devices used canonical preauthenticated synthetic sessions before actual UI joining; a full phone password-entry roundtrip is outside that pairing proof. Event-stream HTTP 429 observations after controlled outage/reload are retained with functional delivery/recovery outcomes. These are reviewed software limits, not physical-device or deployment guarantees.

Synthetic persisted Voyages and Chromium desktop/mobile/medium/landscape viewports
establish software behavior within the captured scope. Real phone scanning,
physical touch, assistive technology, field conditions, native camera placement
and product-owner acceptance retain their own verification. This refit does not
complete all Crossdeck phases, Air Handoff, Reach or unrelated Parallax work.
