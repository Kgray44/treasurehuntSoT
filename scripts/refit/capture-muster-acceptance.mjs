import { chromium } from "@playwright/test";
import { DatabaseSync, backup } from "node:sqlite";
import { mkdir, readFile, writeFile, readdir, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";

const taskRoot = path.resolve(".runtime/muster");
const output = path.resolve("Development_Docs/Projects/Voyagewright_Refit_V1/muster/accepted-reference");
const validationRoot = path.resolve(".runtime/muster-final");
if (await stat(path.join(output, "manifest.json")).catch(() => null))
  throw new Error("ACCEPTED_REFERENCE_ALREADY_CAPTURED_PRESERVE_IT");
await mkdir(output, { recursive: true });
await mkdir(validationRoot, { recursive: true });
const fixture = JSON.parse(await readFile(path.join(taskRoot, "fixture.json"), "utf8"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const database = new DatabaseSync(path.join(taskRoot, "muster.sqlite"), { readOnly: true });
try {
  // A consistent SQLite backup retains every review fixture while final journeys
  // mutate only their separate validation copy. Never reset the owner preview.
  await backup(database, path.join(validationRoot, "accepted-fixtures.sqlite"));
  await backup(database, path.join(validationRoot, "validation.sqlite"));
  const voyages = database.prepare("SELECT id, status, captainAuthorityState FROM TaleSession ORDER BY id").all();
  await writeFile(path.join(validationRoot, "retained-voyages.json"), JSON.stringify(voyages, null, 2));
} finally {
  database.close();
}
await writeFile(
  path.join(validationRoot, "fixture.json"),
  JSON.stringify({ ...fixture, origin: "http://127.0.0.1:3130" }, null, 2),
);
const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const productFiles = execFileSync(
  "git",
  ["diff", "--name-only", "origin/main", "HEAD", "--", "src", "prisma", "public"],
  { encoding: "utf8" },
)
  .trim()
  .split(/\r?\n/);
const files = [];
for (const file of productFiles) files.push({ path: file, sha256: sha256(await readFile(file)) });
const assets = [];
for (const name of await readdir("public/images/muster"))
  assets.push({ path: `public/images/muster/${name}`, sha256: sha256(await readFile(`public/images/muster/${name}`)) });
const browser = await chromium.launch();
const screenshots = [];
try {
  for (const [name, profile, width, height, route] of [
    ["captain-desktop", "captain", 1536, 1024, "/captain/voyages/muster-all-ready/muster"],
    ["player-desktop", "sera", 1536, 1024, "/player/playthroughs/muster-all-ready"],
    ["captain-tablet", "captain", 1024, 900, "/captain/voyages/muster-all-ready/muster"],
    ["captain-mobile", "captain", 390, 844, "/captain/voyages/muster-all-ready/muster"],
  ]) {
    const context = await browser.newContext({ viewport: { width, height }, baseURL: fixture.origin });
    await context.addCookies([
      { name: "wayfarer_account", value: fixture.profiles[profile].token, url: fixture.origin },
    ]);
    const page = await context.newPage();
    await page.goto(route);
    await page.locator(".muster-scene[data-viewer-role]").waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    const bytes = await page.screenshot({ path: path.join(output, `${name}.png`) });
    screenshots.push({ path: `${name}.png`, route, viewport: { width, height }, sha256: sha256(bytes) });
    if (width < 1101) {
      await page.locator(".muster-chat").scrollIntoViewIfNeeded();
      const lower = await page.screenshot({ path: path.join(output, `${name}-chat.png`) });
      screenshots.push({ path: `${name}-chat.png`, route, viewport: { width, height }, sha256: sha256(lower) });
    }
    await context.close();
  }
} finally {
  await browser.close();
}
await writeFile(
  path.join(output, "manifest.json"),
  JSON.stringify(
    {
      acceptedAt: "2026-09-12",
      capturedAt: new Date().toISOString(),
      commit,
      branch: "refit-v1/muster",
      files,
      assets,
      screenshots,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({ commit, productFiles: files.length, screenshots: screenshots.length, isolatedFixtureBackup: true }),
);
