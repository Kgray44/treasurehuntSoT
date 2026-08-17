import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

function chromiumSetupExecutable(chromiumSetupBrowsersPath) {
  let browserDirectories;
  try {
    browserDirectories = readdirSync(chromiumSetupBrowsersPath, { withFileTypes: true });
  } catch {
    throw new Error("SOUNDING_LINE_CHROMIUM_SETUP_EXECUTABLE_MISSING");
  }

  const executableLayouts = [
    { directoryPrefix: "chromium-", executableName: "chrome.exe" },
    { directoryPrefix: "chromium_headless_shell-", executableName: "headless_shell.exe" },
  ];
  for (const layout of executableLayouts) {
    for (const directory of browserDirectories) {
      if (!directory.isDirectory() || !directory.name.startsWith(layout.directoryPrefix)) continue;
      const executablePath = path.join(
        chromiumSetupBrowsersPath,
        directory.name,
        "chrome-win",
        layout.executableName,
      );
      if (existsSync(executablePath)) return executablePath;
    }
  }
  throw new Error("SOUNDING_LINE_CHROMIUM_SETUP_EXECUTABLE_MISSING");
}

/*
 * Phase 3 setup owns Chromium-only mutations. WebKit physical batches retain
 * that setup engine and receive its verified Chromium cache as a sidecar;
 * only the selected logical test partition runs under WebKit.
 */
export function phase3ReadOnlySetupUseForEngine(browserEngine, chromiumSetupBrowsersPath) {
  if (browserEngine === undefined || browserEngine === "" || browserEngine === "chromium") {
    return { deviceName: "Desktop Chrome" };
  }
  if (browserEngine === "webkit") {
    if (!chromiumSetupBrowsersPath) return { deviceName: "Desktop Chrome" };
    return {
      deviceName: "Desktop Chrome",
      executablePath: chromiumSetupExecutable(chromiumSetupBrowsersPath),
    };
  }
  throw new Error("SOUNDING_LINE_BROWSER_ENGINE_INVALID");
}
