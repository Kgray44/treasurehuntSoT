import { describe, expect, it } from "vitest";
import { codexTaskHeartbeat } from "../lib/codex-reporter.js";

describe("Codex task reporter", () => {
  it("builds a strict activity-only heartbeat without exposing configuration", () => {
    const heartbeat = codexTaskHeartbeat(
      {
        CODEX_TASK_ID: "/root/Bridgewatch bring-up",
        COMPUTERNAME: "Operator Workstation",
        CODEX_TASK_SUMMARY: "Bring Bridgewatch online\nwithout private payloads",
      },
      new Date("2026-08-27T13:30:00.000Z"),
    );
    expect(heartbeat).toMatchObject({
      workerId: "root-bridgewatch-bring-up",
      project: "bridgewatch",
      state: "WORKING",
      host: "operator-workstation",
      task: "Bring Bridgewatch online without private payloads",
    });
    expect(JSON.stringify(heartbeat)).not.toContain("TOKEN");
  });
});
