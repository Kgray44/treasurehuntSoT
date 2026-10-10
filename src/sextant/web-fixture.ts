import type { WebSensorTarget } from "./web-provider";
/** Explicit browser/device API emulator for D1; no physical sensor claim. */
export function emulatedWebSensors() {
  let time = 100,
    visibility = "visible";
  const windowTarget = new EventTarget(),
    documentTarget = new EventTarget();
  const listeners = new Map<string, Set<EventListener>>();
  const target: WebSensorTarget = {
    isSecureContext: true,
    DeviceOrientationEvent: {},
    DeviceMotionEvent: {},
    screen: { orientation: { angle: 0 } },
    addEventListener(type, listener) {
      windowTarget.addEventListener(type, listener);
      const set = listeners.get(type) ?? new Set();
      set.add(listener);
      listeners.set(type, set);
    },
    removeEventListener(type, listener) {
      windowTarget.removeEventListener(type, listener);
      listeners.get(type)?.delete(listener);
    },
    document: {
      get visibilityState() {
        return visibility;
      },
      addEventListener: (type, listener) => documentTarget.addEventListener(type, listener),
      removeEventListener: (type, listener) => documentTarget.removeEventListener(type, listener),
    },
  };
  const dispatch = (type: string, values: object) => {
    const event = new Event(type);
    Object.assign(event, values);
    windowTarget.dispatchEvent(event);
  };
  return {
    target,
    now: () => time,
    setTime: (at: number) => {
      time = at;
    },
    orientation: (values: object = {}) =>
      dispatch("deviceorientation", { alpha: 0, beta: 0, gamma: 0, absolute: false, ...values }),
    motion: (values: object = {}) =>
      dispatch("devicemotion", {
        acceleration: { x: 0, y: 0, z: 0 },
        accelerationIncludingGravity: { x: 0, y: 0, z: 9.81 },
        rotationRate: { alpha: 0, beta: 0, gamma: 0 },
        ...values,
      }),
    background: () => {
      visibility = "hidden";
      documentTarget.dispatchEvent(new Event("visibilitychange"));
    },
    foreground: () => {
      visibility = "visible";
      documentTarget.dispatchEvent(new Event("visibilitychange"));
    },
    pagehide: () => dispatch("pagehide", {}),
    pageshow: () => dispatch("pageshow", {}),
    count: (type: string) => listeners.get(type)?.size ?? 0,
  };
}
