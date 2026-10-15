import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import assert from "node:assert/strict";

export async function snapshotTree(root) {
  let processes;
  if (process.platform === "win32") {
    const output = execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId | ConvertTo-Json -Compress",
      ],
      { encoding: "utf8", windowsHide: true, timeout: 5000 },
    );
    processes = JSON.parse(output).map((entry) => ({ pid: entry.ProcessId, parent: entry.ParentProcessId }));
  } else {
    processes = [];
    for (const name of await readdir("/proc")) {
      if (!/^\d+$/u.test(name)) continue;
      try {
        const text = await readFile(`/proc/${name}/stat`, "utf8");
        const fields = text.slice(text.lastIndexOf(")") + 2).split(" ");
        processes.push({ pid: Number(name), parent: Number(fields[1]), birth: fields[19] });
      } catch {
        /* an unrelated process may exit during the snapshot */
      }
    }
  }
  const owned = new Set([root]);
  let count;
  do {
    count = owned.size;
    for (const entry of processes) if (owned.has(entry.parent)) owned.add(entry.pid);
  } while (count !== owned.size);
  return processes.filter((entry) => owned.has(entry.pid));
}

export async function assertTerminated(identities) {
  for (const identity of identities) {
    if (process.platform === "linux") {
      let text;
      try {
        text = await readFile(`/proc/${identity.pid}/stat`, "utf8");
      } catch {
        continue;
      }
      const fields = text.slice(text.lastIndexOf(")") + 2).split(" ");
      if (identity.birth !== fields[19]) continue; // unrelated reused PID
      assert.match(fields[0], /^[ZX]$/u, `owned PID ${identity.pid} survived`);
    } else {
      assert.throws(() => process.kill(identity.pid, 0), /ESRCH/u, `owned PID ${identity.pid} survived`);
    }
  }
}
