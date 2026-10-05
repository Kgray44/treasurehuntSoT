import type { DeviceLabAction } from "@/landfall/device-lab/scenario";
import { nativeSensorFrameSchema } from "@/landfall/native-sensors";
import type { ContextualEvidence } from "@/landfall/contextual";

export type AndroidControlledSensor = "acceleration" | "orientation" | "pressure" | "magnetic-field";
export type AndroidSensorControl = Readonly<{
  sensor: "acceleration" | "orientation" | "pressure";
  values: readonly number[];
  nativeKind: "ACCELEROMETER" | "ORIENTATION" | "PRESSURE";
  contextKind: "MOTION" | "HEADING" | "ELEVATION";
  drivingInputs?: readonly { sensor: AndroidControlledSensor; values: readonly number[] }[];
}>;
function orientationControl(degrees: number, values: readonly number[]): AndroidSensorControl {
  const radians = (degrees * Math.PI) / 180;
  return {
    sensor: "orientation",
    values,
    nativeKind: "ORIENTATION",
    contextKind: "HEADING",
    drivingInputs: [
      { sensor: "acceleration", values: [0, 0, 9.80665] },
      { sensor: "magnetic-field", values: [-50 * Math.sin(radians), 50 * Math.cos(radians), -45] },
    ],
  };
}
/** Fixed emulator operations only; values remain bounded canonical scenario input. */
export function androidSensorControl(
  action: Extract<DeviceLabAction, { type: "SENSOR" }>,
): AndroidSensorControl | null {
  if (action.kind === "ACCELEROMETER" && action.values.length === 3)
    return { sensor: "acceleration", values: action.values, nativeKind: "ACCELEROMETER", contextKind: "MOTION" };
  if (["MOTION", "STATIONARY"].includes(action.kind))
    return {
      sensor: "acceleration",
      values: [0, 0, action.kind === "STATIONARY" || !(action.values[0] > 0) ? 9.80665 : 12],
      nativeKind: "ACCELEROMETER",
      contextKind: "MOTION",
    };
  if (action.kind === "BAROMETER" && action.values[0] >= 300 && action.values[0] <= 1100)
    return { sensor: "pressure", values: [action.values[0]], nativeKind: "PRESSURE", contextKind: "ELEVATION" };
  if (action.kind === "ORIENTATION" && action.values.length === 3 && action.values[1] === 0 && action.values[2] === 0)
    return orientationControl(action.values[0], action.values);
  if (action.kind === "HEADING" && action.values[0] >= 0 && action.values[0] <= 360)
    return orientationControl(action.values[0], [action.values[0], 0, 0]);
  return null;
}

export function readAndroidSensorValues(sensor: AndroidControlledSensor, output: string): number[] {
  const line = output.split(/\r?\n/).find((line) => line.startsWith(`${sensor} = `));
  const values = line?.slice(`${sensor} = `.length).trim().split(":");
  if (!values?.length || values.some((value) => !/^-?[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/.test(value)))
    throw new Error("ANDROID_SENSOR_READBACK_INVALID");
  const parsed = values.map(Number);
  if (
    parsed.length !== (sensor === "pressure" ? 1 : 3) ||
    parsed.some((value) => !Number.isFinite(value) || Math.abs(value) > 100000)
  )
    throw new Error("ANDROID_SENSOR_READBACK_INVALID");
  return parsed;
}

/** A raw OS frame must also have passed the production context adapter, with the same frame identity. */
export function matchesAndroidSensorContext(
  control: AndroidSensorControl,
  input: unknown,
  evidence: ContextualEvidence,
): boolean {
  const result = nativeSensorFrameSchema.safeParse(input);
  if (
    !result.success ||
    result.data.kind !== control.nativeKind ||
    evidence.id !== result.data.id ||
    evidence.kind !== control.contextKind
  )
    return false;
  const frame = result.data;
  if (control.sensor === "orientation") {
    const gap = Math.abs(((frame.values[0] - control.values[0] + 540) % 360) - 180);
    // Preserve the native provider's declared uncertainty; this is not a
    // five-degree physical compass qualification.
    return gap <= Math.min(45, Math.max(5, frame.accuracy));
  }
  return control.values.every((value, index) => Math.abs(frame.values[index] - value) <= 0.02);
}
