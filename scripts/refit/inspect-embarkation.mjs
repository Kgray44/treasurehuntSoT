import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const dir = ".runtime/embarkation/frames";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--use-gl=angle", "--use-angle=d3d11"] });
const errors = [];
for (const viewport of [
  { width: 1600, height: 1000 },
  { width: 820, height: 1180 },
  { width: 2560, height: 1080 },
]) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const frameDir = viewport.width === 1600 ? dir : `${dir}/${viewport.width}x${viewport.height}`;
  await mkdir(frameDir, { recursive: true });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(
    "http://127.0.0.1:3138/dev/embarkation/enter?role=captain&arrival=first&quality=CINEMATIC&inspector=1",
    { waitUntil: "domcontentloaded" },
  );
  await page.getByRole("button", { name: "JOIN THE ADVENTURE", exact: true }).waitFor({ timeout: 60000 });
  await page.waitForFunction(() => !document.querySelector(".embarkation-begin button")?.disabled, { timeout: 60000 });
  console.log(
    JSON.stringify({
      errors,
      viewport,
      initial: await page.evaluate(() => window.__embarkation?.snapshot()),
    }),
  );
  await page.getByRole("button", { name: "Collapse", exact: true }).click();
  for (const t of [0, 1.5, 3, 5.5, 7, 8.03, 9.1, 11.1, 14, 15.5, 17.2, 18.5, 19.5, 20, 22.5, 24, 25]) {
    await page.evaluate((time) => window.__embarkation.seek(time), t);
    await page.screenshot({ path: `${frameDir}/${String(t).replace(".", "-")}.png` });
  }
  await page.close();
}
await writeFile(".runtime/embarkation/inspection-errors.json", JSON.stringify(errors, null, 2));
await browser.close();
