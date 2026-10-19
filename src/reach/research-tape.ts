/** Private research branch only. Inverse removal restores the retained application. */
export const REACH_RESEARCH_MARKER = "REACH_RESEARCH_20261019_7f843a2d";
type AnyRecord = Record<string, any>;
type BlobRecord = { id: string; byteLength: number; data: Uint8Array };
type Graph = { root: any; objects: AnyRecord[] };
const scope = globalThis as any;
const nativeNow = () => globalThis.performance?.now?.() ?? Date.now();
const registeredPrototypes = new WeakMap<object, string>();
const instanceKind = (value: object) => registeredPrototypes.get(Object.getPrototypeOf(value));

export class ResearchBudget {
  used = 0;
  peak = 0;
  constructor(readonly limit = 16 * 1024 * 1024) {}
  reserve(bytes: number) {
    if (!Number.isSafeInteger(bytes) || bytes < 0 || this.used + bytes > this.limit) return false;
    this.used += bytes;
    this.peak = Math.max(this.peak, this.used);
    return true;
  }
  release(bytes: number) { this.used = Math.max(0, this.used - bytes); }
}

/** Versioned graph identities are weak; acknowledged binary bytes are released. */
export class ResearchGraphEncoder {
  private ids = new WeakMap<object, { id: string; version: number }>();
  private immutable = new WeakMap<object, { id: string; byteLength: number }>();
  private latestBlob = new WeakMap<object, { id: string; byteLength: number }>();
  private nextId = 0;
  private nextBlob = 0;
  private finalizer: FinalizationRegistry<number> | null;
  private disposed = false;
  identitiesCreated = 0;
  identitiesFinalized = 0;
  constructor(readonly budget: ResearchBudget) {
    this.finalizer = typeof FinalizationRegistry === "function"
      ? new FinalizationRegistry(bytes => { if (!this.disposed) { budget.release(bytes); this.identitiesFinalized++; } }) : null;
  }
  dispose() { this.disposed = true; }
  identity(value: object) {
    let item = this.ids.get(value);
    if (!item) {
      if (!this.budget.reserve(256)) throw new Error("RESEARCH_ID_BUDGET");
      item = { id: `o${++this.nextId}`, version: 0 };
      this.ids.set(value, item);
      this.identitiesCreated++;
      this.finalizer?.register(value, 256);
    }
    return item;
  }
  aliasImmutable(target: ArrayBufferView, source: ArrayBufferView) {
    const known = this.latestBlob.get(source);
    if (!known || target.byteLength !== source.byteLength) throw new Error("RESEARCH_BLOB_ALIAS_MISSING");
    const a = new Uint8Array(target.buffer, target.byteOffset, target.byteLength);
    const b = new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) throw new Error("RESEARCH_BLOB_ALIAS_DIFFERENT");
    this.immutable.set(target, known);
  }
  markImmutable(view: ArrayBufferView) {
    const known = this.latestBlob.get(view);
    if (known) this.immutable.set(view, known);
  }
  markStateImmutable(value: any, seen = new WeakSet<object>(), depth = 0) {
    if (!value || typeof value !== "object" || depth > 20 || seen.has(value)) return;
    if (instanceKind(value)) return;
    seen.add(value);
    if (ArrayBuffer.isView(value)) { this.markImmutable(value); return; }
    for (const key of Object.keys(value)) this.markStateImmutable(value[key], seen, depth + 1);
  }
  encode(value: any): { payload: Graph; blobs: BlobRecord[]; blobCharge: number; scratchCharge: number } {
    if (!this.budget.reserve(512 * 1024)) throw new Error("RESEARCH_SNAPSHOT_RESERVATION");
    const objects: AnyRecord[] = [], blobs: BlobRecord[] = [];
    const visited = new Map<object, AnyRecord>();
    let blobCharge = 0;
    let properties = 0, strings = 0;
    const visit = (input: any, depth = 0): any => {
      if (depth > 32 || objects.length > 1024 || properties > 4096) throw new Error("RESEARCH_GRAPH_LIMIT");
      if (typeof input === "string") { strings += input.length; if (strings > 65536) throw new Error("RESEARCH_STRING_LIMIT"); }
      if (input === undefined) return { $: "undefined" };
      if (typeof input === "number" && (!Number.isFinite(input) || Object.is(input, -0)))
        return { $: "number", value: Object.is(input, -0) ? "-0" : String(input) };
      if (typeof input === "bigint") return { $: "bigint", value: String(input) };
      if (input === null || ["string", "number", "boolean"].includes(typeof input)) return input;
      if (typeof input === "symbol") throw new Error("RESEARCH_SYMBOL_UNSUPPORTED");
      const identity = this.identity(input);
      if (typeof input === "function") return { $: "function", id: identity.id };
      const kind = instanceKind(input);
      if (kind) return { $: "instance", id: identity.id, kind };
      const existing = visited.get(input);
      if (existing) return { $: "ref", id: existing.id, version: existing.version };
      const record: AnyRecord = {
        id: identity.id, version: ++identity.version,
        type: Array.isArray(input) ? "Array" : input instanceof Error ? "Error" : "Object", props: [],
      };
      visited.set(input, record); objects.push(record);
      if (ArrayBuffer.isView(input)) {
        const known = this.immutable.get(input);
        let blob = known;
        if (!blob) {
          const charge = input.byteLength * 12 + 256;
          if (!this.budget.reserve(charge)) throw new Error("RESEARCH_BLOB_BUDGET");
          blobCharge += charge;
          const data = new Uint8Array(input.buffer, input.byteOffset, input.byteLength).slice();
          blob = { id: `b${++this.nextBlob}`, byteLength: data.length };
          blobs.push({ ...blob, data });
          this.latestBlob.set(input, blob);
        }
        record.type = input.constructor.name; record.blob = blob.id;
        record.byteLength = input.byteLength;
        record.length = (input as any).length;
        return { $: "ref", id: record.id, version: record.version };
      }
      if (Array.isArray(input)) record.length = input.length;
      let keys = input instanceof Error ? Object.getOwnPropertyNames(input) : Object.keys(input);
      if (keys.length > 4096) throw new Error("RESEARCH_PROPERTY_LIMIT");
      const descriptorOf = (key: string) => {
        let owner = input;
        for (let depth = 0; owner && depth < 16; depth++, owner = Object.getPrototypeOf(owner)) {
          const descriptor = Object.getOwnPropertyDescriptor(owner, key);
          if (descriptor) return descriptor;
          if (!(input instanceof Error)) break;
        }
        return undefined;
      };
      if (input instanceof Error) {
        for (const key of ["name", "message", "stack"])
          if (!keys.includes(key)) keys.push(key);
        if (!keys.includes("cause") && descriptorOf("cause")) keys.push("cause");
        // Inspect portable fields before a native lazy stack descriptor can format.
        keys = [...keys.filter(key => key !== "stack"), ...keys.filter(key => key === "stack")];
      }
      for (const key of keys) {
        properties++; strings += key.length;
        if (properties > 4096 || strings > 65536) throw new Error("RESEARCH_GRAPH_LIMIT");
        const descriptor = descriptorOf(key);
        if (!descriptor || descriptor.get || descriptor.set) {
          if (input instanceof Error && key === "stack") { record.stackOmitted = "ACCESSOR_DESCRIPTOR"; continue; }
          throw new Error("RESEARCH_ACCESSOR_UNSUPPORTED");
        }
        record.props.push([key, visit(descriptor.value, depth + 1)]);
      }
      return { $: "ref", id: record.id, version: record.version };
    };
    try { return { payload: { root: visit(value), objects }, blobs, blobCharge, scratchCharge: 512 * 1024 }; }
    catch (error) { this.budget.release(blobCharge + 512 * 1024); throw error; }
  }
}

