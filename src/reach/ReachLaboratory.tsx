"use client";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion as animated } from "motion/react";
import { useOptionalMotionPolicyContext } from "@/animation/motion/MotionPolicyContext";
import { assessHand } from "@/watchglass/hand-posture";
import { ReachBrowserRuntime } from "./browser-runtime";
import {
  calibrationLayout,
  relativeLayout,
  fitCalibration,
  fitRelativeCalibration,
  validateCalibration,
  estimatedPoint,
  calibratedPoint,
  REACH_ABSOLUTE_MAPPING,
  percentile,
  type Calibration,
  type CalibrationBinding,
  type CalibrationSample,
} from "./calibration";
import {
  PointFilter,
  pointingFeatures,
  relativeIndexFeatures,
  type Point,
  REACH_FEATURE_PROFILE,
  REACH_ASSOCIATION_BASIS,
  REACH_RELATIVE_FEATURE_PROFILE,
  REACH_RELATIVE_ASSOCIATION_BASIS,
} from "./coordinates";
import { indexImageAlgorithm, type IndexImageObservation } from "./index-image-tracker";
import { IndexImageReadiness } from "./index-image-readiness";
import { canOpenReachTrial } from "./trial-entry";
import { aggregateCalibrationExport } from "./privacy";
import { ActiveHandSelector, type HandObservation, type ReachReadiness } from "./observation";
import { SampleWindow, type Acquisition } from "./sample-window";
import { PointerContinuity, outsideCalibratedRange } from "./pointer-continuity";
import { syntheticObservation } from "./synthetic";
import { ReachStage } from "./ReachStage";
import { ReachTiming, containedFrame, type ReachVisualFrame } from "./visualization";
import styles from "./ReachLaboratory.module.css";
type Source = "OFF" | "LIVE" | "DEMO";
type Step = "PREPARE" | "TRAINING" | "VALIDATION" | "RESULTS" | "PLAYGROUND";
type PointingMode = "RELATIVE" | "ABSOLUTE";
type Trial = {
  stage: "TRAINING" | "VALIDATION";
  mode: PointingMode;
  order: Point[];
  groups: CalibrationSample[][];
  window: SampleWindow | null;
  binding: CalibrationBinding | null;
  after: number;
  acquiredAt: number;
  demoTargetReady: boolean;
  paused: boolean;
};
const initialReadiness: ReachReadiness = {
  detectedCount: 0,
  hand: null,
  eligible: false,
  changed: false,
  condition: "NO_HAND",
  guidance: "Show your hand to the camera.",
};
const cameraMessages: Record<string, string> = {
  DISABLED: "Camera is off",
  REQUESTING: "Waiting for camera permission",
  MODEL_STARTING: "Preparing hand tracking",
  READY: "Camera connected",
  PERMISSION_DENIED: "Camera access was declined",
  CAMERA_BUSY: "Your camera is in use",
  UNSUPPORTED: "Live tracking is unavailable in this browser",
  SUSPENDED: "Camera paused while you were away",
  ERROR: "The camera could not start",
  CAMERA_REQUEST_TIMEOUT: "Camera permission took too long",
  CAMERA_FRAME_TIMEOUT: "The camera is not sending video",
  FRAME_CHANGED_RECALIBRATE: "Camera size changed",
  STALE_OR_INVALID_OBSERVATION: "Waiting for fresh tracking",
};
const percent = (value: number | undefined | null) => (value == null ? "Not measured" : `${(value * 100).toFixed(2)}%`);
const checkedError = (value: number | undefined | null, limit = 0.03) =>
  value != null && value > limit && percent(value) === percent(limit)
    ? `${percent(value)} (rounded; just above the limit)`
    : percent(value);
