import { readFile, realpath } from "node:fs/promises";
import { resolve, relative, isAbsolute } from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { createServer } from "node:net";

/** Foreground preview only: no shared database, background helper or process takeover. */
async function main() {
  const database = resolve(process.argv[2] ?? "artifacts/spatial-pilot/owner-preview.db");
  const port = Number(process.argv[3] ?? 3278);
  const host = process.argv[4] ?? "127.0.0.1";
  if (!Number.isInteger(port) || port < 1024 || port > 65535 || !["127.0.0.1", "0.0.0.0"].includes(host))
    throw new Error("PILOT_PREVIEW_ADDRESS_INVALID");
  const root = await realpath(resolve("artifacts/spatial-pilot"));
  const actual = await realpath(database);
  const child = relative(root, actual);
  if (!child || child.startsWith("..") || isAbsolute(child) || !actual.endsWith(".db"))
    throw new Error("PILOT_OWNED_DATABASE_REQUIRED");
  const receipt = JSON.parse(await readFile(`${database}.access.private.json`, "utf8"));
  if (resolve(receipt.database) !== actual || receipt.ownerAccountId !== "spatial-pilot-navigator")
    throw new Error("PILOT_ACCESS_BINDING_INVALID");
  await new Promise<void>((accept, reject) => {
    const check = createServer();
    check.once("error", reject);
    check.listen(port, host, () => check.close((error) => (error ? reject(error) : accept())));
  });
  const source = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const env = {
    ...process.env,
    DATABASE_URL: `file:${actual.replaceAll("\\", "/")}`,
    SPATIAL_PILOT_ENABLED: "1",
    SPATIAL_PILOT_OWNER_ID: receipt.ownerAccountId,
    SPATIAL_PILOT_SOURCE_SHA: source,
  };
  // Run repository-local tools without a shell, keeping environment and ownership explicit.
  execFileSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "generate", "--schema", "prisma/schema.sqlite.prisma"],
    { env, stdio: "inherit" },
  );
  execFileSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], { env, stdio: "inherit" });
  console.log(
    `Pilot preview: http://${host === "0.0.0.0" ? "<this-computer-network-address>" : host}:${port}/sign-in?returnTo=/dev/spatial-pilot`,
  );
  if (host === "0.0.0.0")
    console.log(
      `Computer webcam entry: http://localhost:${port}/sign-in?returnTo=/dev/spatial-pilot. Phone: use the computer's network address and the manual pairing code.`,
    );
  console.log(
    "Sign-in details stay in the adjacent .access.private.json file. Stop this foreground preview with Ctrl+C.",
  );
  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--port", String(port), "--hostname", host],
    { env, stdio: "inherit" },
  );
  server.once("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  server.once("exit", (code) => {
    process.exitCode = code ?? 1;
  });
}
void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Pilot startup failed");
  process.exitCode = 1;
});
