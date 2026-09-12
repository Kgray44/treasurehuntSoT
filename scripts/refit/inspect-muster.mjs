import { chromium } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const fixture = JSON.parse(await readFile(".runtime/muster/fixture.json", "utf8"));
const output = ".runtime/muster/proof";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
const contexts = {};
async function context(key, viewport = { width: 1536, height: 1024 }) {
  const ctx = await browser.newContext({ viewport, baseURL: fixture.origin });
  await ctx.addCookies([{ name: "wayfarer_account", value: fixture.profiles[key].token, url: fixture.origin }]);
  contexts[key] = ctx;
  return ctx;
}
async function pageFor(key, route) {
  const ctx = contexts[key] ?? (await context(key));
  const page = await ctx.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(route, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.locator(".muster-scene[data-viewer-role]").waitFor({ timeout: 120000 });
  await page
    .locator(".muster-cover img")
    .evaluate((img) => img.complete || new Promise((resolve) => img.addEventListener("load", resolve, { once: true })));
  return page;
}
const checks = [];
try {
  const captain = await pageFor("captain", "/captain/voyages/muster-all-ready/muster");
  await captain.screenshot({ path: output + "/desktop-initial.png", fullPage: true });
  const projection = await (await contexts.captain.request.get("/api/voyages/muster-all-ready/muster")).json();
  assert.equal(projection.viewer.isCaptain, true);
  assert.equal(projection.readiness.ready, 4);
  checks.push("Captain+Player initial projection 4/4");
  console.log(
    JSON.stringify({
      checks,
      errors,
      title: await captain.title(),
      scene: await captain.locator(".muster-scene").boundingBox(),
      overflow: await captain.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    }),
  );
} finally {
  await browser.close();
  await writeFile(output + "/initial-result.json", JSON.stringify({ checks, errors }, null, 2));
}
