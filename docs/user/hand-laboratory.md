---
title: Hand interaction laboratory
audience: user
status: preview-pending-physical-qualification
canonical_for: reach-hand-laboratory-guide
last_reviewed: 2026-10-17
---

# Find your point

Open **Device connections → Find the Hand interaction laboratory**. Reach lets you see your tracked hand, set up a pointer, check it independently and practice. Ordinary buttons, touch and keyboard controls remain available throughout.

Choose **Enable live camera** to allow local hand tracking. The standard laboratory requests no microphone, uploads no camera frames and records no video. Place the camera near your screen, sit comfortably and hold your hand between your chest and the camera. Keep your index finger and knuckles visible. The preview shows detected joints even when your hand cannot yet contribute to setup. Follow the guidance to improve framing or extend your index finger naturally.

A visible index trace or **Index joints tracked** describes observed index geometry. It does not mean your pointing intent is confirmed or calibration is collecting. An index alone cannot supply missing palm scale, establish continuing hand identity or replace a hand the model no longer detects.

Reach keeps the active hand selected while an incidental second hand appears. If there is no clear candidate, choose a hand using the visible controls. In the [natural pointing development preview](../../Development_Docs/Projects/Project_Reach/Natural_Pointing_Recovery_20261017.md), your index may bend gently and the other fingers may rest comfortably; a fist is unnecessary. Your wrist may reach or leave the bottom edge when visible finger and knuckle geometry remains sufficient. Cropped non-index fingers may use bounded model estimates up to 15% beyond an image edge as secondary posture evidence. These remain explicitly inferred, separate from observed joints; your index and required knuckles must stay visible. Open palms, competing fingers and insufficient evidence still pause collection. Pointing toward the camera uses inferred depth and joint relationships rather than apparent finger length alone; it does not establish a physical screen ray. Left/right labels are model hints, not personal identity.

The development preview follows short, coherent hand movement between targets and conservatively suppresses nearly identical duplicate model hypotheses. An owner trial of the previous correction repeatedly reset calibration; its software checks did not establish physical reliability. The latest correction uses a stable knuckle reference, keeps movement history independent of wrist visibility and compares inferred 3D palm shape during turns. An owner-authorized private recording has been replayed to diagnose and check these corrections; a fresh physical retest remains pending.

A brief phantom overlap can preserve one established track's prior history while collection pauses. A secondary candidate needs repeated observation before its history is retained. Ambiguity never contributes samples, and crossings between two established tracks still require fresh source identification. Separate uncertain overlapping hands to recover. Abrupt jumps or a genuinely new hand generation may still require fresh setup. Extensive cropping or model-reported **No hand** can still stop pointing; a visible index does not make unavailable anatomy certain.

**Relative movement** is the recommended starting point. Set a comfortable center and four movement directions, then move your hand to guide the amber cursor to five new check targets. This checks cursor control; it does not establish where you physically point. **Absolute pointing** is experimental: point naturally at nine screen targets, then point at five distinct held-out targets. A fitted model remains unavailable for practice until its separate check passes. Ordinary RGB webcams do not determine physical screen intersection reliably for every posture or camera placement.

At each target, let your hand settle until the progress indicator fills. Brief tracking imperfections pause collection; completed targets stay saved. The development preview retains agreeing hold evidence for up to 2.5 seconds, without counting the interruption as evidence. An isolated posture or framing dip can resume immediately on fresh eligible evidence from the same established hand. Actual tracking loss, ambiguity or sustained ineligibility requires 120 milliseconds of fresh settling. **Pause**, **Resume** and **Retry this target** let you rest or retry without starting over; there is no forced 20-second retry. Sustained loss expires only the unfinished hold while the same hand binding remains. A camera, hand generation, mirror, orientation or view-size change clears the setup. Local spatial hand continuity lasts up to 1.2 seconds of absence; longer disappearance or an ambiguous crossing may create a new generation requiring fresh setup. Moving the pointing area on screen also invalidates live absolute calibration. Keep the screen and camera stationary; manually recalibrate after camera movement that tracking cannot observe.

A genuine reset now leaves a persistent **Setup ended** alert with its reason and moves keyboard focus to the alert. The camera remains available so you can begin a fresh setup when ready.

Results separate held-out error, raw jitter and tested coverage from training. If all five check targets were recorded but accuracy failed, the preview shows the measured 95th-percentile error and the unchanged 3% limit, both measured against the pointing area's diagonal. Your setup remains available for retry, recalibration or the relative alternative; the playground still requires a passing independent check.

The playground shows an adaptively smoothed pointer, optional raw pointer and the measured held-out error area. Smoothing affects display only; independent checks use fresh, unsmoothed evidence. During brief uncertainty, a faded, dashed **Last seen pointer** may remain for up to 450 milliseconds. It does not count as fresh tracking or contribute calibration/check samples. Fresh estimates stop outside the supported area or when tracking is stale. Practice targets never activate application controls, select objects, manipulate artifacts, transfer content or advance a Voyage.

**Explore guided demo** is a camera-free walkthrough with visibly simulated joints, movement controls and example interruptions. Successful demo results establish the software flow only. This local correction awaits another physical trial and protected integration. Real webcam accuracy, lighting tolerance, left/right usability, exposure-to-visible response time and comfort remain unqualified.

Use **Stop session** or the return link to stop owned camera/worker activity and clear session calibration. Preview mirroring is deliberate and starts a fresh session. Backgrounding the page stops camera activity; enable it again when ready. Calibration is local to the session and expires after thirty minutes.

The standard laboratory's closed **Session diagnostics & privacy** drawer offers aggregate software timing and explicit download consent. Capture-to-canvas timing excludes sensor exposure and display scanout. Its aggregate downloads contain no footage, landmarks, hand/camera identifiers or private fit coefficients. **Delete calibration** clears the fit and aggregate trials while leaving the camera available; stopping clears the session.

## Explicit local diagnostic recording

A separately enabled local testing page at `/devices/reach/record` is an explicit exception to the standard laboratory's no-recording behavior. It is available only on a loopback host in a developer-enabled preview. Choose **Enable camera preview**, then **Start guided video + trace recording**. Previewing alone does not start recording.

The 74-second guide gives each of nine pointing positions its own hold, followed by relaxed pointing, a continuous sweep, an open palm, a brief hide and recovery. It fits no calibration. The diagnostic video combines the camera image, its visible background, the existing hand overlay and synchronized prompts; it records no audio. The accompanying trace includes joint coordinates, inferred relative depth, model identity, timing and prompt labels. Those labels describe requested actions, not verified pointing intent or physical accuracy.

Use **Pause recording**, **Stop & review** or **Cancel & delete recording** as needed. Review the result, then manually choose **Download diagnostic video** and **Download landmark trace** before leaving. Leaving discards unsaved recordings and stops the camera. Nothing is uploaded, saved to an account or included in ordinary aggregate exports. Keep both downloads private and outside the repository; recordings must not be added to commits automatically. Local replay is diagnostic evidence, not physical accuracy qualification.
