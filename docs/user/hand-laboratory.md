---
title: Hand interaction laboratory
audience: user
status: preview-pending-physical-qualification
canonical_for: reach-hand-laboratory-guide
last_reviewed: 2026-10-17
---

# Find your point

Open **Device connections → Find the Hand interaction laboratory**. Reach lets you see your tracked hand, set up a pointer, check it independently and practice. Ordinary buttons, touch and keyboard controls remain available throughout.

Choose **Enable live camera** to allow local hand tracking. Reach requests no microphone, uploads no camera frames and records no video. Place the camera near your screen, sit comfortably and hold your hand between your chest and the camera. Keep your palm and index finger visible. The preview shows detected joints even when your hand cannot yet contribute to setup. Follow the guidance to improve framing or extend your index finger naturally.

Reach keeps the active hand selected while an incidental second hand appears. If there is no clear candidate, choose a hand using the visible controls. In the [natural pointing development preview](../../Development_Docs/Projects/Project_Reach/Natural_Pointing_Recovery_20261017.md), your index may bend gently and the other fingers may rest comfortably; a fist is unnecessary. Open palms or competing fingers pause collection. Camera-facing depth is inferred and can remain uncertain. Left/right labels are model hints, not personal identity.

**Relative movement** is the recommended starting point. Set a comfortable center and four movement directions, then move your hand to guide the amber cursor to five new check targets. This checks cursor control; it does not establish where you physically point. **Absolute pointing** is experimental: point naturally at nine screen targets, then point at five distinct held-out targets. A fitted model remains unavailable for practice until its separate check passes. Ordinary RGB webcams do not determine physical screen intersection reliably for every posture or camera placement.

At each target, let your hand settle until the progress indicator fills. Brief tracking imperfections pause collection; completed targets stay saved. The development preview retains agreeing hold evidence for up to 2.5 seconds, without counting the interruption as evidence. A returning hand briefly settles before collection resumes. **Pause**, **Resume** and **Retry this target** let you rest or retry without starting over; there is no forced 20-second retry. Sustained loss expires only the unfinished hold while the same hand binding remains. A camera, hand generation, mirror, orientation or view-size change clears the setup. Local spatial hand continuity lasts up to 1.2 seconds of absence; longer disappearance or an ambiguous crossing may create a new generation requiring fresh setup. Moving the pointing area on screen also invalidates live absolute calibration. Keep the screen and camera stationary; manually recalibrate after camera movement that tracking cannot observe.

Results separate held-out error, raw jitter and tested coverage from training. Failed checks offer retry, recalibration and the relative alternative. The playground shows a filtered pointer, optional raw pointer and the measured held-out error area. Estimates stop outside the supported area or when tracking is stale. Practice targets never activate application controls, select objects, manipulate artifacts, transfer content or advance a Voyage.

**Explore guided demo** is a camera-free walkthrough with visibly simulated joints, movement controls and example interruptions. Successful demo results establish the software flow only. Real webcam accuracy, lighting tolerance, left/right usability, exposure-to-visible response time and comfort remain unqualified.

Use **Stop session** or the return link to stop owned camera/worker activity and clear session calibration. Preview mirroring is deliberate and starts a fresh session. Backgrounding the page stops camera activity; enable it again when ready. Calibration is local to the session and expires after thirty minutes.

The closed **Session diagnostics & privacy** drawer offers aggregate software timing and explicit download consent. Capture-to-canvas timing excludes sensor exposure and display scanout. Downloads contain no footage, landmarks, hand/camera identifiers or private fit coefficients. **Delete calibration** clears the fit and aggregate trials while leaving the camera available; stopping clears the session.
