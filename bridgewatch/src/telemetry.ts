import { z } from "zod";

export const workerStates = ["WORKING", "TESTING", "WAITING", "BLOCKED", "FINISHED", "STALE", "UNKNOWN"] as const;
export type WorkerState = (typeof workerStates)[number];

const identifier = z.string().regex(/^[a-z][a-z0-9._-]{0,80}$/i);
const sha = z.string().regex(/^[a-f0-9]{7,64}$/i);
const date = z.string().datetime({ offset: true });
const task = z.string().min(1).max(200).regex(/^[^\r\n]*$/);
const branch = z.string().min(1).max(160).regex(/^[A-Za-z0-9._/-]+$/);
const host = z.string().min(1).max(120).regex(/^[A-Za-z0-9._-]+$/);

export const heartbeatSchema = z
  .object({
    workerId: identifier,
    project: identifier,
    phase: z.string().regex(/^\d{1,3}$/),
    task,
    state: z.enum(workerStates),
    branch,
    sourceSha: sha,
    host,
    startedAt: date,
    heartbeatAt: date,
  })
  .strict();

export type Heartbeat = z.infer<typeof heartbeatSchema>;

export function parseHeartbeat(value: unknown, now = Date.now()): Heartbeat {
  const parsed = heartbeatSchema.parse(value);
  if (Math.abs(Date.parse(parsed.heartbeatAt) - now) > 5 * 60_000) throw new Error("HEARTBEAT_CLOCK_SKEW");
  if (Date.parse(parsed.startedAt) > Date.parse(parsed.heartbeatAt)) throw new Error("HEARTBEAT_TIME_ORDER");
  return parsed;
}

export function authorizeTelemetry(header: string | undefined, expected: string | undefined): boolean {
  if (!expected) return false;
  return header === `Bearer ${expected}`;
}

export function workerState(worker: Heartbeat, staleAfterMs: number, now = Date.now()): WorkerState {
  if (worker.state === "FINISHED") return "FINISHED";
  return now - Date.parse(worker.heartbeatAt) > staleAfterMs ? "STALE" : worker.state;
}