const emptyFrame = (): ReachVisualFrame => ({
  observation: null,
  activeTrack: null,
  raw: null,
  filtered: null,
  uncertainty: null,
  previewEstimate: false,
});
const timingSnapshot = (value: ReachTiming) => ({
  observations: value.inference.length,
  captureHz: value.captureIntervals.length
    ? 1000 /
      (value.captureIntervals.slice(-60).reduce((sum, interval) => sum + interval, 0) /
        Math.min(60, value.captureIntervals.length))
    : null,
  capture: percentile(value.captureIntervals, 0.95),
  inference: percentile(value.inference, 0.95),
  submission: percentile(value.submissionAge, 0.95),
  visualization: percentile(value.visualizationIntervals, 0.95),
});
export function ReachLaboratory({
  returnHref = "/devices/pair",
  returnLabel = "Device connections",
  localPoseRecording = false,
}: {
  returnHref?: string;
  returnLabel?: string;
  localPoseRecording?: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null),
    workspace = useRef<HTMLDivElement>(null),
    plane = useRef<HTMLDivElement>(null),
    runtime = useRef<ReachBrowserRuntime | null>(null);
  const selector = useRef(new ActiveHandSelector()),
    filter = useRef(new PointFilter()),
    pointerContinuity = useRef(new PointerContinuity()),
    visual = useRef<ReachVisualFrame>(emptyFrame()),
    timing = useRef(new ReachTiming());
  const epoch = useRef(1),
    lastObservation = useRef<HandObservation | null>(null),
    lastIndexObservation = useRef<IndexImageObservation | null>(null),
    indexReadiness = useRef(new IndexImageReadiness()),
    lastIndexUI = useRef(0),
    lastControlUI = useRef(0),
    lastUI = useRef(0);
  const trial = useRef<Trial | null>(null),
    calibrationRef = useRef<Calibration | null>(null),
    sourceRef = useRef<Source>("OFF"),
    stepRef = useRef<Step>("PREPARE");
  const modeRef = useRef<PointingMode>("RELATIVE");
  const sessionStatus = useRef("DISABLED");
  const readyRef = useRef(initialReadiness),
    demoPoint = useRef<Point>({ x: 0.5, y: 0.5 }),
    demoGeneration = useRef(0),
    aggregates = useRef<ReturnType<typeof aggregateCalibrationExport>[]>([]);
  const [source, setSource] = useState<Source>("OFF"),
    [step, setStep] = useState<Step>("PREPARE"),
    [pointingMode, setPointingMode] = useState<PointingMode>("RELATIVE");
  const [status, setStatus] = useState("DISABLED"),
    [readiness, setReadiness] = useState(initialReadiness),
    [entryReady, setEntryReady] = useState(false),
    [hands, setHands] = useState<HandObservation["hands"]>([]);
  const [frameSize, setFrameSize] = useState<Pick<HandObservation, "frameWidth" | "frameHeight">>();
  const [inferenceBackend, setInferenceBackend] = useState<HandObservation["inferenceBackend"]>();
  const [indexState, setIndexState] = useState<IndexImageObservation | null>(null),
    [indexStale, setIndexStale] = useState(false),
    [markFinger, setMarkFinger] = useState(false),
    [seedPoint, setSeedPoint] = useState<Point>({ x: 0.5, y: 0.5 });
  const [mirror, setMirror] = useState(true),
    [calibration, setCalibration] = useState<Calibration | null>(null),
    [target, setTarget] = useState<Point | null>(null);
  const [completed, setCompleted] = useState(0),
    [total, setTotal] = useState(9),
    [acquisition, setAcquisition] = useState<Acquisition | null>(null),
    [demoHolding, setDemoHolding] = useState(false),
    [paused, setPaused] = useState(false);
  const [message, setMessage] = useState("A little movement. A new way to explore."),
    [setupInvalidation, setSetupInvalidation] = useState<string | null>(null),
    [pointerMessage, setPointerMessage] = useState(""),
    [overlay, setOverlay] = useState(false),
    [exportConsent, setExportConsent] = useState(false);
  const [point, setPoint] = useState<Point>({ x: 0.5, y: 0.5 }),
    [demoFault, setDemoFault] = useState("NONE"),
    [practiceTarget, setPracticeTarget] = useState<Point | null>(null);
  const [logEntries, setLogEntries] = useState<{ at: number; reason: string }[]>([]),
    [metrics, setMetrics] = useState(() => timingSnapshot(new ReachTiming()));
  const [pacing, setPacing] = useState<{
    focused: boolean;
    calibrationCollecting: boolean;
    maximumHz: number;
    targetHz: number;
    smoothedTotalMs: number | null;
    smoothedMainThreadMs: number | null;
    smoothedTimerLatenessMs: number | null;
  } | null>(null);
  const trialEntryReady = useCallback(
    () =>
      canOpenReachTrial({
        source: sourceRef.current,
        sessionStatus: sessionStatus.current,
        workerAvailable: runtime.current?.resources().workers === 1,
      }),
    [],
  );
  const demoFaultRef = useRef(demoFault);
  useEffect(() => {
    demoFaultRef.current = demoFault;
  }, [demoFault]);
  const motion = useOptionalMotionPolicyContext();
  useLayoutEffect(() => {
    if (step === "PREPARE") return;
    const section = workspace.current;
    if (section) window.scrollTo({ top: window.scrollY + section.getBoundingClientRect().top - 88 });
    plane.current?.focus({ preventScroll: true });
  }, [step]);
  const advance = useCallback((next: Step) => {
    stepRef.current = next;
    runtime.current?.setCalibrationCollecting(
      (next === "TRAINING" || next === "VALIDATION") && trial.current?.paused === false,
    );
    setStep(next);
  }, []);
  const changeSource = useCallback((next: Source) => {
    sourceRef.current = next;
    setSource(next);
  }, []);
  const log = useCallback(
    (reason: string) =>
      setLogEntries((entries) => [...entries.slice(-49), { at: Math.round(performance.now()), reason }]),
    [],
  );
  const retainPointer = useCallback((now: number, reason: string, allow = true) => {
    const c = calibrationRef.current;
    const lastSeen = allow && c ? pointerContinuity.current.hold(now, JSON.stringify(c.binding)) : null;
    if (!allow) pointerContinuity.current.reset();
    visual.current.lastSeen = lastSeen;
    if (trial.current?.stage === "VALIDATION" || stepRef.current === "PLAYGROUND")
      setPointerMessage(lastSeen ? `${reason} Last seen pointer.` : reason);
  }, []);
  const setupAlert = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!setupInvalidation) return;
    setupAlert.current?.scrollIntoView({ block: "center", behavior: "instant" });
    setupAlert.current?.focus({ preventScroll: true });
  }, [setupInvalidation]);
  const invalidate = useCallback(
    (reason?: string) => {
      setSetupInvalidation(reason ?? null);
      trial.current = null;
      runtime.current?.setCalibrationCollecting(false);
      calibrationRef.current = null;
      setCalibration(null);
      setTarget(null);
      setAcquisition(null);
      setPaused(false);
      filter.current.reset();
      pointerContinuity.current.reset();
      setPointerMessage("");
      visual.current.lastSeen = null;
      visual.current.raw = null;
      visual.current.filtered = null;
      visual.current.uncertainty = null;
      if (reason) {
        advance("PREPARE");
        setMessage(reason);
      }
    },
    [advance],
  );
  const stop = useCallback(() => {
    changeSource("OFF");
    runtime.current?.stop();
    invalidate();
    advance("PREPARE");
    visual.current = emptyFrame();
    lastObservation.current = null;
    setInferenceBackend(undefined);
    lastIndexObservation.current = null;
    indexReadiness.current.reset();
    setIndexState(null);
    setIndexStale(false);
    setMarkFinger(false);
    selector.current.reset();
    readyRef.current = initialReadiness;
    setReadiness(initialReadiness);
    setEntryReady(false);
    setHands([]);
    setFrameSize(undefined);
    aggregates.current = [];
    timing.current.reset();
    setMetrics(timingSnapshot(timing.current));
    setPacing(null);
    setExportConsent(false);
    setPracticeTarget(null);
    setMessage("Your camera is off and session calibration is cleared.");
  }, [advance, changeSource, invalidate]);
  const changePointingMode = (next: PointingMode) => {
    modeRef.current = next;
    setPointingMode(next);
    runtime.current?.setIndexTrackingEnabled(next === "RELATIVE");
    indexReadiness.current.reset();
    lastIndexObservation.current = null;
    setIndexState(null);
    setIndexStale(false);
    const waiting: ReachReadiness = {
      ...initialReadiness,
      detectedCount: lastObservation.current?.hands.length ?? 0,
      condition: "ACQUIRING",
      guidance:
        next === "RELATIVE"
          ? "Waiting for fresh fingertip image tracking to settle."
          : "Waiting for fresh index geometry to settle.",
    };
    readyRef.current = waiting;
    setReadiness(waiting);
    setEntryReady(trialEntryReady());
  };
  const bindingFor = (o: HandObservation, hand: HandObservation["hands"][number]): CalibrationBinding => ({
    featureProfile: REACH_FEATURE_PROFILE,
    associationBasis: REACH_ASSOCIATION_BASIS,
    providerId: o.providerId,
    modelDigest: o.modelDigest,
    providerGeneration: o.providerGeneration,
    cameraLeaseId: o.cameraLeaseId,
    cameraFrameVersion: o.cameraFrameVersion,
    viewportEpoch: epoch.current,
    viewportWidth: plane.current?.clientWidth ?? 1,
    viewportHeight: plane.current?.clientHeight ?? 1,
    mirror: o.mirrorTransform === "PREVIEW_X",
    orientation: o.orientation,
    trackId: hand.trackId,
    trackGeneration: hand.trackGeneration,
    evidenceTier: o.evidenceTier,
  });
  const consumeControl = useRef<
    (features: number[], at: number, binding: CalibrationBinding, observation?: HandObservation) => void
  >(() => {});
  const pauseControl = useCallback(
    (now: number, guidance: string) => {
      visual.current.raw = null;
      visual.current.filtered = null;
      retainPointer(now, guidance);
      const t = trial.current;
      if (t?.window && !t.paused) setAcquisition(t.window.pause(now));
    },
    [retainPointer],
  );
  useEffect(() => {
    modeRef.current = pointingMode;
    consumeControl.current = (features, at, binding, observation) => {
      const now = performance.now();
      const t = trial.current;
      const incumbent = calibrationRef.current?.binding ?? t?.binding;
      if (incumbent && Object.entries(incumbent).some(([k, v]) => binding[k as keyof CalibrationBinding] !== v)) {
        invalidate("The tracked fingertip, camera or pointing area changed. Begin a fresh setup.");
        log("CALIBRATION_BINDING_CHANGED");
        return;
      }
      if (t && !t.paused && now >= t.after && (sourceRef.current !== "DEMO" || t.demoTargetReady)) {
        // A slow hold or tracking pause is not setup invalidation. The bounded
        // evidence window handles expiry of this target without losing others.
        try {
          t.binding ??= binding;
          t.window ??= new SampleWindow(t.binding, t.order[t.groups.length], t.mode);
          const progress = t.window.push(features, at, binding);
          if (now - lastControlUI.current >= 80 || progress.samples) {
            lastControlUI.current = now;
            setAcquisition(progress);
          }
          if (progress.samples) {
            timing.current.push(timing.current.acquisition, now - t.acquiredAt);
            t.groups.push(progress.samples);
            setCompleted(t.groups.length);
            t.window = null;
            if (t.groups.length === t.order.length) {
              const fitted =
                t.stage === "VALIDATION"
                  ? validateCalibration(calibrationRef.current!, t.groups)
                  : t.mode === "ABSOLUTE"
                    ? fitCalibration(t.groups, t.binding, now)
                    : fitRelativeCalibration(t.groups, t.binding, now);
              calibrationRef.current = fitted;
              setCalibration(fitted);
              aggregates.current = [...aggregates.current.slice(-9), aggregateCalibrationExport(fitted, true)];
              trial.current = null;
              setTarget(null);
              setAcquisition(null);
              advance("RESULTS");
              setMessage(
                t.stage === "TRAINING"
                  ? "Setup collected. Now check five new targets independently."
                  : fitted.status === "VALIDATED"
                    ? "Your independent check passed for this session."
                    : `All five check targets were recorded. The 95th-percentile error ${checkedError(fitted.validationP95)} exceeded the ${percent(fitted.validationSummary?.p95LimitDiagonalFraction ?? 0.03)} accuracy limit. Your setup is kept.`,
              );
              log(t.stage === "TRAINING" ? "FIT_COMPLETE" : `VALIDATION_${fitted.status}`);
            } else {
              t.after = now + 700;
              t.acquiredAt = now;
              t.demoTargetReady = false;
              setDemoHolding(false);
              setTarget(t.order[t.groups.length]);
              setAcquisition(null);
              setMessage("Target saved. Take a breath and move to the next one.");
            }
          }
        } catch (error) {
          const contextChanged = error instanceof Error && error.message === "SAMPLE_CONTEXT_CHANGED";
          if (contextChanged) invalidate("The camera, hand or pointing area changed. Start a fresh setup.");
          else {
            trial.current = null;
            setTarget(null);
            setAcquisition(null);
            advance("RESULTS");
            setMessage(
              t.mode === "ABSOLUTE"
                ? "This setup did not provide enough reliable pointing variation. Adjust your camera or try relative movement."
                : "Move a little farther in each direction, then retry your movement setup.",
            );
          }
          log(contextChanged ? "SAMPLE_CONTEXT_CHANGED" : "FIT_REJECTED");
        }
      }
      const current = calibrationRef.current;
      // A validation preview is explicitly provisional. It cannot make calibration valid.
      const isValidation = trial.current?.stage === "VALIDATION";
      const preview = current && (isValidation ? { ...current, status: "VALIDATED" as const } : current);
      const estimate = preview
        ? binding.featureProfile === REACH_RELATIVE_FEATURE_PROFILE
          ? calibratedPoint(preview, features, binding, now)
          : observation
            ? estimatedPoint(preview, observation, binding, now)
            : null
        : null;
      visual.current.raw = estimate;
      visual.current.filtered = estimate ? filter.current.update(estimate, at) : null;
      if (visual.current.filtered) {
        // A display spike hold is not a new accepted position. Its memory must
        // expire from the accepted estimate's clock rather than each bad input.
        pointerContinuity.current.observe(
          visual.current.filtered,
          filter.current.acceptedCaptureTime!,
          JSON.stringify(binding),
        );
        visual.current.lastSeen = null;
        setPointerMessage("");
      } else if (current && (isValidation || stepRef.current === "PLAYGROUND")) {
        retainPointer(
          now,
          outsideCalibratedRange(current, features)
            ? "Point recognized · outside this setup’s tested range. Move back toward your calibrated area."
            : "Pointer estimate unavailable. Your hand is still tracked.",
        );
      }
      visual.current.uncertainty = isValidation ? null : (current?.uncertaintyRadius ?? null);
      visual.current.previewEstimate = !!isValidation;
    };
  });
  const imageBindingFor = (o: IndexImageObservation): CalibrationBinding => ({
    featureProfile: REACH_RELATIVE_FEATURE_PROFILE,
    associationBasis: REACH_RELATIVE_ASSOCIATION_BASIS,
    providerId: sourceRef.current === "DEMO" ? "reach.demo.index-image" : o.providerId,
    modelDigest: o.algorithmDigest,
    providerGeneration: o.providerGeneration,
    cameraLeaseId: o.cameraLeaseId,
    cameraFrameVersion: o.cameraFrameVersion,
    viewportEpoch: epoch.current,
    viewportWidth: plane.current?.clientWidth ?? 1,
    viewportHeight: plane.current?.clientHeight ?? 1,
    mirror: o.mirrorTransform === "PREVIEW_X",
    orientation: o.orientation,
    trackId: o.trackId!,
    trackGeneration: o.trackGeneration,
    evidenceTier: sourceRef.current === "DEMO" ? "D0" : "UNQUALIFIED",
  });
  const acceptIndex = useRef<(o: IndexImageObservation) => void>(() => {});
  useEffect(() => {
    acceptIndex.current = (o) => {
      const age = performance.now() - o.monotonicCaptureTime;
      if (age < 0 || age > 150) {
        indexReadiness.current.pause();
        if (modeRef.current === "RELATIVE")
          pauseControl(performance.now(), "Waiting for fresh fingertip tracking. Collection paused.");
        return;
      }
      lastIndexObservation.current = o;
      setIndexStale(false);
      const next = indexReadiness.current.update(o);
      if (modeRef.current !== "RELATIVE") return;
      const ready: ReachReadiness = {
        detectedCount: lastObservation.current?.hands.length ?? 0,
        hand: null,
        eligible: next.eligible,
        changed: next.changed,
        condition:
          next.condition === "UNSEEDED"
            ? "NO_HAND"
            : next.condition === "UNCERTAIN" || next.condition === "LOST"
              ? "RECOVERING"
              : next.condition,
        guidance: next.guidance,
      };
      readyRef.current = ready;
      setEntryReady(trialEntryReady());
      if (next.changed && (trial.current?.binding || calibrationRef.current)) {
        invalidate("A new fingertip was selected or the camera changed. Begin a fresh setup for this track.");
        log("INDEX_IMAGE_CONTEXT_CHANGED");
      }
      if (performance.now() - lastIndexUI.current >= 80 || next.changed || !next.eligible) {
        lastIndexUI.current = performance.now();
        setIndexState(o);
        setFrameSize({ frameWidth: o.frameWidth, frameHeight: o.frameHeight });
        setReadiness(ready);
      }
      if (!next.eligible || !o.point) {
        pauseControl(performance.now(), next.guidance);
        return;
      }
      consumeControl.current(relativeIndexFeatures(o.point), o.monotonicCaptureTime, imageBindingFor(o));
    };
  });
  const accept = useRef<(o: HandObservation) => void>(() => {});
  useEffect(() => {
    accept.current = (o) => {
      const now = performance.now();
      lastObservation.current = o;
      setInferenceBackend(o.inferenceBackend);
      if (o.evidenceTier !== "D0") timing.current.observe(o);
      const ready = selector.current.update(o);
      const imageMode = modeRef.current === "RELATIVE";
      const eligibilityChanged = readyRef.current.eligible !== ready.eligible;
      if (!imageMode) {
        readyRef.current = ready;
        setEntryReady(trialEntryReady());
      }
      visual.current.observation = o;
      visual.current.activeTrack = ready.hand?.trackId ?? null;
      if (!imageMode && ready.changed && (trial.current?.binding || calibrationRef.current)) {
        invalidate(
          "We can no longer confirm the same hand and camera setup. Set up again so samples stay tied to one hand.",
        );
        log("CONTEXT_CHANGED");
      }
      // Keep guidance, posture and eligibility from the same observation. A
      // paused collection must never retain a settled "ready" headline.
      if (eligibilityChanged || now - lastUI.current >= 120) {
        lastUI.current = now;
        setHands(o.hands);
        setFrameSize({ frameWidth: o.frameWidth, frameHeight: o.frameHeight });
        if (!imageMode) setReadiness(ready);
      }
      if (imageMode) return;
      const t = trial.current;
      if (!ready.eligible || !ready.hand) {
        visual.current.raw = null;
        visual.current.filtered = null;
        retainPointer(
          now,
          `${ready.guidance} Collection paused.`,
          !["AMBIGUOUS", "CHOOSE_HAND"].includes(ready.condition),
        );
        if (t?.window && !t.paused) {
          const progress = t.window.pause(now);
          if (now - lastUI.current < 10) setAcquisition(progress);
        }
        return;
      }
      const binding = bindingFor(o, ready.hand);
      const c = calibrationRef.current;
      if (c && Object.entries(c.binding).some(([k, v]) => binding[k as keyof CalibrationBinding] !== v)) {
        invalidate("Your pointing area changed. Set up again for this view.");
        log("CALIBRATION_BINDING_CHANGED");
        return;
      }
      let features: number[];
      try {
        features = pointingFeatures(ready.hand, o);
      } catch {
        visual.current.raw = null;
        visual.current.filtered = null;
        retainPointer(now, "Index geometry is uncertain. Collection paused.");
        if (t?.window && !t.paused) setAcquisition(t.window.pause(o.monotonicCaptureTime));
        return;
      }
      consumeControl.current(features, o.monotonicCaptureTime, binding, o);
    };
  });
  useEffect(() => {
    const r = new ReachBrowserRuntime(
      video.current!,
      (o) => accept.current(o),
      (state) => {
        sessionStatus.current = state;
        setStatus(state);
        setEntryReady(trialEntryReady());
        if (state === "READY")
          setMessage((previous) =>
            previous.startsWith("Allow camera access")
              ? "Camera ready. Show a relaxed index point to start finger tracking."
              : previous,
          );
        if (state === "STALE_OR_INVALID_OBSERVATION") {
          const now = performance.now();
          if (modeRef.current === "RELATIVE") {
            indexReadiness.current.pause();
            setIndexStale(true);
          }
          pauseControl(now, "Waiting for fresh tracking. Collection paused.");
          readyRef.current = { ...readyRef.current, eligible: false };
          setReadiness((previous) => ({
            ...previous,
            eligible: false,
            condition: "RECOVERING",
            guidance: "Waiting for fresh tracking. Hold here briefly.",
          }));
        }
        if (!["READY", "MODEL_STARTING", "REQUESTING", "STALE_OR_INVALID_OBSERVATION"].includes(state)) {
          lastObservation.current = null;
          setInferenceBackend(undefined);
          lastIndexObservation.current = null;
          indexReadiness.current.reset();
          setIndexState(null);
          setIndexStale(false);
          setMarkFinger(false);
          visual.current = emptyFrame();
          selector.current.reset();
          readyRef.current = initialReadiness;
          setReadiness(initialReadiness);
          setEntryReady(false);
          setHands([]);
          invalidate();
          if (state !== "DISABLED") {
            changeSource("OFF");
            advance("PREPARE");
            setMessage(
              state === "SUSPENDED"
                ? "Camera stopped while you were away. Enable it again when you are ready."
                : "You can retry the camera or explore the guided demo.",
            );
          }
        }
      },
      undefined,
      undefined,
      (o) => acceptIndex.current(o),
    );
    runtime.current = r;
    r.setCalibrationCollecting(
      (stepRef.current === "TRAINING" || stepRef.current === "VALIDATION") && trial.current?.paused === false,
    );
    let lastSize = "";
    let lastPosition = "";
    const changed = () => {
      const rect = plane.current?.getBoundingClientRect();
      const size = rect
        ? `${rect.width}:${rect.height}:${window.visualViewport?.scale ?? 1}:${window.devicePixelRatio}`
        : "";
      if (lastSize && lastSize !== size && (calibrationRef.current || trial.current?.binding)) {
        ++epoch.current;
        invalidate("Your view size changed. Set up again for this pointing area.");
      }
      lastSize = size;
      const position = rect ? `${Math.round(rect.left)}:${Math.round(rect.top)}` : "";
      const absoluteLive =
        sourceRef.current === "LIVE" &&
        (trial.current?.mode === "ABSOLUTE" || calibrationRef.current?.mapping === REACH_ABSOLUTE_MAPPING);
      if (
        absoluteLive &&
        lastPosition &&
        lastPosition !== position &&
        (calibrationRef.current || trial.current?.binding)
      ) {
        ++epoch.current;
        invalidate("Your pointing area moved on the screen. Set up again in this position.");
      }
      lastPosition = position;
    };
    const resize = new ResizeObserver(changed);
    if (plane.current) resize.observe(plane.current);
    window.addEventListener("resize", changed);
    window.addEventListener("scroll", changed, true);
    window.visualViewport?.addEventListener("resize", changed);
    window.visualViewport?.addEventListener("scroll", changed);
    return () => {
      r.stop();
      resize.disconnect();
      window.removeEventListener("resize", changed);
      window.removeEventListener("scroll", changed, true);
      window.visualViewport?.removeEventListener("resize", changed);
      window.visualViewport?.removeEventListener("scroll", changed);
    };
  }, [advance, changeSource, invalidate, pauseControl, trialEntryReady]);
  useEffect(() => {
    if (source === "OFF") return;
    const freshness = setInterval(() => {
      const o = modeRef.current === "RELATIVE" ? lastIndexObservation.current : lastObservation.current,
        now = performance.now();
      if (o && now - o.monotonicCaptureTime > 150) {
        if (modeRef.current === "RELATIVE") setIndexStale(true);
        visual.current.raw = null;
        visual.current.filtered = null;
        retainPointer(now, "Waiting for fresh tracking. Collection paused.");
        readyRef.current = { ...readyRef.current, eligible: false };
        setReadiness((previous) => ({
          ...previous,
          eligible: false,
          condition: "RECOVERING",
          guidance: "Waiting for fresh tracking. Hold here briefly.",
        }));
        // Display/action freshness is measured now. Evidence continuity uses
        // accepted capture clocks; only an actual rejected/ineligible capture
        // pauses its window (and long capture gaps are handled by the window).
      }
      if (calibrationRef.current && now >= calibrationRef.current.expiresAt) {
        invalidate("Your session calibration expired. Set up again to continue.");
        log("CALIBRATION_EXPIRED");
      }
      setEntryReady(trialEntryReady());
    }, 100);
    const diagnostics = setInterval(() => {
      setMetrics(timingSnapshot(timing.current));
      setPacing(runtime.current?.trackingPacing() ?? null);
    }, 1000);
    return () => {
      clearInterval(freshness);
      clearInterval(diagnostics);
    };
  }, [source, invalidate, log, retainPointer, trialEntryReady]);
  useEffect(() => {
    demoPoint.current = point;
  }, [point]);
  useEffect(() => {
    if (source !== "DEMO") return;
    let sequence = 0;
    const generation = ++demoGeneration.current;
    const timer = setInterval(() => {
      if (sequence >= 3000) {
        stop();
        setMessage("The demo session ended. You can start another whenever you like.");
        return;
      }
      const now = performance.now();
      const o = syntheticObservation(demoPoint.current, sequence++, now, generation);
      o.mirrorTransform = mirror ? "PREVIEW_X" : "NONE";
      // Controlled conditions are explicitly a demo, never camera evidence.
      if (demoFaultRef.current === "NO_HAND") {
        o.hands = [];
        o.reason = "NO_HAND";
      }
      if (demoFaultRef.current === "TWO_HANDS") {
        const second = structuredClone(o.hands[0]);
        second.trackId = "demo-other";
        second.trackGeneration = 2;
        second.handedness = "LEFT";
        second.landmarks = second.landmarks.map((p) => ({ ...p, x: Math.min(0.97, p.x + 0.25) }));
        o.hands.push(second);
        o.reason = "MULTIPLE_HANDS";
      }
      if (demoFaultRef.current === "EDGE") {
        o.hands[0].landmarks[8].x = 1.005;
        o.hands[0].landmarks[8].valid = false;
        o.reason = "LOW_VISIBILITY";
      }
      if (demoFaultRef.current === "POSTURE") {
        const base = o.hands[0].landmarks[5];
        o.hands[0].landmarks[6] = { ...base, y: base.y - 0.04 };
        o.hands[0].landmarks[7] = { ...base, y: base.y - 0.025, z: base.z + 0.025 };
        o.hands[0].landmarks[8] = { ...base, y: base.y - 0.005, z: base.z + 0.025 };
        o.hands[0].pose = "UNKNOWN";
      }
      accept.current(o);
      if (modeRef.current === "RELATIVE") {
        const tracked = demoFaultRef.current === "NONE";
        acceptIndex.current({
          observationVersion: 1,
          providerId: indexImageAlgorithm.providerId,
          providerVersion: indexImageAlgorithm.providerVersion,
          algorithmDigest: indexImageAlgorithm.algorithmDigest,
          providerGeneration: generation,
          cameraLeaseId: o.cameraLeaseId,
          cameraFrameVersion: o.cameraFrameVersion,
          mirrorTransform: o.mirrorTransform,
          orientation: 0,
          frameWidth: o.frameWidth,
          frameHeight: o.frameHeight,
          sequence: o.sequence,
          monotonicCaptureTime: now,
          monotonicInferenceTime: now,
          trackId: "demo-image-index",
          trackGeneration: generation,
          point: tracked ? { ...demoPoint.current } : null,
          state: tracked ? "TRACKING" : "UNCERTAIN",
          modelAgreement: "UNAVAILABLE",
          anchorSource: "MANUAL_HINT",
          quality: { correlation: null, separation: null, texture: null, forwardBackwardErrorPixels: null },
          uncertaintyRadiusPixels: null,
          reason: "D0_SIMULATED_IMAGE_POSITION",
        });
      }
    }, 50);
    const suspend = () => {
      clearInterval(timer);
      stop();
      setStatus("SUSPENDED");
      setMessage("The demo paused while you were away. Start it again to continue.");
    };
    const hidden = () => {
      if (document.visibilityState !== "visible") suspend();
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", suspend);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", suspend);
    };
  }, [source, mirror, stop]);
  const startDemo = () => {
    stop();
    changeSource("DEMO");
    sessionStatus.current = "DEMO";
    setStatus("DEMO");
    setEntryReady(trialEntryReady());
    setDemoFault("NONE");
    setMessage("Guided demo: the hand is simulated. Camera accuracy is not measured.");
  };
  const startCamera = () => {
    stop();
    changeSource("LIVE");
    setMessage("Allow camera access to begin. Keep your hand comfortably in view.");
    void runtime.current?.start(true, mirror);
  };
  const begin = (stage: Trial["stage"]) => {
    if (stage === "TRAINING" && !trialEntryReady()) {
      setMessage(readyRef.current.guidance);
      return;
    }
    if (stage === "VALIDATION" && !calibrationRef.current) return;
    setSetupInvalidation(null);
    if (stage === "TRAINING") {
      calibrationRef.current = null;
      setCalibration(null);
    }
    const order =
      stage === "VALIDATION"
        ? [...calibrationLayout.validation]
        : pointingMode === "ABSOLUTE"
          ? [...calibrationLayout.training]
          : [...relativeLayout.training];
    if (stage === "VALIDATION")
      for (let i = order.length - 1; i > 0; i--) {
        const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
        [order[i], order[j]] = [order[j], order[i]];
      }
    const now = performance.now();
    trial.current = {
      stage,
      mode: pointingMode,
      order,
      groups: [],
      window: null,
      // A check can open while the user rests or reaches for its control. Fresh
      // samples must still match the already fitted hand/camera/view binding.
      binding: stage === "VALIDATION" ? { ...calibrationRef.current!.binding } : null,
      after: now + 700,
      acquiredAt: now,
      demoTargetReady: false,
      paused: false,
    };
    setTarget(order[0]);
    setCompleted(0);
    setTotal(order.length);
    setPaused(false);
    setDemoHolding(false);
    setAcquisition(null);
    filter.current.reset();
    pointerContinuity.current.reset();
    visual.current.lastSeen = null;
    setPointerMessage("");
    advance(stage);
    setMessage(
      stage === "VALIDATION"
        ? "Check five new positions. Hold at each target; your setup stays unchanged."
        : pointingMode === "ABSOLUTE"
          ? "Point naturally at each lit target, then hold comfortably."
          : relativeLayout.instructions[0],
    );
    log(`${stage}_${pointingMode}_STARTED`);
  };
  const togglePause = () => {
    const t = trial.current;
    if (!t) return;
    t.paused = !t.paused;
    runtime.current?.setCalibrationCollecting(!t.paused);
    const progress = t.window?.pause(performance.now());
    t.after = performance.now() + 700;
    t.acquiredAt = performance.now();
    setPaused(t.paused);
    setAcquisition(progress ?? null);
    setMessage(
      t.paused
        ? "Paused. Relax your hand; your completed targets are saved."
        : "Continue with the highlighted target. Your completed targets are saved.",
    );
  };
  const retryTarget = () => {
    if (!trial.current) return;
    trial.current.window = null;
    trial.current.after = performance.now() + 700;
    trial.current.acquiredAt = performance.now();
    setAcquisition(null);
    setMessage("Retrying this target. Your completed targets are saved.");
  };
  const exportMetrics = () => {
    if (!exportConsent) return;
    const o = lastObservation.current;
    const image = lastIndexObservation.current;
    const data = {
      version: 2,
      source,
      pointingMode,
      inferenceBackend: source === "LIVE" ? (o?.inferenceBackend ?? "CPU_WASM") : null,
      evidenceTier: source === "DEMO" ? "D0" : "UNQUALIFIED_LIVE_CAMERA",
      provider:
        pointingMode === "RELATIVE" && image
          ? {
              id: source === "DEMO" ? "reach.demo.index-image" : image.providerId,
              version: image.providerVersion,
              algorithm: indexImageAlgorithm.algorithm,
              algorithmDigest: image.algorithmDigest,
            }
          : o
            ? { id: o.providerId, version: o.providerVersion, modelId: o.modelId, modelDigest: o.modelDigest }
            : null,
      calibration: aggregateCalibrationExport(calibrationRef.current, true),
      trialAggregates: aggregates.current,
      timing: {
        boundary: "Software capture to canvas submission; excludes sensor exposure and display scanout",
        inferenceCount: timing.current.inference.length,
        inferenceP95Ms: percentile(timing.current.inference, 0.95),
        captureIntervalP95Ms: percentile(timing.current.captureIntervals, 0.95),
        canvasSubmissionAgeP95Ms: percentile(timing.current.submissionAge, 0.95),
        visualizationIntervalP95Ms: percentile(timing.current.visualizationIntervals, 0.95),
        acquisitionMs: timing.current.acquisition,
        recentModelCaptureHz: metrics.captureHz,
        adaptivePacing: pacing,
      },
      snapping: "DISABLED_PHASE_1",
      physicalQualification: "PENDING",
      logs: logEntries,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "reach-session-metrics.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const training = step === "TRAINING" || step === "VALIDATION",
    showPlane = step !== "PREPARE";
  const cameraText =
    source === "DEMO"
      ? "Guided demo · no camera"
      : (cameraMessages[status] ??
        (status.startsWith("MODEL_FAILURE") ? "Hand tracking could not load" : "Camera connection interrupted"));
  const progress = paused
    ? "Paused"
    : source === "DEMO" && training && !demoHolding
      ? "Move the demo hand to begin"
      : training && !readiness.eligible && acquisition?.state !== "EXPIRED"
        ? acquisition?.progress
          ? "Collection paused · hold progress kept"
          : "Waiting for eligible tracking · saved targets kept"
        : acquisition?.state === "MOVING"
          ? "Movement detected · let your hand settle"
          : acquisition?.state === "PAUSED"
            ? "Collection paused · hold progress kept"
            : acquisition?.state === "EXPIRED"
              ? "Reacquiring this target · saved targets kept"
              : acquisition?.state === "COLLECTING"
                ? "Hold here · collecting"
                : acquisition?.state === "ACCEPTED"
                  ? "Target saved"
                  : "Find a comfortable hold";
  const relativeInstruction =
    step === "TRAINING" && pointingMode === "RELATIVE" ? relativeLayout.instructions[completed] : null;
  const assessment = readiness.hand ? assessHand(readiness.hand, frameSize) : null;
  const calibrationLabel =
    calibration?.status === "VALIDATED"
      ? "Independent check passed"
      : calibration?.status === "FAILED"
        ? "Independent check needs improvement"
        : calibration
          ? "Independent check required"
          : "Setup required";
  const moveDemoToTarget = () => {
    const next = target ?? practiceTarget;
    if (!next) return;
    setPoint(next);
    demoPoint.current = next;
    if (trial.current) {
      trial.current.demoTargetReady = true;
      trial.current.acquiredAt = performance.now();
      setDemoHolding(true);
    }
  };
  const markVisibleFinger = (point: Point) => {
    const accepted = runtime.current?.seedIndex(point);
    setMarkFinger(false);
    setMessage(
      accepted
        ? "Fingertip hint queued. Tracking still needs a clear image match and compatible full-hand posture when visible. Selecting a new fingertip requires a fresh setup."
        : "The camera is not ready for a fingertip hint. Enable it and try again.",
    );
  };
  const imagePreviewPoint =
    !indexStale && indexState
      ? indexState.state === "TRACKING"
        ? indexState.point
        : indexState.state === "UNCERTAIN"
          ? (indexState.matchedPoint ?? null)
          : null
      : null;
  const imageGesturePaused = imagePreviewPoint !== null && indexState?.state === "UNCERTAIN";
  return (
    <section
      className={styles.lab}
      aria-labelledby="reach-heading"
      data-pointing-mode={pointingMode}
      data-step={step}
      data-motion-level={motion?.mode ?? "reduced"}
      data-reach-session="local-private"
      data-reach-authority="laboratory-only"
      data-reach-readiness={readiness.condition}
      data-image-state={indexStale ? "STALE" : (indexState?.state ?? "UNSEEDED")}
      data-capture-ceiling={pacing?.maximumHz}
      data-calibration-capture={pacing?.calibrationCollecting ?? false}
      data-image-track-generation={indexState?.trackGeneration ?? 0}
      data-image-model-agreement={indexState?.modelAgreement ?? "UNAVAILABLE"}
      data-image-reason={indexStale ? "STALE" : (indexState?.reason ?? "UNSEEDED")}
      data-image-capture-time={indexState?.monotonicCaptureTime ?? ""}
      data-image-inference-time={indexState?.monotonicInferenceTime ?? ""}
    >
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>VOYAGEWRIGHT / REACH</p>
          <h1 id="reach-heading">Find your point.</h1>
          <p className={styles.intro}>See your hand. Find a comfortable rhythm. Explore a new way to point.</p>
        </div>
        <Link href={returnHref} onClick={stop} className={styles.return}>
          ← {returnLabel}
        </Link>
        {source !== "OFF" && <button onClick={stop}>Stop session</button>}
      </header>
      <ol className={styles.journey} aria-label="Your Reach journey">
        {["Prepare", "Calibrate", "Check", "Explore"].map((label, i) => {
          const current =
            step === "PREPARE"
              ? 0
              : step === "TRAINING"
                ? 1
                : step === "VALIDATION" || (step === "RESULTS" && calibration?.status !== "VALIDATED")
                  ? 2
                  : 3;
          return (
            <li key={label} aria-current={i === current ? "step" : undefined} data-active={i === current}>
              <span>{i < current ? "✓" : String(i + 1).padStart(2, "0")}</span>
              {label}
            </li>
          );
        })}
      </ol>
      {setupInvalidation && (
        <div ref={setupAlert} tabIndex={-1} className={styles.setupAlert} role="alert" aria-label="Setup ended">
          <strong>Setup ended</strong>
          <p>{setupInvalidation}</p>
          <p>Your camera remains available. Begin a fresh setup when your hand is ready.</p>
        </div>
      )}
      <div ref={workspace} className={styles.workspace} data-plane={showPlane} data-training={training}>
        <div className={styles.cameraStage}>
          <div className={styles.stageHeader}>
            <span>
              <i className={styles.light} data-on={source !== "OFF" && status !== "MODEL_STARTING"} />
              {source === "DEMO" ? "SIMULATED HAND" : "YOUR CAMERA"}
            </span>
            <span>{mirror ? "Mirrored preview" : "Natural preview"}</span>
          </div>
          <div className={`${styles.videoSurface} ${source === "DEMO" ? styles.demoSurface : ""}`}>
            <div className={`${styles.registration} ${mirror ? styles.mirrored : ""}`}>
              <video ref={video} muted playsInline aria-label="Local camera preview" />
              <ReachStage
                frame={visual}
                timings={timing}
                kind="CAMERA"
                demo={source === "DEMO"}
                active={source !== "OFF"}
              />
              {source === "LIVE" && pointingMode === "RELATIVE" && indexState && imagePreviewPoint && (
                <svg
                  className={`${styles.fingerOverlay} ${imageGesturePaused ? styles.fingerMatchPaused : ""}`}
                  viewBox={`0 0 ${indexState.frameWidth} ${indexState.frameHeight}`}
                  aria-label={imageGesturePaused ? "Finger image match, pointing paused" : "Finger image position"}
                >
                  <circle
                    cx={imagePreviewPoint.x * indexState.frameWidth}
                    cy={imagePreviewPoint.y * indexState.frameHeight}
                    r="9"
                  />
                </svg>
              )}
            </div>
            {markFinger && (
              <button
                autoFocus
                className={styles.fingerPicker}
                aria-label="Mark visible fingertip in camera. Click it, or use arrow keys and Enter. Escape cancels."
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  const width = video.current?.videoWidth ?? 0;
                  const height = video.current?.videoHeight ?? 0;
                  if (!width || !height) return;
                  const fit = containedFrame(rect.width, rect.height, width, height);
                  const x = (event.clientX - rect.left - fit.x) / fit.width;
                  const y = (event.clientY - rect.top - fit.y) / fit.height;
                  if (x < 0 || x > 1 || y < 0 || y > 1) return;
                  markVisibleFinger({ x: mirror ? 1 - x : x, y });
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setMarkFinger(false);
                    return;
                  }
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    markVisibleFinger({ x: mirror ? 1 - seedPoint.x : seedPoint.x, y: seedPoint.y });
                    return;
                  }
                  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
                  event.preventDefault();
                  setSeedPoint((p) => ({
                    x: Math.max(
                      0,
                      Math.min(1, p.x + (event.key === "ArrowRight" ? 0.01 : event.key === "ArrowLeft" ? -0.01 : 0)),
                    ),
                    y: Math.max(
                      0,
                      Math.min(1, p.y + (event.key === "ArrowDown" ? 0.01 : event.key === "ArrowUp" ? -0.01 : 0)),
                    ),
                  }));
                }}
              >
                <svg
                  viewBox={`0 0 ${frameSize?.frameWidth ?? 640} ${frameSize?.frameHeight ?? 480}`}
                  aria-hidden="true"
                >
                  <path
                    d={`M ${seedPoint.x * (frameSize?.frameWidth ?? 640) - 12} ${seedPoint.y * (frameSize?.frameHeight ?? 480)} h 24 M ${seedPoint.x * (frameSize?.frameWidth ?? 640)} ${seedPoint.y * (frameSize?.frameHeight ?? 480) - 12} v 24`}
                  />
                </svg>
                <span>Mark your fingertip · arrows + Enter · Esc to cancel</span>
              </button>
            )}
            {source === "OFF" && (
              <div className={styles.cameraPlaceholder}>
                <span className={styles.handIcon} aria-hidden="true">
                  ✧
                </span>
                <strong>Your hand, in view.</strong>
                <p>
                  Enable your camera when you are ready.
                  <br />
                  Everything is processed on this device.
                </p>
              </div>
            )}
            {source !== "OFF" && <div className={styles.frameGuide} aria-hidden="true" />}
            {source === "LIVE" && ["REQUESTING", "MODEL_STARTING"].includes(status) && (
              <div className={styles.loading}>{cameraText}…</div>
            )}
            {source === "DEMO" && <span className={styles.demoWatermark}>DEMO · CAMERA OFF</span>}
          </div>
          <div className={styles.cameraCaption}>
            <strong>
              {pointingMode === "RELATIVE" && indexStale
                ? "Waiting for fresh fingertip tracking"
                : pointingMode === "RELATIVE" && imageGesturePaused
                  ? "Fingertip image matched · pointing paused"
                  : pointingMode === "RELATIVE" && !indexStale && indexState?.state === "TRACKING"
                    ? "Finger image tracking"
                    : readiness.detectedCount
                      ? `${readiness.detectedCount} hand${readiness.detectedCount === 1 ? "" : "s"} detected`
                      : source === "OFF"
                        ? "Ready when you are"
                        : "Show your hand"}
            </strong>
            <span>
              {readiness.hand
                ? `${readiness.hand.handedness === "UNKNOWN" ? "Active" : readiness.hand.handedness === "LEFT" ? "Left" : "Right"} hand · ${assessment?.offImageFingerSupport ? "partial hand · some fingers inferred" : assessment?.partialFraming ? "partial hand · wrist optional" : assessment?.landmarkQuality === "TRACKED" ? "joints tracked" : "some joints hidden"}`
                : pointingMode === "RELATIVE" && !indexStale && indexState?.state === "TRACKING"
                  ? "Following your fingertip · hand model may be out of view"
                  : "Show an index point, or mark a visible fingertip below"}
            </span>
          </div>
          {source !== "OFF" && (
            <div className={styles.cameraTools}>
              {source === "LIVE" && status === "READY" && pointingMode === "RELATIVE" && (
                <button
                  disabled={indexState === null || indexStale}
                  onClick={() => {
                    setSeedPoint({ x: 0.5, y: 0.5 });
                    setMarkFinger((value) => !value);
                  }}
                >
                  {markFinger ? "Cancel fingertip hint" : "Track visible fingertip"}
                </button>
              )}
              <button
                onClick={() => {
                  const next = !mirror;
                  stop();
                  setMirror(next);
                  setMessage("Preview changed. Enable the camera or demo again to start a fresh setup.");
                }}
              >
                {mirror ? "Use natural preview" : "Mirror preview"}
              </button>
              <button onClick={stop}>Stop camera & clear session</button>
            </div>
          )}
          {source === "LIVE" && pointingMode === "RELATIVE" && (
            <p className={styles.fingerHelp}>
              Show a relaxed index point to start. If only the finger is visible, choose “Track visible fingertip” and
              mark its tip. This hint follows its appearance; it cannot identify a finger from appearance alone. A gold
              ring shows the image track.
            </p>
          )}
        </div>
        {showPlane && (
          <div className={styles.mobileFocus}>
            <p>
              {step === "RESULTS"
                ? "Your setup and independent results stay separate."
                : step === "PLAYGROUND"
                  ? "Move comfortably inside the outlined area."
                  : (relativeInstruction ??
                    (step === "VALIDATION"
                      ? pointingMode === "RELATIVE"
                        ? "Guide the amber cursor to each new target."
                        : "Point at each new target."
                      : "Point naturally at the lit target."))}
            </p>
            <strong>
              {step === "RESULTS"
                ? calibrationLabel
                : paused
                  ? message
                  : readiness.eligible
                    ? training
                      ? progress
                      : "Your hand is ready"
                    : readiness.guidance}
            </strong>
            {training ? (
              <>
                <span>
                  {readiness.detectedCount} hand{readiness.detectedCount === 1 ? "" : "s"} detected ·{" "}
                  {readiness.eligible ? "Point eligible" : "Collection paused"}
                  <br />
                  {completed} of {total} saved · {Math.round((acquisition?.progress ?? 0) * 100)}% collected
                </span>
                <progress aria-label="Target progress" max={1} value={acquisition?.progress ?? 0} />
              </>
            ) : (
              <span>
                {pointingMode === "RELATIVE" ? "Relative cursor control" : "Experimental absolute pointing"} ·{" "}
                {source === "DEMO" ? "Demo evidence" : "Local camera"}
              </span>
            )}
          </div>
        )}
        <div ref={plane} tabIndex={-1} className={styles.plane} hidden={!showPlane} aria-label="Pointing practice area">
          <div className={styles.planeHeader}>
            <span>
              {step === "PLAYGROUND"
                ? "POINTING PLAYGROUND"
                : step === "VALIDATION"
                  ? "INDEPENDENT CHECK"
                  : "YOUR POINTING AREA"}
            </span>
            <span>{pointingMode === "ABSOLUTE" ? "Absolute estimate" : "Relative movement"}</span>
          </div>
          <div className={styles.supportedRegion} aria-hidden="true" />
          <ReachStage
            frame={visual}
            timings={timing}
            kind="POINTER"
            overlay={overlay}
            active={showPlane && source !== "OFF"}
          />
          {(target || practiceTarget) && (
            <animated.div
              className={styles.target}
              role="img"
              data-calibration-target={!!target}
              animate={{
                left: `${(target ?? practiceTarget)!.x * 100}%`,
                top: `${(target ?? practiceTarget)!.y * 100}%`,
              }}
              initial={false}
              aria-label={target ? `Target ${completed + 1} of ${total}` : "Practice target"}
            >
              <svg viewBox="0 0 64 64" aria-hidden="true">
                <circle cx="32" cy="32" r="28" />
                <circle
                  className={styles.targetProgress}
                  cx="32"
                  cy="32"
                  r="28"
                  strokeDasharray={`${Math.max(0, acquisition?.progress ?? 0) * 176} 176`}
                />
              </svg>
              <span>{target ? completed + 1 : "+"}</span>
            </animated.div>
          )}
          {step === "RESULTS" && (
            <div className={styles.planeRest}>
              <span aria-hidden="true">{calibration?.status === "VALIDATED" ? "✓" : "◎"}</span>
              <strong>{calibrationLabel}</strong>
              <p>
                {calibration?.status === "VALIDATED"
                  ? "Your pointer is ready to explore this area."
                  : calibration?.status === "FAILED"
                    ? `All five targets were checked. The 95th-percentile error ${checkedError(calibration.validationP95)} exceeded the 3.00% accuracy limit. Your setup is kept.`
                    : "A successful setup still needs an independent check."}
              </p>
            </div>
          )}
          {pointerMessage && (step === "VALIDATION" || step === "PLAYGROUND") && (
            <p className={styles.pointerNotice} role="status" aria-label="Pointer feedback">
              {pointerMessage}
            </p>
          )}
          <div className={styles.planeCaption}>
            {step === "PLAYGROUND"
              ? "Move inside the outlined region. Practice targets only respond here."
              : step === "VALIDATION"
                ? "Amber pointer = provisional fit. These targets do not change the fit."
                : step === "RESULTS"
                  ? "Your setup stays local to this pointing area."
                  : `${paused ? "Paused" : readiness.eligible ? progress : readiness.guidance} · ${Math.round((acquisition?.progress ?? 0) * 100)}%`}
          </div>
        </div>
        <aside className={styles.guide} aria-label="Reach guidance">
          <p className={styles.eyebrow}>
            {training
              ? `${step === "TRAINING" ? "CALIBRATION" : "INDEPENDENT CHECK"} / ${completed + 1} OF ${total}`
              : step === "PLAYGROUND"
                ? "MAKE YOURSELF COMFORTABLE"
                : step === "RESULTS"
                  ? "YOUR SESSION"
                  : "LET’S BEGIN"}
          </p>
          <h2>
            {step === "PREPARE"
              ? source === "OFF"
                ? "Meet your hand."
                : "Find a relaxed point."
              : step === "TRAINING"
                ? "One target at a time."
                : step === "VALIDATION"
                  ? "A fresh check."
                  : step === "PLAYGROUND"
                    ? "Follow your movement."
                    : calibrationLabel}
          </h2>
          <p>
            {step === "PREPARE"
              ? "Place your camera near the screen. Sit at a comfortable distance and hold your hand between your chest and the camera, without stretching your arm."
              : (relativeInstruction ??
                (step === "VALIDATION"
                  ? pointingMode === "ABSOLUTE"
                    ? "Point at each new target. Hold a relaxed pose so we can measure the raw error."
                    : "Move your hand until the amber cursor reaches each new target, then hold. This checks cursor control, not physical pointing accuracy."
                  : step === "PLAYGROUND"
                    ? pointingMode === "RELATIVE"
                      ? "Move your hand left, right, up and down to guide the cursor from the comfortable reference you set."
                      : "Point within this calibrated area. If your setup moves, recalibrate."
                    : "Your setup and its independent results stay separate. You can retry whenever you like."))}
          </p>
          <div className={styles.statusCard} role="status" aria-label="Reach status">
            <span>{cameraText}</span>
            <strong>
              {source === "OFF"
                ? status === "DISABLED"
                  ? "Enable the camera to begin"
                  : cameraText
                : readiness.guidance}
            </strong>
            {source !== "OFF" && (
              <span>
                {readiness.detectedCount} detected ·{" "}
                {pointingMode === "RELATIVE"
                  ? imageGesturePaused
                    ? "Fingertip image matched · pointing paused"
                    : !indexStale && indexState?.state === "TRACKING"
                      ? "Fingertip appearance tracked"
                      : "Fingertip appearance uncertain"
                  : assessment?.framed
                    ? assessment.offImageFingerSupport
                      ? "Index and knuckles visible"
                      : assessment.partialFraming
                        ? "Required joints visible"
                        : "Hand framed"
                    : "Framing needs attention"}{" "}
                ·{" "}
                {pointingMode === "RELATIVE"
                  ? "Relative image control"
                  : assessment?.pointing
                    ? "Point recognized"
                    : "Point not yet recognized"}{" "}
                · {readiness.eligible ? "Eligible for collection" : "Collection waiting"}
              </span>
            )}
            {source === "LIVE" &&
              pointingMode === "RELATIVE" &&
              !indexStale &&
              indexState?.reason === "FULL_HAND_POINT_CONFIRMED" && (
                <span>
                  Full-hand detection confirms pointing. Image tracking keeps the fingertip position continuous.
                </span>
              )}
            {source === "LIVE" && assessment?.depthDominant && (
              <span>
                Index aimed toward the camera. Depth is inferred; the independent check still measures accuracy.
              </span>
            )}
            {source === "LIVE" && assessment?.intentEvidence === "HEURISTIC_INDEX_ONLY" && (
              <span>
                Index-only pointing is tentative. Hidden fingers cannot confirm intent; clearly conflicting visible
                gestures pause collection.
              </span>
            )}
            {source === "LIVE" &&
              pointingMode === "ABSOLUTE" &&
              assessment?.indexTracked &&
              readiness.condition === "GEOMETRY" && (
                <span>Index joints are detected; pointing geometry needs to settle. Collection is paused.</span>
              )}
          </div>
          {!setupInvalidation && (
            <p className={styles.sessionMessage} aria-live="polite">
              {message}
            </p>
          )}
          {localPoseRecording && step === "PREPARE" && (
            <p className={styles.hint}>
              <Link href="/devices/reach/record" onClick={stop}>
                Record guided poses for local testing
              </Link>
              {" · video and landmark trace; no calibration fit"}
            </p>
          )}
          {hands.length > 1 && pointingMode === "ABSOLUTE" && (
            <div className={styles.handChoice}>
              <span>Active hand</span>
              {hands.map((hand, i) => (
                <button
                  key={hand.trackId}
                  aria-pressed={readiness.hand?.trackId === hand.trackId}
                  onClick={() => {
                    selector.current.choose(hand.trackId);
                    invalidate("Hand chosen. Hold briefly, then begin a fresh setup.");
                  }}
                >
                  {hand.handedness === "UNKNOWN"
                    ? `Hand ${i + 1}`
                    : hand.handedness === "LEFT"
                      ? "Left hand"
                      : "Right hand"}
                </button>
              ))}
            </div>
          )}
          {step === "PREPARE" && (
            <>
              {source === "OFF" ? (
                <div className={styles.actions}>
                  <button className={styles.primary} onClick={startCamera}>
                    {status === "DISABLED" ? "Enable live camera" : "Retry live camera"}
                  </button>
                  <button onClick={startDemo}>Explore guided demo</button>
                </div>
              ) : (
                <>
                  <fieldset className={styles.modeChoice}>
                    <legend>How would you like to point?</legend>
                    <label>
                      <input
                        aria-label="Relative movement"
                        type="radio"
                        name="pointing-mode"
                        checked={pointingMode === "RELATIVE"}
                        onChange={() => {
                          invalidate();
                          changePointingMode("RELATIVE");
                        }}
                      />
                      <span>
                        <strong>
                          Relative movement <small>Recommended</small>
                        </strong>
                        <span>Move your hand to guide a cursor. Comfortable with an ordinary webcam.</span>
                      </span>
                    </label>
                    <label>
                      <input
                        aria-label="Absolute pointing"
                        type="radio"
                        name="pointing-mode"
                        checked={pointingMode === "ABSOLUTE"}
                        onChange={() => {
                          invalidate();
                          changePointingMode("ABSOLUTE");
                        }}
                      />
                      <span>
                        <strong>
                          Absolute pointing <small>Experimental</small>
                        </strong>
                        <span>Point at the screen. Your camera and posture must pass a separate accuracy check.</span>
                      </span>
                    </label>
                  </fieldset>
                  <button className={styles.primary} disabled={!entryReady} onClick={() => begin("TRAINING")}>
                    {pointingMode === "ABSOLUTE" ? "Begin nine-point calibration" : "Set up relative movement"}
                  </button>
                  {entryReady && (
                    <p className={styles.hint}>Setup can begin now. Collection waits for fresh eligible tracking.</p>
                  )}
                  {!entryReady && (
                    <p className={styles.hint}>
                      Waiting for the camera and hand model to start. Tracking can settle after setup begins.
                    </p>
                  )}
                </>
              )}
            </>
          )}
          {training && (
            <>
              <div className={styles.acquisition}>
                <div>
                  <strong>{progress}</strong>
                  <span>{Math.round((acquisition?.progress ?? 0) * 100)}%</span>
                </div>
                <progress aria-label="Current target acquisition" max={1} value={acquisition?.progress ?? 0} />
                <p>
                  {completed} of {total} targets saved. Brief interruptions pause collection; only fresh, stable samples
                  count.
                </p>
              </div>
              <div className={styles.actions}>
                {source === "DEMO" && <button onClick={moveDemoToTarget}>Move demo hand to target</button>}
                <button className={styles.primary} onClick={togglePause}>
                  {step === "VALIDATION"
                    ? paused
                      ? "Resume check"
                      : "Pause check"
                    : paused
                      ? "Resume calibration"
                      : "Pause calibration"}
                </button>
                <button onClick={retryTarget}>Retry this target</button>
                <button
                  onClick={() => {
                    trial.current = null;
                    setTarget(null);
                    setAcquisition(null);
                    advance(calibrationRef.current ? "RESULTS" : "PREPARE");
                    setMessage(
                      `${step === "VALIDATION" ? "Check" : "Calibration"} cancelled. Your camera stays available.`,
                    );
                  }}
                >
                  {step === "VALIDATION" ? "Cancel check" : "Cancel calibration"}
                </button>
              </div>
            </>
          )}
          {step === "RESULTS" && (
            <>
              <div className={styles.actions}>
                {calibration?.status === "VALIDATED" ? (
                  <button
                    className={styles.primary}
                    onClick={() => {
                      advance("PLAYGROUND");
                      setMessage("Explore freely. No application actions are triggered by pointing.");
                    }}
                  >
                    Open pointing playground
                  </button>
                ) : (
                  calibration && (
                    <button className={styles.primary} onClick={() => begin("VALIDATION")}>
                      {calibration.status === "FAILED" ? "Retry independent check" : "Check five new targets"}
                    </button>
                  )
                )}
                <button
                  onClick={() => {
                    invalidate();
                    advance("PREPARE");
                    setMessage("Adjust your camera if needed, then begin a fresh setup.");
                  }}
                >
                  Recalibrate
                </button>
                {pointingMode === "ABSOLUTE" && calibration?.status !== "VALIDATED" && (
                  <button
                    onClick={() => {
                      invalidate();
                      changePointingMode("RELATIVE");
                      advance("PREPARE");
                      setMessage("Relative movement uses hand displacement. Start its separate setup.");
                    }}
                  >
                    Try relative movement
                  </button>
                )}
              </div>
              <dl className={styles.results}>
                <div>
                  <dt>
                    {pointingMode === "ABSOLUTE" ? "Pointing error on new targets" : "Cursor error on new targets"}
                  </dt>
                  <dd>
                    {percent(calibration?.validationP95)}
                    <small>of this area’s diagonal</small>
                  </dd>
                </div>
                <div>
                  <dt>Movement during steady holds</dt>
                  <dd>
                    {percent(calibration?.validationJitterP95)}
                    <small>during target holds</small>
                  </dd>
                </div>
                <div>
                  <dt>Supported area</dt>
                  <dd>
                    {calibration ? "Central 80%" : "Not established"}
                    <small>estimates stop outside the tested range</small>
                  </dd>
                </div>
              </dl>
              {calibration?.validationSummary && (
                <div className={styles.validationExplanation} role="note" aria-label="Independent check explanation">
                  <strong>
                    {calibration.status === "FAILED" ? "Why another check is offered" : "Why this check passed"}
                  </strong>
                  <p>
                    All {calibration.validationSummary.targetCount} check targets were recorded. Your 95th-percentile
                    error was {checkedError(calibration.validationSummary.p95DiagonalFraction)} of the pointing area’s
                    diagonal; the required limit is {percent(calibration.validationSummary.p95LimitDiagonalFraction)}.
                  </p>
                  <p>
                    Your setup is kept. These check targets did not change its fit.
                    {calibration.status === "FAILED"
                      ? " Retry the check if you missed a target. Recalibrate if the pointer consistently misses, or use relative movement for a more comfortable starting point."
                      : " You can now explore the playground."}
                  </p>
                  <p>Steady-hold movement is shown separately as a diagnostic; it is not an extra pass/fail rule.</p>
                </div>
              )}
              <p className={styles.hint}>
                {source === "DEMO"
                  ? "Demo results only. They do not establish webcam accuracy."
                  : pointingMode === "RELATIVE"
                    ? "This checks movement control. It does not measure where you physically point."
                    : "This result applies to this session and setup. Real webcam qualification is still separate."}
              </p>
            </>
          )}
          {step === "PLAYGROUND" && (
            <>
              <div className={styles.actions}>
                {source === "DEMO" && practiceTarget && (
                  <button onClick={moveDemoToTarget}>Move demo hand to target</button>
                )}
                <button
                  className={styles.primary}
                  onClick={() => {
                    const p =
                      calibrationLayout.validation[Math.floor(Math.random() * calibrationLayout.validation.length)];
                    setPracticeTarget(p);
                    setMessage("Practice target shown. Move the cursor toward it; nothing activates.");
                  }}
                >
                  Show a practice target
                </button>
                <button
                  onClick={() => {
                    setPracticeTarget(null);
                    advance("RESULTS");
                    setMessage("Practice paused. Your session result is saved.");
                  }}
                >
                  Pause playground
                </button>
                <button
                  onClick={() => {
                    invalidate();
                    advance("PREPARE");
                    setMessage("Begin a fresh setup when you are ready.");
                  }}
                >
                  Recalibrate
                </button>
              </div>
              <label className={styles.check}>
                <input type="checkbox" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} />
                Show raw pointer alongside filtered pointer
              </label>
              <p className={styles.hint}>
                The shaded area shows measured held-out error, not model confidence. Brief uncertainty shows a fading,
                dashed last-seen marker; it never counts as a new sample.
              </p>
            </>
          )}
          <details className={styles.diagnostics}>
            <summary>Session diagnostics & privacy</summary>
            <div className={styles.diagnosticBody}>
              <p>
                Advanced measurements are local and bounded to this session. Model handedness scores are not intent
                confidence. RGB landmarks do not establish metric depth or a physical display ray. Camera movement may
                be undetectable; recalibrate after changing camera or seating.
              </p>
              <dl className={styles.metricGrid}>
                <div>
                  <dt>Evidence</dt>
                  <dd>{source === "DEMO" ? "D0 simulation" : "Unqualified live camera"}</dd>
                </div>
                <div>
                  <dt>Inference observations</dt>
                  <dd>{metrics.observations}</dd>
                </div>
                <div>
                  <dt>Model processing</dt>
                  <dd>
                    {source === "DEMO"
                      ? "Guided simulation"
                      : inferenceBackend
                        ? inferenceBackend === "GPU_WEBGL"
                          ? "GPU accelerated"
                          : "CPU (WASM)"
                        : "Waiting for camera"}
                  </dd>
                </div>
                <div>
                  <dt>Capture interval p95</dt>
                  <dd>{metrics.capture?.toFixed(1) ?? "—"} ms</dd>
                </div>
                <div>
                  <dt>Recent hand-model updates</dt>
                  <dd>{metrics.captureHz?.toFixed(1) ?? "—"} / second</dd>
                </div>
                <div>
                  <dt>Tracking rate limit</dt>
                  <dd>
                    {pacing?.maximumHz ?? "—"} / second{" "}
                    {pacing ? (pacing.calibrationCollecting ? "· calibration" : "· normal tracking") : ""}
                  </dd>
                </div>
                <div>
                  <dt>Adaptive capture target</dt>
                  <dd>
                    {pacing?.targetHz.toFixed(1) ?? "—"} / second{" "}
                    {pacing ? (pacing.focused ? "· focused" : "· reduced while unfocused") : ""}
                  </dd>
                </div>
                <div>
                  <dt>Main-thread tracking work</dt>
                  <dd>{pacing?.smoothedMainThreadMs?.toFixed(1) ?? "—"} ms / frame</dd>
                </div>
                <div>
                  <dt>Capture → inference p95</dt>
                  <dd>{metrics.inference?.toFixed(1) ?? "—"} ms</dd>
                </div>
                <div>
                  <dt>Capture → canvas submission p95</dt>
                  <dd>{metrics.submission?.toFixed(1) ?? "—"} ms</dd>
                </div>
                <div>
                  <dt>Canvas update interval p95</dt>
                  <dd>{metrics.visualization?.toFixed(1) ?? "—"} ms</dd>
                </div>
              </dl>
              <p>
                Software capture begins at frame bitmap acquisition. Canvas submission ends at drawing commands; this
                excludes sensor exposure, compositor presentation and display scanout. Synthetic timing is not inference
                performance.
              </p>
              <p>
                Normal tracking is capped at 30 updates per second; active calibration collection is capped at 60.
                Capture adapts to processing time and event-loop pressure, with one inference in flight. The target is a
                ceiling, not a guaranteed camera rate. Visible unfocused pages slow down; hiding the page stops the
                camera. These signals do not measure total system CPU use.
              </p>
              <p>
                Calibration: {calibration?.mapping ?? "none"} · {calibration?.status ?? "REQUIRED"} · no target snapping
                · physical qualification pending.
              </p>
              <label className={styles.check}>
                <input type="checkbox" checked={exportConsent} onChange={(e) => setExportConsent(e.target.checked)} />I
                consent to downloading this session’s aggregate metrics.
              </label>
              <div className={styles.actions}>
                <button disabled={!exportConsent} onClick={exportMetrics}>
                  Export aggregate metrics
                </button>
                <button
                  onClick={() => {
                    invalidate("Calibration deleted. Your camera remains available.");
                    aggregates.current = [];
                  }}
                >
                  Delete calibration
                </button>
                <button onClick={() => setLogEntries([])}>Clear session log</button>
              </div>
              <p>
                Export contains aggregate errors and bounded reason codes. It excludes video, landmarks, camera
                identifiers, track identifiers and coefficients. Stop clears session metrics; up to ten fit summaries
                otherwise remain in memory.
              </p>
              <ul>
                {logEntries.map((entry, i) => (
                  <li key={i}>
                    {entry.at}: {entry.reason}
                  </li>
                ))}
              </ul>
            </div>
          </details>
        </aside>
      </div>
      {source === "DEMO" && (
        <details className={styles.demoControls} open>
          <summary>Guided demo controls</summary>
          <p>The simulated hand follows these controls. This walkthrough cannot prove physical accuracy.</p>
          <div className={styles.demoRow}>
            {(["x", "y"] as const).map((axis) => (
              <label key={axis}>
                {axis === "x" ? "Across" : "Up / down"}
                <input
                  aria-label={`Demo ${axis}`}
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.01"
                  value={point[axis]}
                  onChange={(e) => setPoint((p) => ({ ...p, [axis]: Number(e.target.value) }))}
                />
              </label>
            ))}
            <label>
              Tracking condition
              <select
                aria-label="Demo tracking condition"
                value={demoFault}
                onChange={(e) => {
                  setDemoFault(e.target.value);
                  if (trial.current?.binding) {
                    trial.current.after = performance.now() + 350;
                  }
                }}
              >
                <option value="NONE">Pointing hand</option>
                <option value="TWO_HANDS">Second hand nearby</option>
                <option value="EDGE">Index near the edge</option>
                <option value="POSTURE">Finger bent</option>
                <option value="NO_HAND">Hand briefly hidden</option>
              </select>
            </label>
          </div>
        </details>
      )}
      <footer className={styles.footer}>
        <p>
          <span aria-hidden="true">◇</span> Private by design. No microphone, video storage, upload or saved
          calibration.
        </p>
        <p>Reach is an interaction laboratory. Pointing here does not select or activate Voyagewright objects.</p>
      </footer>
    </section>
  );
}
