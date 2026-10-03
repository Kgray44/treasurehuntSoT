import { spawn } from "node:child_process";
import path from "node:path";
import { stat } from "node:fs/promises";
import type { PlayerLandfallEvidence } from "../../../src/landfall/player-evidence-contract";
import type { LandfallReconciliationTransport } from "../../../src/landfall/offline-reconcile";

/** Server imports and Prisma globals live exclusively in a dedicated owned child process. */
export async function startDeviceLabAuthority(destination: string, worldspace: "PHYSICAL" | "VIRTUAL" = "PHYSICAL") {
  const child = spawn(
    process.execPath,
    [
      "--import",
      "tsx",
      path.join(process.cwd(), "scripts", "landfall", "device-lab", "one-voyage.ts"),
      "--worker",
      destination,
      worldspace,
    ],
    {
      cwd: process.cwd(),
      windowsHide: true,
      stdio: ["ignore", "ignore", "ignore", "ipc"],
      env: { ...process.env, DATABASE_URL: "file:UNBOUND_DEVICE_LAB" },
    },
  );
  const pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }
  >();
  let sequence = 0;
  let readyResolve!: (value: string) => void;
  let readyReject!: (error: Error) => void;
  const ready = new Promise<string>((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });
  const readyTimer = setTimeout(() => {
    readyReject(new Error("LANDFALL_LAB_AUTHORITY_START_TIMEOUT"));
    child.kill();
  }, 30000);
  child.on("message", (message: unknown) => {
    const value = message as { ready?: boolean; fixtureHash?: string; id?: number; value?: unknown; error?: string };
    if (value.ready && /^[a-f0-9]{64}$/.test(value.fixtureHash ?? "")) {
      clearTimeout(readyTimer);
      readyResolve(value.fixtureHash!);
      return;
    }
    const waiter = pending.get(value.id ?? -1);
    if (!waiter) return;
    clearTimeout(waiter.timer);
    pending.delete(value.id!);
    if (value.error) waiter.reject(new Error(value.error));
    else waiter.resolve(value.value);
  });
  child.on("error", (error) => {
    clearTimeout(readyTimer);
    readyReject(error);
  });
  child.on("exit", () => {
    clearTimeout(readyTimer);
    readyReject(new Error("LANDFALL_LAB_AUTHORITY_EXITED"));
    for (const waiter of pending.values()) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error("LANDFALL_LAB_AUTHORITY_EXITED"));
    }
    pending.clear();
  });
  const fixtureHash = await ready;
  const call = (operation: "submit" | "counts" | "cleanup" | "authorize", value?: unknown): Promise<unknown> =>
    new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error("LANDFALL_LAB_AUTHORITY_TIMEOUT"));
      }, 15000);
      pending.set(id, { resolve, reject, timer });
      child.send({ id, operation, value }, (error) => {
        if (error) {
          clearTimeout(timer);
          pending.delete(id);
          reject(error);
        }
      });
    });
  return {
    fixtureHash,
    submit: (evidence: PlayerLandfallEvidence) => call("submit", evidence),
    authorize: (evidence?: Pick<PlayerLandfallEvidence, "evidenceId">) =>
      call("authorize", evidence) as ReturnType<LandfallReconciliationTransport["authorize"]>,
    counts: () =>
      call("counts") as Promise<{
        canonicalProgressionEvents: number;
        blockCompletions: number;
        currentBlock: string | null;
        rawLocationsRetained: boolean;
      }>,
    cleanup: async () => {
      const removed = await call("cleanup").catch(() => false);
      const exited =
        child.exitCode !== null ||
        (await new Promise<boolean>((resolve) => {
          const timer = setTimeout(() => {
            child.kill();
            resolve(false);
          }, 5000);
          child.once("exit", () => {
            clearTimeout(timer);
            resolve(true);
          });
        }));
      return (
        removed === true &&
        exited &&
        !(await stat(path.join(destination, "one-voyage.db")).then(
          () => true,
          () => false,
        ))
      );
    },
  };
}
