# Vision Waypoint Creator Guide

## Start and resume

1. Sign in as a creator.
2. Open **Studio → Vision Waypoints**.
3. Search or filter the reusable Library, or create a draft.
4. Open **Resume authoring**. The server restores the last saved step and revision.

The header says `Unsaved changes`, `Saving…`, or `Saved`. Wait for `Saved` before changing steps. **Save and continue** validates and completes the current step.

## Capture safely

Open the Companion step first and review privacy. Desktop uses the integrated Companion; browser requires explicit local pairing. In a recording step:

1. Connect to Companion.
2. Refresh capturable windows.
3. choose the exact game window;
4. start, pause/resume, and stop;
5. wait for the Studio manifest-save confirmation.

If Studio saving fails, the recording remains in Companion-managed local storage and the UI says so. Do not assume it is attached to the waypoint until it appears in Recording review.

## Curate evidence

Recording review supports:

- local preview and export;
- name, notes, evidence role, and usable/unusable state;
- non-destructive trim ranges and logical split ranges;
- replacement capture;
- dependency-safe deletion.

`Local only`, `upload authorized`, and verified-integrity labels are facts from persistence metadata. They are not sync promises.

## Accepted area and boundaries

Record a guided accepted-area walk, then enter plain rules. Creator units are provisional relative planning values—not surveyed Sea of Thieves coordinates. Add a boundary/excluded region and state why it should fail.

Story-Critical waypoints cannot prepare BuildInput without both a nearby and a distant wrong-place profile.

## Visual regions

Choose a representative recording. Draw target, stable, ignored, or transient regions with brush, polygon, or rectangle. Undo, redo, reset, copy, and eraser operate on the current draft. `Layout suggestion (not AI)` is only a centered starting rectangle.

For keyboard/non-pointer authoring, edit the **Accessible coordinate list** with normalized values from 0 to 1. Save the region to persist it.

## Data Health and tests

Data Health reads only persisted evidence. Each blocker links back to its step and explains recovery. Its percentage is authoring coverage, never recognition confidence.

Create at least one positive and one negative test. Lock at least one test away from authoring. Locked tests cannot be edited or deleted.

## Build preparation

Complete all twelve steps and resolve every blocker. The development-only button creates a schema-valid deterministic BuildInput, persists its hash, and marks the version ready to build. It does not create a recognition model, confidence score, certification, or automatic progression.

If the button says the fixture is disabled, the environment is not authorized for development input preparation. Your draft remains saved.
