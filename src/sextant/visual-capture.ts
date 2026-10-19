import { z } from "zod";

const ephemeralId = z.string().min(1).max(128);
const version = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const time = z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER);
const support = z.enum(["UNKNOWN", "UNSUPPORTED", "SUPPORTED"]);
export const visualModalitySchema = z.enum(["COLOR", "INFRARED", "DEPTH"]);
export const visualPixelFormatSchema = z
  .strictObject({
    pixelFormat: z.string().regex(/^[A-Z0-9_]{1,40}$/),
    layout: z.enum(["PACKED", "OPAQUE"]),
    bytesPerPixel: z.number().int().min(1).max(16).nullable(),
    rowStrideBytes: z.number().int().min(1).max(268435456).nullable(),
  })
  .refine(
    (f) =>
      f.layout === "PACKED"
        ? f.bytesPerPixel !== null && f.rowStrideBytes !== null
        : f.bytesPerPixel === null && f.rowStrideBytes === null,
    "VISUAL_PIXEL_LAYOUT_INVALID",
  );

/** Current provider/access-context declarations only. No discovery, capture, device-name inference or permanent hardware claim. */
export const visualCaptureDescriptorSchema = z.strictObject({
  schemaVersion: z.literal(1),
  providerId: ephemeralId,
  providerVersion: ephemeralId,
  ephemeralSourceId: ephemeralId,
  ephemeralGroupId: ephemeralId.nullable(),
  modality: visualModalitySchema,
  detected: z.enum(["UNKNOWN", "ABSENT", "PRESENT"]),
  access: z.enum(["UNKNOWN", "UNSUPPORTED", "AVAILABLE", "BUSY", "UNAVAILABLE"]),
  permission: z.enum(["UNKNOWN", "PROMPT", "GRANTED", "DENIED", "RESTRICTED", "NOT_REQUIRED"]),
  streaming: z.enum(["UNKNOWN", "STOPPED", "STREAMING", "INTERRUPTED"]),
  controls: z.strictObject({
    exposure: support,
    driverManagedIllumination: support,
    directInfraredLed: support,
  }),
  controlQueryContext: z.enum(["UNKNOWN", "DISCOVERY_ONLY", "SHARED_READ_ONLY", "EXCLUSIVE_CONTROL"]).optional(),
  // Watchglass supplies this reference. Sextant does not assess model quality or modality compatibility.
  consumerQualifiedProfile: z
    .strictObject({ owner: z.literal("WATCHGLASS"), profileId: ephemeralId, qualificationReference: ephemeralId })
    .optional(),
  declaredFormats: z.array(visualPixelFormatSchema).max(32).optional(),
});
export type VisualCaptureDescriptor = z.infer<typeof visualCaptureDescriptorSchema>;

export const visualSourceBindingSchema = z
  .strictObject({
    providerId: ephemeralId,
    providerVersion: ephemeralId,
    ephemeralSourceId: ephemeralId,
    ephemeralGroupId: ephemeralId.nullable(),
    modality: visualModalitySchema,
    leaseId: ephemeralId,
    leaseGeneration: version,
    providerGeneration: version,
    geometryVersion: version,
    width: z.number().int().min(1).max(16384),
    height: z.number().int().min(1).max(16384),
    rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
    mirrored: z.boolean(),
    format: visualPixelFormatSchema,
  })
  .refine(
    (s) =>
      s.format.layout !== "PACKED" ||
      (s.format.rowStrideBytes! >= s.width * s.format.bytesPerPixel! &&
        s.format.rowStrideBytes! * s.height <= 268435456),
    "VISUAL_PACKED_RESOURCE_BOUNDS_INVALID",
  );
export type VisualSourceBinding = z.infer<typeof visualSourceBindingSchema>;
export const visualFrameMetadataSchema = z.strictObject({
  schemaVersion: z.literal(1),
  source: visualSourceBindingSchema,
  sequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  capture: z.strictObject({ clockDomain: ephemeralId, timestampMs: time, uncertaintyMs: time }),
  received: z.strictObject({ clockDomain: ephemeralId, timestampMs: time }),
  clockCalibrationVersion: version.nullable(),
});
export type VisualFrameMetadata = z.infer<typeof visualFrameMetadataSchema>;

