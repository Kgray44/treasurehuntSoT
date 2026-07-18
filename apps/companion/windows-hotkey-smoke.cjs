"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { WindowsHotkeyMonitor } = require("./windows-hotkey-monitor.cjs");

async function run() {
  if (process.platform !== "win32") {
    console.log(JSON.stringify({ area: "b2-hotkey-smoke", skipped: true, reason: "WINDOWS_REQUIRED" }));
    return;
  }
  const scriptPath = path.join(__dirname, "windows-hotkey-monitor.ps1");
  const owner = new WindowsHotkeyMonitor({ scriptPath });
  const competitor = new WindowsHotkeyMonitor({ scriptPath });
  try {
    const registered = await owner.configure("Control+Shift+F10", "HOLD");
    assert.equal(registered.registered, true);
    const conflict = await competitor.configure("Control+Shift+F10", "TOGGLE");
    assert.deepEqual(conflict, { registered: false, conflict: true });
    console.log(
      JSON.stringify({
        area: "b2-hotkey-smoke",
        registered: true,
        conflictDetected: true,
        binding: registered.binding,
        interaction: registered.interaction,
        automatedInputGenerated: false,
      }),
    );
  } finally {
    await competitor.disable();
    await owner.disable();
  }
}

run().catch((error) => {
  console.error(JSON.stringify({ area: "b2-hotkey-smoke", error: error?.stack || error?.message || String(error) }));
  process.exitCode = 1;
});
