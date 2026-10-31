import { test, expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { createSpatialDraft, draftSchema } from "../../src/parallax/authoring";
import { createStudioTale, getStudioTale, saveStudioDraft } from "../../src/chronicle/studio-service";
import { getBlockDefinition } from "../../src/chronicle/block-registry";

test.describe.configure({ mode: "serial", timeout: 300000 });
test.afterAll(() => db.$disconnect());
test("source-bound actual Spatial Studio owner-review baseline", async ({ page, context, baseURL }) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic Spatial Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  await authenticateClosure(context, account, baseURL!);
  const root = path.resolve("Experience_Images/Spatial_Studio_20261011");
  await mkdir(root, { recursive: true });
  const captures: { file: string; title: string; viewport: unknown; fullPage: boolean }[] = [];
  async function capture(file: string, title: string, target: Page = page) {
    await target.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    });
    await target.evaluate(() => document.fonts.ready);
    await expect.poll(() => target.evaluate(() => window.scrollY)).toBe(0);
    await target.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
    );
    await expect(target.getByRole("region", { name: "Spatial canvas" })).toBeVisible();
    await target.screenshot({ path: path.join(root, `${file}.png`), fullPage: true, animations: "disabled" });
    captures.push({ file: `${file}.png`, title, viewport: target.viewportSize(), fullPage: true });
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/studio/parallax");
  await expect(page.getByLabel("Experience title")).toHaveValue("Desk Map");
  await capture("01-unsaved-workshop", "New workshop and empty owned library (the supported initial state)");
  const draft = createSpatialDraft(`visual-${randomUUID()}`, "Desk Map");
  draft.content.title = "The Captain's Hidden Chart";
  draft.category = "SCENE_TEMPLATE";
  draft.tags = ["captain", "desk", "hidden clue"];
  draft.collection = "Captain's study";
  draft.favorite = true;
  const map = draft.content.entities[0];
  map.name = "Parchment harbor chart";
  map.content = "Follow the compass rose to the northern harbor.";
  map.alternativeText = "A parchment harbor chart on the Captain's desk.";
  map.transform.position.x = -0.25;
  const note = {
    ...structuredClone(map),
    id: `${draft.content.definitionId}:note`,
    name: "Concealed Captain's note",
    widthMeters: 0.22,
    content: "At the third bell, look beneath the northern pier.",
    alternativeText: "A folded note revealed when the chart is inspected.",
  };
  note.transform.position = { x: 0.3, y: 0.1, z: 0.02 };
  const artifact = {
    ...structuredClone(map),
    id: `${draft.content.definitionId}:artifact`,
    name: "Brass bearing marker",
    kind: "MARKER" as const,
    widthMeters: 0.13,
    content: "North bearing",
    alternativeText: "A small brass-colored directional marker beside the chart.",
  };
  artifact.transform.position = { x: 0.25, y: -0.22, z: 0.03 };
  draft.content.entities.push(note, artifact);
  draft.content.studio!.layers = draft.content.entities.map((e) => ({
    entityId: e.id,
    tags: ["desk"],
    visible: true,
    locked: false,
    selectable: true,
    audience: "BOTH",
  }));
  draft.content.studio!.behaviors = [
    { id: "hide-note", trigger: "SCENE_ENTER", delayMs: 0, targetEntityId: note.id, action: "HIDE" },
    {
      id: "reveal-note",
      trigger: "INSPECT",
      sourceEntityId: map.id,
      delayMs: 500,
      targetEntityId: note.id,
      action: "SHOW",
    },
    { id: "north-bearing", trigger: "TIMER", delayMs: 2000, targetEntityId: artifact.id, action: "HIGHLIGHT" },
  ];
  draft.content.fallback.narrative =
    "Inspect the harbor chart to reveal the Captain's folded note. Follow the brass bearing marker north. All clues remain readable without a camera.";
  const safeDraft = draftSchema.parse(draft);
  const loaded = await context.request.get(`${baseURL}/api/studio/parallax`);
  expect(loaded.ok()).toBe(true);
  const { csrfToken } = await loaded.json();
  const headers = { "x-csrf-token": csrfToken };
  const saved = await context.request.post(`${baseURL}/api/studio/parallax`, {
    headers,
    data: { action: "SAVE", draft: safeDraft, revision: 0 },
  });
  expect(saved.ok(), await saved.text()).toBe(true);
  const reusable = createSpatialDraft(`visual-letter-${randomUUID()}`, "Peeking Letter");
  reusable.content.title = "Reusable peeking letter";
  const savedLetter = await context.request.post(`${baseURL}/api/studio/parallax`, {
    headers,
    data: { action: "SAVE", draft: reusable, revision: 0 },
  });
  expect(savedLetter.ok()).toBe(true);
  const releasedLetter = await context.request.post(`${baseURL}/api/studio/parallax`, {
    headers,
    data: {
      action: "RELEASE",
      definitionId: reusable.content.definitionId,
      revision: (await savedLetter.json()).revision,
    },
  });
  expect(releasedLetter.ok(), await releasedLetter.text()).toBe(true);
  const url = `/studio/parallax?definition=${draft.content.definitionId}`;
  await page.goto(url);
  await expect(page.getByLabel("Object name")).toHaveValue(map.name);
  await expect(page.getByRole("region", { name: "Scene graph" })).toContainText(note.name);
  await expect(page.getByRole("region", { name: "Behavior timeline" })).toContainText("Behavior timeline");
  await capture(
    "02-guided-desktop",
    "Guided workspace: populated desk, selected chart, hierarchy, library and declarative timeline",
  );
  await page.getByLabel("Authoring mode").selectOption("DETAILED");
  await expect(page.getByLabel("Layer audience")).toBeVisible();
  await capture("03-detailed-desktop", "Detailed: layer audience, tags and asset/dependency inspector");
  await page.getByLabel("Authoring mode").selectOption("ENGINEERING");
  await expect(page.getByLabel("Position x", { exact: true })).toBeVisible();
  await capture(
    "04-engineering-desktop",
    "Engineering: numeric transforms, coordinate frame and engineering disclosure",
  );
  await page.getByLabel("Authoring mode").selectOption("GUIDED");
  await page.getByRole("button", { name: "Simulate inspect", exact: true }).click();
  await page.getByLabel("Timeline time in milliseconds").fill("2500");
  await expect(
    page.getByRole("group", { name: /synthetic spatial scene/ }).getByRole("button", { name: new RegExp(note.name) }),
  ).toBeVisible();
  await capture(
    "05-scene-preview",
    "Interaction preview at 2.5 seconds: inspected chart reveals note and highlights bearing",
  );
  await page.getByRole("combobox", { name: "Preview", exact: true }).selectOption("FALLBACK");
  await capture("06-guided-fallback", "Camera-free accessible fallback preserves the three clues");
  await page.getByRole("combobox", { name: "Preview", exact: true }).selectOption("EDITOR");
  await page.getByRole("button", { name: "Validate in Drydock", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Drydock spatial checks complete");
  await capture("07-validation", "Drydock findings and synthetic environment checks");
  await page.getByRole("button", { name: "Create immutable version", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Immutable version created");
  await capture(
    "08-version-library",
    "Immutable version and library publishing workflow; Chronicle attachment requires Chronicle context",
  );
  for (const [file, width, height] of [
    ["09-desktop-1440", 1440, 900],
    ["10-tablet", 768, 1024],
    ["11-phone", 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await capture(file, `Responsive Guided workspace ${width} × ${height}`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const tale = await createStudioTale({
    title: "Captain's Hidden Chart synthetic Chronicle",
    slug: `visual-${randomUUID()}`,
    creatorId: account.id,
  });
  const source = await getStudioTale(tale.id);
  const passage = randomUUID(),
    finale = randomUUID();
  await saveStudioDraft(
    tale.id,
    {
      ...source.draft,
      tale: source.tale,
      chapters: [
        {
          ...source.draft.chapters[0],
          blocks: [
            {
              id: passage,
              blockType: "narrative",
              title: "The Captain's study",
              configuration: {
                ...getBlockDefinition("narrative")!.defaultConfiguration,
                heading: "A hidden chart",
                body: "Inspect the map and read the note.",
              },
              presentation: {},
              completion: { mode: "playerConfirmation" },
              nextBlockId: finale,
            },
            {
              id: finale,
              blockType: "taleComplete",
              title: "Voyage complete",
              configuration: { ...getBlockDefinition("taleComplete")!.defaultConfiguration },
              presentation: {},
              completion: { mode: "playerConfirmation" },
            },
          ],
        },
      ],
    },
    account.id,
  );
  await page.goto(`${url}&chronicle=${tale.id}&block=${passage}`);
  await expect(page.getByLabel("Experience title")).toHaveValue(draft.content.title);
  await page.getByRole("button", { name: /v1.0.0/ }).click();
  await page.getByRole("button", { name: "Attach exact version", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Pinned spatial version attached");
  await capture("14-chronicle-attachment", "Pinned immutable scene attached to a real synthetic Chronicle Passage");
  await page.goto(`/studio/tales/${tale.id}/versions`);
  await expect(page.getByRole("heading", { name: /Version|Publication/i }).first()).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(root, "15-publication-review.png"), fullPage: true });
  captures.push({
    file: "15-publication-review.png",
    title: "Actual Chronicle publication review and its Drydock/Sea Trial prerequisites",
    viewport: page.viewportSize(),
    fullPage: true,
  });
  await page.goto(url);
  await expect(page.getByLabel("Experience title")).toHaveValue(draft.content.title);
  await page.getByRole("button", { name: /Reusable peeking letter/ }).click();
  await expect(page.getByLabel("Experience title")).toHaveValue("Reusable peeking letter");
  await capture(
    "12-reusable-library",
    "Reusable library item, five editable presets, taxonomy and immutable version history",
  );
  const restricted = await context.browser()!.newContext({ viewport: { width: 1440, height: 900 } });
  const denied = await restricted.newPage();
  await denied.goto(`${baseURL}/studio/parallax`);
  await denied.evaluate(() => document.fonts.ready);
  await denied.screenshot({ path: path.join(root, "13-restricted.png"), fullPage: true });
  captures.push({
    file: "13-restricted.png",
    title: "Unauthenticated access routes through real Creator authorization",
    viewport: denied.viewportSize(),
    fullPage: true,
  });
  await restricted.close();
  await writeFile(
    path.join(root, "captures.json"),
    JSON.stringify(
      {
        sourceSha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
        fixture: "synthetic-captains-hidden-chart",
        captures,
        unsupported: [
          "Studio has hard-coded dark styling; no light theme control",
          "Initial workshop contains Desk Map; truly empty scene is unsupported",
          "External textures/model renderers are unsupported; uses actual PARCHMENT and MARKER primitives",
          "Loading state is transient, omitted to prioritize fully rendered evidence",
          "Physical-device and owner acceptance remain pending",
        ],
      },
      null,
      2,
    ) + "\n",
  );
});