/** Supplied by the already-authorized lease owner; frames cannot authorize their own clock conversion. */
export const visualFrameAuthorizationSchema = z.strictObject({
  source: visualSourceBindingSchema,
  referenceClockDomain: ephemeralId,
  maximumCaptureAgeMs: z.number().finite().positive().max(60000),
  clockCalibration: z
    .strictObject({
      version,
      sourceClockDomain: ephemeralId,
      referenceClockDomain: ephemeralId,
      offsetMs: z.number().finite().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),
      uncertaintyMs: time,
      validFromMs: time,
      validUntilMs: time,
    })
    .refine((c) => c.validUntilMs > c.validFromMs, "VISUAL_CLOCK_CALIBRATION_INTERVAL_INVALID")
    .nullable(),
});
export type VisualFrameAuthorization = z.infer<typeof visualFrameAuthorizationSchema>;

export const visualCapturePolicy = Object.freeze({
  defaultMaximumPairSkewMs: 10,
  maximumAuthorizedCaptureAgeMs: 60000,
  futureToleranceMs: 5,
});

function freezeMetadata(value: VisualFrameMetadata): Readonly<VisualFrameMetadata> {
  Object.freeze(value.source.format);
  Object.freeze(value.source);
  Object.freeze(value.capture);
  Object.freeze(value.received);
  return Object.freeze(value);
}

/** Opaque in-memory ownership, deliberately unusable as a JSON event or persistence payload. */
export class VisualFrameHandle<T> {
  readonly metadata: Readonly<VisualFrameMetadata>;
  #payload: T | undefined;
  #releasePayload: (() => void) | null;
  #closed = false;
  #closeSucceeded = true;

  private constructor(metadata: VisualFrameMetadata, payload: T, releasePayload: (payload: T) => void) {
    this.metadata = freezeMetadata(metadata);
    Object.defineProperty(this, "metadata", { writable: false, configurable: false });
    this.#payload = payload;
    this.#releasePayload = () => releasePayload(payload);
  }

  static create<T>(metadata: unknown, payload: T, releasePayload: (payload: T) => void): VisualFrameHandle<T> {
    try {
      const parsed = visualFrameMetadataSchema.parse(metadata);
      const format = parsed.source.format;
      if (format.layout === "PACKED") {
        const bytes = payload instanceof ArrayBuffer || ArrayBuffer.isView(payload) ? payload.byteLength : null;
        if (bytes !== format.rowStrideBytes! * parsed.source.height) throw new Error("VISUAL_PAYLOAD_SIZE_INVALID");
      } else if (payload instanceof ArrayBuffer || ArrayBuffer.isView(payload)) {
        throw new Error("VISUAL_BYTE_PAYLOAD_REQUIRES_PACKED_FORMAT");
      }
      return new VisualFrameHandle(parsed, payload, releasePayload);
    } catch (error) {
      try {
        releasePayload(payload);
      } catch {
        // A failed disposer cannot prevent rejection of malformed input.
      }
      throw error;
    }
  }

  get closed() {
    return this.#closed;
  }

