/* Maps the sealed physical browser engine to the shared read-only setup device. */
export function phase3ReadOnlySetupDeviceForEngine(browserEngine) {
  if (browserEngine === undefined || browserEngine === "") return "Desktop Chrome";
  if (browserEngine === "chromium") return "Desktop Chrome";
  if (browserEngine === "webkit") return "iPhone 14";
  throw new Error("SOUNDING_LINE_BROWSER_ENGINE_INVALID");
}
