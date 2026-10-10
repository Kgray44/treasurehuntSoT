import { permissionSchema, type PermissionState } from "./contracts";
export type PermissionPurpose = {
  consumerId: string;
  surfaceId: string;
  purpose: string;
  consent: boolean;
  userInitiated: boolean;
  retry?: boolean;
};
type RecordState = { state: PermissionState; enabled: boolean; epoch: number; pending?: Promise<PermissionState> };
/** Injected platform requester; construction/discovery never prompts. Permission grants do not imply purpose consent. */
export class SextantPermissionBroker {
  private readonly records = new Map<string, RecordState>();
  private readonly listeners = new Set<(key: string) => void>();
  constructor(
    private readonly requestPlatform: (key: string, purpose: PermissionPurpose) => Promise<PermissionState>,
  ) {}
  private record(key: string) {
    let r = this.records.get(key);
    if (!r) {
      r = { state: key === "NOT_REQUIRED" ? "NOT_REQUIRED" : "PROMPT", enabled: true, epoch: 0 };
      this.records.set(key, r);
    }
    return r;
  }
  state(key: string) {
    const r = this.record(key);
    return { permission: r.state, enabled: r.enabled };
  }
  onChange(listener: (key: string) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  private notify(key: string) {
    for (const listener of this.listeners) {
      try {
        listener(key);
      } catch {
        /* Permission observers cannot undo a state transition. */
      }
    }
  }
  set(key: string, state: PermissionState) {
    const r = this.record(key);
    r.epoch++;
    r.state = permissionSchema.parse(state);
    r.pending = undefined;
    this.notify(key);
  }
  pause(key: string) {
    const r = this.record(key);
    r.epoch++;
    r.enabled = false;
    r.pending = undefined;
    this.notify(key);
  }
  resume(key: string, userInitiated: boolean) {
    if (!userInitiated) throw new Error("SEXTANT_USER_ACTION_REQUIRED");
    this.record(key).enabled = true;
    this.notify(key);
  }
  async authorize(key: string, purpose: PermissionPurpose): Promise<PermissionState> {
    if (!purpose.consumerId.trim() || !purpose.surfaceId.trim() || !purpose.purpose.trim())
      throw new Error("SEXTANT_PURPOSE_REQUIRED");
    const r = this.record(key);
    if (!r.enabled || !purpose.consent) return "DENIED";
    if (r.state === "GRANTED" || r.state === "NOT_REQUIRED" || r.state === "RESTRICTED") return r.state;
    if (r.state === "DENIED" && !(purpose.retry && purpose.userInitiated)) return "DENIED";
    if (!purpose.userInitiated) return r.state;
    if (r.pending) return r.pending;
    const epoch = r.epoch;
    // Invoke inside the explicit user action, preserving browser activation for platform prompts.
    let requested: Promise<PermissionState>;
    try {
      requested = this.requestPlatform(key, { ...purpose });
    } catch {
      requested = Promise.resolve("RESTRICTED");
    }
    const pending = Promise.resolve(requested)
      .then((result) => permissionSchema.parse(result))
      .catch(() => "RESTRICTED" as const)
      .then((result) => {
        if (r.epoch !== epoch || !r.enabled) return r.enabled ? r.state : "DENIED";
        r.state = result;
        r.pending = undefined;
        this.notify(key);
        return result;
      });
    r.pending = pending;
    return pending;
  }
}
