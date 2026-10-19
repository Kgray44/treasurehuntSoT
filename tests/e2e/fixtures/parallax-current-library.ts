import { expect, test, type Page } from "@playwright/test";

export async function openCurrentLibraryCategory(
  page: Page,
  category: "Assets" | "Environments" | "Scenes" | "Effects" | "Compositions",
  source: "ALL" | "MY_CREATIONS" = "ALL",
  state: "WORKING" | "SAVED" = "SAVED",
) {
  const toggle = page.getByRole("button", { name: "Open Library", exact: true });
  if ((await toggle.getAttribute("aria-pressed")) !== "true") await toggle.click();
  const library = page.getByRole("region", { name: "Spatial content library", exact: true });
  await library.getByRole("tab", { name: category, exact: true }).click();
  const sourceControl = library.getByRole("combobox", { name: "Source", exact: true });
  if (!(await sourceControl.isVisible())) await library.getByRole("button", { name: /Filters & view/ }).click();
  await sourceControl.selectOption(source);
  await library.getByRole("combobox", { name: "Show", exact: true }).selectOption(state);
  return library;
}

/** Open an owned fixture through the actual Library without changing its save membership. */
export async function openOwnedSceneFromCurrentLibrary(
  page: Page,
  options: { definitionId: string; title: string; state: "WORKING" | "SAVED" },
) {
  const library = await openCurrentLibraryCategory(page, "Scenes", "MY_CREATIONS", options.state);
  await library.getByRole("searchbox").fill(options.title);
  const inspect = library.getByRole("button", { name: `Inspect ${options.title}`, exact: true });
  await expect(inspect).toHaveCount(1);
  await inspect.click();
  const details = library.getByRole("complementary", { name: `${options.title} details`, exact: true });
  await expect(details).toBeVisible();
  const open = details.getByRole("button", { name: "Open original", exact: true });
  await expect(open).toBeEnabled();
  await open.click();
  await expect.poll(() => new URL(page.url()).searchParams.get("definition")).toBe(options.definitionId);
  // Scene templates use the compact identity; shared-Environment Scenes use the
  // relationship strip. Both must show the exact opened fixture title.
  const identity = page
    .getByRole("region", { name: "Environment and Scene", exact: true })
    .locator("div")
    .filter({ has: page.getByText("EDITING SCENE", { exact: true }) })
    .locator("strong")
    .or(page.getByLabel("Current scene", { exact: true }).locator("strong"));
  await expect(identity).toHaveText(options.title);
}

export async function closeCurrentLibrary(page: Page) {
  const toggle = page.getByRole("button", { name: "Open Library", exact: true });
  if ((await toggle.getAttribute("aria-pressed")) === "true") await toggle.click();
}

export async function addCurrentBuiltinAsset(page: Page, name: string) {
  const library = await openCurrentLibraryCategory(page, "Assets");
  await library.getByRole("searchbox").fill(name);
  await library.getByRole("button", { name: `Inspect ${name}`, exact: true }).click();
  await library
    .getByRole("complementary", { name: `${name} details`, exact: true })
    .getByRole("button", { name: "Add to active Scene", exact: true })
    .click();
}

export async function openCurrentScenePublication(page: Page) {
  await page.getByRole("button", { name: "Open scene settings", exact: true }).click();
  const section = page.getByRole("region", { name: "Library, reuse & publication", exact: true });
  const details = section.locator("details").first();
  if (!(await details.evaluate((element) => (element as HTMLDetailsElement).open)))
    await details.locator("summary").first().click();
}

/** Persist through the working-draft command without creating Library membership. */
export async function saveCurrentWorkingDraft(page: Page) {
  const monitor = await page.evaluateHandle(() => {
    const observations: Record<string, string | number | null>[] = [];
    const observe = (event: Event) => {
      const element = event.target instanceof Element ? event.target : null;
      observations.push({
        type: event.type,
        tag: element?.tagName ?? null,
        label: element?.getAttribute("aria-label") ?? null,
        role: element?.getAttribute("role") ?? null,
        class: element?.getAttribute("class") ?? null,
        top: element?.scrollTop ?? window.scrollY,
        left: element?.scrollLeft ?? window.scrollX,
        time: performance.now(),
      });
    };
    const events = ["scroll", "contextmenu", "pointerdown", "focusin"];
    events.forEach((event) => document.addEventListener(event, observe, true));
    window.addEventListener("resize", observe);
    return {
      observations,
      dispose: () => {
        events.forEach((event) => document.removeEventListener(event, observe, true));
        window.removeEventListener("resize", observe);
      },
    };
  });
  try {
    await page.getByRole("heading", { name: "Parallax", exact: true }).click({ button: "right" });
    const save = page.getByRole("menuitem", { name: "Save draft", exact: true });
    await expect(save).toBeVisible();
    await save.click();
  } finally {
    const observations = await monitor.evaluate((state) => {
      state.dispose();
      return state.observations;
    });
    await test.info().attach("working-save-opener-events", {
      body: JSON.stringify(observations, null, 2),
      contentType: "application/json",
    });
    await monitor.dispose();
  }
}

/** The Scene header owns working-save and editing feedback; Library loading has its own live region. */
export function currentStudioStatus(page: Page) {
  return page.getByRole("heading", { name: "Parallax", exact: true }).locator("..").getByRole("status");
}

export async function openCurrentViewControls(page: Page) {
  const summary = page
    .getByRole("region", { name: "Spatial canvas", exact: true })
    .getByText("View & audio", { exact: true });
  const details = summary.locator("..");
  if (!(await details.evaluate((element) => (element as HTMLDetailsElement).open))) await summary.click();
}
