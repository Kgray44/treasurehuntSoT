import { expect, type Page } from "@playwright/test";

/** Open an owned fixture through the actual Library; this never changes its save membership. */
export async function openOwnedSceneFromCurrentLibrary(
  page: Page,
  options: { definitionId: string; title: string; state: "WORKING" | "SAVED" },
) {
  const toggle = page.getByRole("button", { name: "Open Library", exact: true });
  if ((await toggle.getAttribute("aria-pressed")) !== "true") await toggle.click();
  const library = page.getByRole("region", { name: "Spatial content library", exact: true });
  await library.getByRole("tab", { name: "Scenes", exact: true }).click();
  const source = library.getByRole("combobox", { name: "Source", exact: true });
  if (!(await source.isVisible())) await library.getByRole("button", { name: /Filters & view/ }).click();
  await source.selectOption("MY_CREATIONS");
  await library.getByRole("combobox", { name: "Show", exact: true }).selectOption(options.state);
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
  const identity = page
    .getByRole("region", { name: "Environment and Scene", exact: true })
    .locator("div")
    .filter({ has: page.getByText("EDITING SCENE", { exact: true }) })
    .locator("strong");
  await expect(identity).toHaveText(options.title);
}

export async function closeCurrentLibrary(page: Page) {
  const toggle = page.getByRole("button", { name: "Open Library", exact: true });
  if ((await toggle.getAttribute("aria-pressed")) === "true") await toggle.click();
}

/** Persist the working draft through its actual command, without creating Library membership. */
export async function saveCurrentWorkingDraft(page: Page) {
  await page.getByRole("heading", { name: "Parallax", exact: true }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Save draft", exact: true }).click();
}