  get payload(): T {
    if (this.#closed) throw new Error("VISUAL_FRAME_CLOSED");
    return this.#payload as T;
  }

  close(): boolean {
    if (this.#closed) return this.#closeSucceeded;
    this.#closed = true;
    const release = this.#releasePayload;
    this.#releasePayload = null;
    this.#payload = undefined;
    try {
      release?.();
      return true;
    } catch {
      this.#closeSucceeded = false;
      return false;
    }
  }

  toJSON(): never {
    throw new Error("VISUAL_FRAME_SERIALIZATION_FORBIDDEN");
  }
}

const sourceKeys = Object.keys(visualSourceBindingSchema.shape) as (keyof VisualSourceBinding)[];
function sameSource(a: VisualSourceBinding, b: VisualSourceBinding) {
  return (
    sourceKeys.every((key) => key === "format" || a[key] === b[key]) &&
    Object.keys(a.format).every(
      (key) => a.format[key as keyof typeof a.format] === b.format[key as keyof typeof b.format],
    )
  );
}

type CheckedClock = { ok: true; timestampMs: number; uncertaintyMs: number } | { ok: false; reason: string };
function checkFrame<T>(frame: VisualFrameHandle<T>, auth: VisualFrameAuthorization, now: number): CheckedClock {
  if (!Number.isFinite(now) || now < 0) return { ok: false, reason: "VISUAL_CLOCK_INVALID" };
  if (frame.closed) return { ok: false, reason: "VISUAL_FRAME_CLOSED" };
  const m = frame.metadata;
  if (!sameSource(m.source, auth.source)) return { ok: false, reason: "VISUAL_SOURCE_MISMATCH" };
  if (m.received.clockDomain !== auth.referenceClockDomain)
    return { ok: false, reason: "VISUAL_CLOCK_DOMAIN_MISMATCH" };
  let timestampMs = m.capture.timestampMs;
  let uncertaintyMs = m.capture.uncertaintyMs;
  if (m.capture.clockDomain === auth.referenceClockDomain) {
    if (m.clockCalibrationVersion !== null) return { ok: false, reason: "VISUAL_CLOCK_CALIBRATION_MISMATCH" };
  } else {
    const c = auth.clockCalibration;
    if (
      !c ||
      m.clockCalibrationVersion !== c.version ||
      c.sourceClockDomain !== m.capture.clockDomain ||
      c.referenceClockDomain !== auth.referenceClockDomain
    )
      return { ok: false, reason: "VISUAL_CLOCK_UNCALIBRATED" };
    timestampMs += c.offsetMs;
    uncertaintyMs += c.uncertaintyMs;
    if (
      now < c.validFromMs ||
      now > c.validUntilMs ||
      timestampMs - uncertaintyMs < c.validFromMs ||
      timestampMs + uncertaintyMs > c.validUntilMs
    )
      return { ok: false, reason: "VISUAL_CLOCK_CALIBRATION_EXPIRED" };
  }
  if (
    !Number.isFinite(timestampMs) ||
    !Number.isFinite(uncertaintyMs) ||
    timestampMs < 0 ||
    m.received.timestampMs > now + visualCapturePolicy.futureToleranceMs ||
    timestampMs + uncertaintyMs > m.received.timestampMs + visualCapturePolicy.futureToleranceMs ||
    timestampMs + uncertaintyMs > now + visualCapturePolicy.futureToleranceMs
  )
    return { ok: false, reason: "VISUAL_CLOCK_INVALID" };
  if (now - (timestampMs - uncertaintyMs) > auth.maximumCaptureAgeMs)
    return { ok: false, reason: "VISUAL_FRAME_STALE" };
  return { ok: true, timestampMs, uncertaintyMs };
}

/** A single latest-frame slot, not an acquisition broker or media history. take() transfers ownership. */
export class VisualCaptureLatest<T> {
  readonly #authorization: VisualFrameAuthorization;
  #latest: VisualFrameHandle<T> | null = null;
  #lastSequence = -1;
  #lastCapture = -Infinity;
  #disposed = false;

  constructor(authorization: unknown) {
    this.#authorization = visualFrameAuthorizationSchema.parse(authorization);
  }

  offer(frame: VisualFrameHandle<T>, now: number): { accepted: true } | { accepted: false; reason: string } {
    const checked = checkFrame(frame, this.#authorization, now);
    const reason = this.#disposed
      ? "VISUAL_LIFECYCLE_ENDED"
      : !checked.ok
        ? checked.reason
        : frame.metadata.sequence <= this.#lastSequence || checked.timestampMs <= this.#lastCapture
          ? "VISUAL_FRAME_REORDERED"
          : null;
    if (reason) {
      frame.close();
      return { accepted: false, reason };
    }
    if (!checked.ok) throw new Error("VISUAL_INTERNAL_CLOCK_GUARD");
    this.#lastSequence = frame.metadata.sequence;
    this.#lastCapture = checked.timestampMs;
    this.#latest?.close();
    this.#latest = frame;
    return { accepted: true };
  }

  take(now: number): VisualFrameHandle<T> | null {
    const frame = this.#latest;
    this.#latest = null;
    if (frame && !checkFrame(frame, this.#authorization, now).ok) {
      frame.close();
      return null;
    }
    return frame;
  }

  dispose() {
    this.#disposed = true;
    this.#latest?.close();
    this.#latest = null;
  }
}

export const visualGeometryRegistrationSchema = z.strictObject({
  verified: z.literal(true),
  evidenceReference: ephemeralId,
  left: visualSourceBindingSchema,
  right: visualSourceBindingSchema,
});
type Registration = z.infer<typeof visualGeometryRegistrationSchema>;
function registeredSource(side: Registration["left"], source: VisualSourceBinding) {
  return sameSource(side, source);
}

/** No coordinates are fused here. A registration reference only permits the consumer's separately validated transform. */
export function pairVisualFrames<L, R>(
  left: VisualFrameHandle<L>,
  right: VisualFrameHandle<R>,
  input: {
    left: VisualFrameAuthorization;
    right: VisualFrameAuthorization;
    maximumSkewMs?: number;
    registration?: Registration;
    requireRegisteredGeometry?: boolean;
  },
  now: number,
) {
  const reject = (reason: string) => {
    left.close();
    right.close();
    return { ok: false as const, reason };
  };
  const authorization = z
    .strictObject({
      left: visualFrameAuthorizationSchema,
      right: visualFrameAuthorizationSchema,
      maximumSkewMs: z.number().finite().min(0).max(visualCapturePolicy.maximumAuthorizedCaptureAgeMs).optional(),
      registration: visualGeometryRegistrationSchema.optional(),
      requireRegisteredGeometry: z.boolean().optional(),
    })
    .safeParse(input);
  if (!authorization.success) return reject("VISUAL_PAIR_AUTHORIZATION_INVALID");
  const a = authorization.data;
  const maximumSkewMs = a.maximumSkewMs ?? visualCapturePolicy.defaultMaximumPairSkewMs;
  if (maximumSkewMs > Math.min(a.left.maximumCaptureAgeMs, a.right.maximumCaptureAgeMs))
    return reject("VISUAL_PAIR_AUTHORIZATION_INVALID");
  const lc = checkFrame(left, a.left, now),
    rc = checkFrame(right, a.right, now);
  if (!lc.ok) return reject(lc.reason);
  if (!rc.ok) return reject(rc.reason);
  if (
    left === (right as unknown) ||
    a.left.referenceClockDomain !== a.right.referenceClockDomain ||
    !a.left.source.ephemeralGroupId ||
    a.left.source.ephemeralGroupId !== a.right.source.ephemeralGroupId ||
    a.left.source.ephemeralSourceId === a.right.source.ephemeralSourceId
  )
    return reject("VISUAL_PAIR_SOURCE_OR_CLOCK_MISMATCH");
  const skewUpperBoundMs = Math.abs(lc.timestampMs - rc.timestampMs) + lc.uncertaintyMs + rc.uncertaintyMs;
  if (skewUpperBoundMs > maximumSkewMs) return reject("VISUAL_PAIR_SKEW_EXCEEDED");
  if (
    a.registration &&
    (!registeredSource(a.registration.left, a.left.source) || !registeredSource(a.registration.right, a.right.source))
  )
    return reject("VISUAL_GEOMETRY_REGISTRATION_MISMATCH");
  if (a.requireRegisteredGeometry && !a.registration) return reject("VISUAL_GEOMETRY_UNREGISTERED");
  return {
    ok: true as const,
    left,
    right,
    skewUpperBoundMs,
    usage: a.registration ? ("REGISTERED_COORDINATE_FUSION" as const) : ("ACQUISITION_ASSISTANCE_ONLY" as const),
    registrationReference: a.registration?.evidenceReference ?? null,
    close: () => {
      const l = left.close(),
        r = right.close();
      return l && r;
    },
  };
}