type RecorderConfig = { documentId: string; totalBytes?: number; enabled?: boolean };
type WriteBatch = (batch: AnyRecord) => Promise<{ batchId: number }>;
export class ResearchRecorder {
  readonly budget: ResearchBudget;
  readonly encoder: ResearchGraphEncoder;
  private queue: { event: AnyRecord; blobs: BlobRecord[]; charge: number; wireBytes: number }[] = [];
  private stack: number[] = [];
  private calls = 0;
  private ordinal = 0;
  private batchId = 0;
  private busy = false;
  private accepting = true;
  private incomplete = false;
  private errors: string[] = [];
  private errorsOmitted = 0;
  private errorSlotsReserved = false;
  private blobCount = 0;
  private totalBytes = 0;
  private logicalBytes = 0;
  private overheadMs = 0;
  private transportEncodingMs = 0;
  private queuedBytes = 0;
  private counters = new Map<string, () => number>();
  private initialCounters: AnyRecord = {};
  preparingGray: ArrayBufferView | null = null;
  private lateCalls = 0;
  constructor(readonly config: RecorderConfig, private write: WriteBatch) {
    const requested = config.totalBytes ?? 64 * 1024 * 1024;
    const valid = Number.isSafeInteger(requested) && requested >= 4096 && requested <= 64 * 1024 * 1024;
    this.budget = new ResearchBudget(valid ? requested : 4096);
    this.encoder = new ResearchGraphEncoder(this.budget);
    this.errorSlotsReserved = this.budget.reserve(32768);
    if (!this.errorSlotsReserved) {
      this.budget.reserve(Math.min(4096, this.budget.limit));
      this.incomplete = true; this.accepting = false; this.errorsOmitted++;
    }
    if (!valid) this.fail("RESEARCH_INVALID_TOTAL_BUDGET");
  }
  fail(reason: unknown) {
    this.incomplete = true; this.accepting = false;
    if (!this.errorSlotsReserved || this.errors.length >= 32) { this.errorsOmitted++; return; }
    // Never call an unknown thrown value's coercion or accessors.
    let text = "RESEARCH_OBSERVER_FAILURE";
    try {
      if (typeof reason === "string") text = reason.slice(0, 256);
      else if (reason && (typeof reason === "object" || typeof reason === "function")) {
        const message = Object.getOwnPropertyDescriptor(reason, "message");
        if (message && "value" in message && typeof message.value === "string") text = message.value.slice(0, 256);
      }
      this.errors.push(text);
    } catch { this.errorsOmitted++; }
  }
  isActive() { return this.accepting && !this.incomplete; }
  noteLate() { if (!this.accepting && !this.incomplete) this.lateCalls++; }
  counter(name: string, getter: () => number) {
    if (this.counters.has(name)) return;
    if (!this.budget.reserve(512)) { this.fail("COUNTER_BUDGET"); return; }
    this.counters.set(name, getter);
    const value = getter(); this.initialCounters[name] = value;
    if (value !== 0) this.fail(`NONZERO_INITIAL_COUNTER:${name}`);
    this.probe("module.counter", { name, value });
  }
  counterValues() {
    try { return Object.fromEntries([...this.counters].map(([key, getter]) => [key, getter()])); }
    catch (error) { this.fail(error); return null; }
  }
  event(op: string, stage: string, instanceId: string | null, value: any, callId = this.stack.at(-1) ?? 0, parentCallId = this.stack.at(-2) ?? null) {
    if (!this.isActive()) { this.noteLate(); return; }
    const start = nativeNow();
    let charge = 0, encoded: ReturnType<ResearchGraphEncoder["encode"]> | null = null;
    try {
      if (this.ordinal >= 250000) throw new Error("RESEARCH_EVENT_CAP");
      encoded = this.encoder.encode(value);
      if (value?.state) this.encoder.markStateImmutable(value.state);
      if (this.blobCount + encoded.blobs.length > 4096) throw new Error("RESEARCH_BLOB_CAP");
      const event = { ordinal: ++this.ordinal, callId, parentCallId, instanceId, op, stage, payload: encoded.payload };
      const text = JSON.stringify(event);
      if (text.length > 256 * 1024) throw new Error("RESEARCH_EVENT_SIZE");
      charge = text.length * 6 + 1024;
      if (this.queuedBytes + charge + encoded.blobCharge > 16 * 1024 * 1024) throw new Error("RESEARCH_QUEUE_BUDGET");
      if (!this.budget.reserve(charge)) throw new Error("RESEARCH_EVENT_BUDGET");
      this.logicalBytes += text.length + encoded.blobs.reduce((n, b) => n + b.byteLength, 0);
      if (this.logicalBytes > 1024 * 1024 * 1024) throw new Error("RESEARCH_LOGICAL_CAP");
      this.blobCount += encoded.blobs.length;
      const wireBytes = new TextEncoder().encode(text).byteLength + encoded.blobs.reduce((n, b) => n + Math.ceil(b.byteLength / 3) * 4 + 128, 0);
      this.queue.push({ event, blobs: encoded.blobs, charge: charge + encoded.blobCharge, wireBytes });
      this.queuedBytes += charge + encoded.blobCharge;
      this.budget.release(encoded.scratchCharge);
      charge = 0; encoded = null;
      queueMicrotask(() => { void this.flush(); });
    } catch (error) { this.budget.release(charge + (encoded?.blobCharge ?? 0) + (encoded?.scratchCharge ?? 0)); this.fail(error); }
    finally { this.overheadMs += nativeNow() - start; }
  }
  probe(label: string, value: any) { this.event(label, "PROBE", null, { label, value }); }
  invoke(op: string, instance: any, args: any[], original: (...args: any[]) => any, state: () => any, binding?: any) {
    if (!this.isActive()) { this.noteLate(); return Reflect.apply(original, instance, args); }
    let id: string | null = null;
    const callId = ++this.calls, parent = this.stack.at(-1) ?? null;
    try { id = this.encoder.identity(instance).id; } catch (error) { this.fail(error); }
    const snapshot = () => {
      const started = nativeNow();
      if (!this.budget.reserve(32768)) { this.fail("STATE_RESERVATION"); return null; }
      try { return state(); } catch (error) { this.fail(error); return null; }
      finally { this.budget.release(32768); this.overheadMs += nativeNow() - started; }
    };
    this.event(op, "ENTER", id, { args, binding, state: snapshot(), counters: this.counterValues() }, callId, parent);
    this.stack.push(callId);
    try {
      const value = Reflect.apply(original, instance, args);
      this.event(op, "RETURN", id, { value, state: snapshot(), counters: this.counterValues() }, callId, parent);
      return value;
    } catch (error) {
      this.event(op, "THROW", id, { error, state: snapshot(), counters: this.counterValues() }, callId, parent);
      throw error;
    } finally { this.stack.pop(); }
  }
  callback(fn: (...args: any[]) => any, op: string) {
    const recorder = this;
    return function(this: any, ...args: any[]) {
      if (!recorder.isActive()) { recorder.noteLate(); return Reflect.apply(fn, this, args); }
      const callId = ++recorder.calls, parent = recorder.stack.at(-1) ?? null;
      recorder.event(op, "CALLBACK_ENTER", null, { args }, callId, parent); recorder.stack.push(callId);
      try {
        const value = Reflect.apply(fn, this, args);
        recorder.event(op, "CALLBACK_RETURN", null, { value }, callId, parent); return value;
      } catch (error) {
        recorder.event(op, "CALLBACK_THROW", null, { error }, callId, parent); throw error;
      } finally { recorder.stack.pop(); }
    };
  }
  private async flush() {
    if (this.busy) return;
    this.busy = true;
    try {
      while (this.queue.length) {
        const items: typeof this.queue = [];
        let wireBytes = 512;
        while (this.queue.length && items.length < 128) {
          const next = this.queue[0];
          if (items.length && wireBytes + next.wireBytes > 256 * 1024) break;
          items.push(this.queue.shift()!); wireBytes += next.wireBytes;
          if (wireBytes >= 256 * 1024) break;
        }
        try {
          const encodingStarted = nativeNow();
          const blobs = items.flatMap(item => item.blobs).map(b => {
            let text = "";
            for (let i = 0; i < b.data.length; i += 16384)
              text += String.fromCharCode(...b.data.subarray(i, i + 16384));
            return { id: b.id, byteLength: b.byteLength, base64: globalThis.btoa(text) };
          });
          const batch = { version: 1, marker: REACH_RESEARCH_MARKER, documentId: this.config.documentId,
            batchId: ++this.batchId, events: items.map(item => item.event), blobs };
          const wireSize = new TextEncoder().encode(JSON.stringify(batch)).byteLength;
          if (wireSize > 1024 * 1024) throw new Error("RESEARCH_BATCH_LIMIT");
          if (this.totalBytes + wireSize > 1024 * 1024 * 1024) throw new Error("RESEARCH_DISK_CAP");
          this.totalBytes += wireSize;
          this.transportEncodingMs += nativeNow() - encodingStarted;
          const ack = await this.write(batch);
          if (ack?.batchId !== batch.batchId) throw new Error("RESEARCH_ACK_MISMATCH");
        } catch (error) { this.fail(error); }
        finally { const released = items.reduce((sum, item) => sum + item.charge, 0); this.budget.release(released); this.queuedBytes -= released; }
      }
    } finally { this.busy = false; }
  }
  status() {
    return { marker: REACH_RESEARCH_MARKER, documentId: this.config.documentId, complete: !this.incomplete,
      incomplete: this.incomplete, accepting: this.accepting, errors: [...this.errors], errorsOmitted: this.errorsOmitted, events: this.ordinal,
      blobs: this.blobCount, totalBytes: this.totalBytes, logicalBytes: this.logicalBytes, queued: this.queue.length, inFlight: this.busy,
      liveBytes: this.budget.used, peakBytes: this.budget.peak, totalBudget: this.budget.limit,
      queuedAndInFlightBytes: this.queuedBytes, queueBudget: 16 * 1024 * 1024, finalizationRegistryAvailable: typeof FinalizationRegistry === "function",
      lateCalls: this.lateCalls, openCalls: this.stack.length,
      initialCounterCoverage: ["nextAnchor", "nextLogicalIndex"].every(name => name in this.initialCounters),
      observerSynchronousMs: this.overheadMs, transportEncodingMs: this.transportEncodingMs,
      identitiesCreated: this.encoder.identitiesCreated, identitiesFinalized: this.encoder.identitiesFinalized,
      initialCounters: { ...this.initialCounters } };
  }
  freeze(reason = "TEST_TAIL_DONE") {
    this.probe("recording.freeze", { reason, activeCalls: this.stack.length });
    if (this.stack.length) this.fail("RESEARCH_FREEZE_OPEN_CALLS");
    this.accepting = false; return this.status();
  }
  async drain(timeoutMs = 10000) {
    const end = nativeNow() + Math.min(10000, Math.max(0, timeoutMs));
    void this.flush();
    while ((this.busy || this.queue.length) && nativeNow() < end) await new Promise(resolve => setTimeout(resolve, 5));
    if (this.busy || this.queue.length) this.fail("RESEARCH_DRAIN_TIMEOUT");
    return this.status();
  }
}

