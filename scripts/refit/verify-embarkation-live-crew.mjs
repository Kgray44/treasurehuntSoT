import { PrismaClient } from "@prisma/client";
import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const expected = `file:${path.resolve(".runtime/muster/muster.sqlite").replaceAll("\\", "/")}`;
if (process.env.DATABASE_URL !== expected) throw new Error("EMBARKATION_OWNED_DATABASE_REQUIRED");
const db = new PrismaClient(),
  id = "embarkation-live-crew-check";
const original = await db.playthroughMembership.findUniqueOrThrow({
  where: {
    playthroughId_playerProfileId: { playthroughId: "muster-all-ready", playerProfileId: "muster-profile-sera" },
  },
});
assert.equal(await db.playthroughMembership.count({ where: { id } }), 0, "This run must own the temporary member");
const browser = await chromium.launch({ headless: true, args: ["--use-gl=angle", "--use-angle=d3d11"] });
const page = await browser.newPage({ viewport: { width: 1536, height: 1024 } });
let created = false;
const proof = {};
try {
  await page.goto("http://127.0.0.1:3138/dev/embarkation/enter?role=captain&arrival=first&quality=CINEMATIC");
  await page.waitForFunction(
    () => window.__embarkation && !document.querySelector(".embarkation-begin button")?.disabled,
    null,
    { timeout: 60000 },
  );
  await page.evaluate(() => window.__embarkation.seek(32.3));
  const invite = await page.locator(".muster-open-card").elementHandle();
  await db.playthroughMembership.update({ where: { id: original.id }, data: { status: "ACCEPTED" } });
  await db.playthroughMembership.create({
    data: { id, playthroughId: "muster-all-ready", playerProfileId: "muster-profile-outsider", status: "INVITED" },
  });
  created = true;
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".muster-crew-card").length === 5 &&
      [...document.querySelectorAll(".muster-crew-card")].some(
        (n) => n.textContent.includes("Sera") && n.dataset.ready === "false",
      ),
    null,
    { timeout: 12000 },
  );
  assert.equal(await page.evaluate(() => window.__embarkation.snapshot().time), 32.3);
  assert.equal(await invite.evaluate((n) => n === document.querySelector(".muster-open-card")), true);
  const newCard = page.locator(".muster-crew-card").filter({ hasText: "Visitor" });
  assert.equal(await newCard.evaluate((n) => getComputedStyle(n).visibility), "visible");
  await page.evaluate(() => window.__embarkation.seek(34.7));
  const prior = await page.locator(".muster-open-card").boundingBox();
  await page.evaluate(() => {
    window.__embarkation.seek(35.75);
    window.__embarkation.play();
  });
  await page.waitForFunction(() => !document.querySelector('[data-testid="embarkation-film"]'));
  assert.deepEqual(await page.locator(".muster-open-card").boundingBox(), prior);
  proof.status = "passed";
  proof.crewCount = 5;
  proof.readinessUpdated = true;
  proof.clockPreserved = true;
  proof.inviteHandoffDelta = 0;
} catch (error) {
  proof.status = "failed";
  proof.error = error.stack;
  process.exitCode = 1;
  await page.screenshot({ path: ".runtime/embarkation/verification/live-crew-failure.png" });
} finally {
  await db.playthroughMembership.update({ where: { id: original.id }, data: { status: original.status } });
  if (created) await db.playthroughMembership.delete({ where: { id } });
  proof.fixtureRestored = true;
  await writeFile(".runtime/embarkation/verification/live-crew.json", JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof));
  await browser.close();
  await db.$disconnect();
}
