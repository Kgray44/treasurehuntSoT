/** Neutral entrypoint. Project adapters retain their native drivers and receipt formats. */
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--catalog") {
    await import("./catalog");
    return;
  }
  if (args[0] === "--project" && args[1] === "parallax") {
    process.argv = [...process.argv.slice(0, 2), ...args.slice(2)];
    await import("../parallax/device-lab");
    return;
  }
  if (args[0] === "--project" && args[1] === "sextant") {
    process.argv = [...process.argv.slice(0, 2), ...args.slice(2)];
    await import("../sextant/device-lab");
    return;
  }
  if (args[0] !== "--project" || args[1] !== "landfall") throw new Error("DEVICE_LAB_PROJECT_NOT_REGISTERED");
  // Keep the accepted CLI's option parsing, exit codes and artifact namespace exact.
  process.argv = [...process.argv.slice(0, 2), ...args.slice(2)];
  await import("../landfall/device-lab/run");
}
void main().catch(() => {
  process.stderr.write("DEVICE_LAB_ARGUMENT_OR_PROJECT_INVALID\n");
  process.exitCode = 1;
});