let recorder: ResearchRecorder | null = null;
const registeredCounters = new Map<string, () => number>();
const configured = scope.__REACH_RESEARCH_CONFIG__;
if (configured?.enabled === true && typeof configured.documentId === "string" && typeof scope.__REACH_RESEARCH_WRITE__ === "function") {
  recorder = new ResearchRecorder(configured, (batch: AnyRecord) => scope.__REACH_RESEARCH_WRITE__(batch));
  scope.__REACH_RESEARCH_CONTROL__ = {
    marker: REACH_RESEARCH_MARKER, status: () => recorder!.status(), drain: (ms?: number) => recorder!.drain(ms),
    freeze: (reason?: string) => recorder!.freeze(reason), mark: (label: string, value: any) => recorder!.probe(label, value),
  };
}
export function configureResearchRecorder(value: ResearchRecorder | null) {
  recorder = value;
  for (const [name, getter] of registeredCounters) try { recorder?.counter(name, getter); } catch (error) { recorder?.fail(error); }
}
export function registerResearchCounter(name: string, getter: () => number) { try { registeredCounters.set(name, getter); recorder?.counter(name, getter); } catch (error) { recorder?.fail(error); } }
export function researchCounterValues() { return Object.fromEntries([...registeredCounters].map(([key, getter]) => [key, getter()])); }
export function researchProbe(label: string, value: any) { try { recorder?.probe(label, value); } catch (error) { recorder?.fail(error); } }
export function researchValue<T>(label: string, value: T, context?: any): T { researchProbe(label, { value, context }); return value; }
export function researchContext(label: string, value: any) { researchProbe(label, value); }
export function researchCall<T>(label: string, action: () => T, context?: any): T {
  if (!recorder?.isActive()) return action();
  return recorder.invoke(label, action, [], action, () => context);
}
export function researchBitmap(label: string, bitmap: object, value: any) {
  try { if (recorder?.isActive()) recorder.probe(label, { bitmapId: recorder.encoder.identity(bitmap).id, ...value }); }
  catch (error) { recorder?.fail(error); }
}
const trackerKeys = ["binding", "sourceAnatomy", "sourceCanonical", "trustedModelSource", "sequence", "lastCapture", "acceptedAt", "associationAt", "previous", "template", "reference", "lastReferenceAt", "referenceRefreshCandidate", "pending", "point", "velocity", "quarantinedSearch", "trackId", "trackGeneration", "anchorSource", "automaticEntryPending", "manualSelection", "vetoed", "authorityVetoed", "authorityCandidate", "failures", "grid", "modelContinuity", "modelCohorts", "modelAcceptedAt", "opticalEpoch", "imagePhase", "anatomicalOffset", "modelOpticalCandidate", "modelCoordinate", "wasModelOnly", "modelIdentity", "handIdentity", "indexIdentity", "coordinateConflict", "fingerReference", "cueAssociation", "cueContinuity", "cueCohorts"];
const classFields: Record<string, string[]> = {
  Tracker: trackerKeys, Adapter: ["binding", "tier", "backend", "policy", "sequence", "generation", "tracks", "capture"],
  ModelGate: ["binding", "maxAgeMs", "sequence", "capture", "frame", "backend", "source"],
  ImageGate: ["binding", "sequence", "capture", "frame"],
  Temporal: ["logical", "lastCapture", "identityAt", "source", "sources", "measurement", "velocity", "history", "expired"],
  SourceAssociation: ["canonical", "trusted", "trustedAt", "lastCapture", "candidates"],
};
const methods: Record<string, string[]> = {
  Tracker: ["prepare", "complete", "update", "reset", "requestManualSelection", "discard", "computeMatches", "associateModelSource"],
  Adapter: ["envelope"], ModelGate: ["accept"], ImageGate: ["accept"],
  Temporal: ["observe", "reset", "restore"], SourceAssociation: ["observe", "reset", "restore"],
};
const installed = new WeakSet<object>();
const observed = new WeakSet<object>();
function cold(instance: any, kind: string) {
  if (kind === "Tracker") return instance.sequence === 0 && instance.lastCapture === -Infinity && instance.pending === null && instance.trackId === null;
  if (kind === "Adapter") return instance.sequence === 0 && instance.capture === -Infinity && instance.generation === 0 && instance.tracks.length === 0;
  if (kind === "ModelGate" || kind === "ImageGate") return instance.sequence === -1 && instance.capture === -1 && instance.frame === null;
  if (kind === "Temporal") return instance.logical === null && instance.lastCapture === -Infinity && instance.history.length === 0;
  return instance.canonical === null && instance.lastCapture === -Infinity && instance.candidates.length === 0;
}
function stateOf(instance: any, kind: string) {
  const state = Object.fromEntries(classFields[kind].map(key => [key, instance[key]]));
  if (kind === "Tracker") {
    state.temporal = Object.fromEntries(classFields.Temporal.map(key => [key, instance.temporal?.[key]]));
    state.sourceAssociation = Object.fromEntries(classFields.SourceAssociation.map(key => [key, instance.sourceAssociation?.[key]]));
  }
  return state;
}
export function installResearchTape(classes: Record<string, any>) {
  for (const [kind, constructor] of Object.entries(classes)) {
    const prototype = constructor?.prototype;
    if (!prototype || installed.has(prototype) || !methods[kind]) continue;
    registeredPrototypes.set(prototype, kind);
    installed.add(prototype);
    for (const name of methods[kind]) {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
      const original = descriptor?.value;
      if (typeof original !== "function") continue;
      Object.defineProperty(prototype, name, { ...descriptor, value: function(this: any, ...input: any[]) {
        const active = recorder;
        if (!active?.isActive()) { active?.noteLate(); return Reflect.apply(original, this, input); }
        let firstUse = false, initialCold: boolean | undefined, args: any[];
        try {
          firstUse = !observed.has(this);
          if (firstUse) { observed.add(this); initialCold = cold(this, kind); if (!initialCold) active.fail(`NONCOLD_FIRST_USE:${kind}`); }
          args = input.slice();
          if (kind === "Tracker" && name === "complete") {
            if (typeof args[2] === "function") args[2] = active.callback(args[2], "Tracker.complete.clock");
            if (typeof args[3] === "function") args[3] = active.callback(args[3], "Tracker.complete.sourceFresh");
            else active.fail("UNOBSERVED_DEFAULT_SOURCE_FRESH");
          }
          if (kind === "Adapter" && name === "envelope" && typeof args[5] === "function") args[5] = active.callback(args[5], "Adapter.acceptCapture");
          if (["ModelGate", "ImageGate"].includes(kind) && typeof args[2] === "function") args[2] = active.callback(args[2], `${kind}.finalFresh`);
          // The nested ENTER must reference the already recorded canonical gray.
          if (kind === "Tracker" && name === "computeMatches" && active.preparingGray && input[0]?.data)
            active.encoder.aliasImmutable(input[0].data, active.preparingGray);
        } catch (error) { active.fail(error); return Reflect.apply(original, this, input); }
        const call = function(this: any, ...actual: any[]) {
          const previousGray = active.preparingGray;
          if (kind === "Tracker" && name === "prepare") active.preparingGray = input[0]?.data ?? null;
          let value: any;
          try { value = Reflect.apply(original, this, args); }
          finally { active.preparingGray = previousGray; }
          if (kind === "Tracker" && name === "prepare" && this.pending?.frame?.data && input[0]?.data)
            try { active.encoder.aliasImmutable(this.pending.frame.data, input[0].data); }
            catch (error) { active.fail(error); }
          return value;
        };
        return active.invoke(`${kind}.${name}`, this, input, call, () => stateOf(this, kind),
          { className: kind, binding: this.binding, firstUse, initialCold });
      } });
    }
  }
}
