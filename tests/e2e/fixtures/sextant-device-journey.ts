import { expect, type Page, type Request } from "@playwright/test";

/** Observe only fixed action categories; never retain a code, token or body. */
export function observeNoSextantPairing(page: Page) {
  let pairingActions = 0;
  const origin = new URL(page.url()).origin;
  const observe = (request: Request) => {
    const url = new URL(request.url());
    if (request.method() !== "POST" || url.pathname !== "/api/crossdeck") return;
    // A new Page can start at about:blank; subsequent requests still belong to
    // its task-owned context. Origin equality is required once one is known.
    if (origin !== "null" && url.origin !== origin) return;
    try {
      const action = request.postDataJSON()?.action;
      if (action === "challenge" || action === "claim") pairingActions++;
    } catch {
      pairingActions++;
    }
  };
  page.on("request", observe);
  return {
    assertNone() {
      expect(pairingActions, "No pairing challenge or claim is issued by this journey").toBe(0);
    },
    dispose() {
      page.off("request", observe);
    },
  };
}

export type SextantDeviceFeedback = { task: string; elapsedMs: number; budgetMs: number };

/** Actual credential-free navigation, with an existing 3000ms bound per action. */
export async function openSextantDevicePreferences(page: Page, accountName: string, voyageId: string) {
  const feedback: SextantDeviceFeedback[] = [];
  const measure = async (task: string, activate: () => Promise<unknown>, ready: () => Promise<unknown>) => {
    const start = performance.now();
    await activate();
    await ready();
    const elapsedMs = performance.now() - start;
    feedback.push({ task, elapsedMs, budgetMs: 3000 });
    expect(elapsedMs, task).toBeLessThanOrEqual(3000);
  };
  const heading = (name: string) => page.getByRole("heading", { name, exact: true });
  const account = page.getByRole("button", { name: accountName, exact: true });
  await measure(
    "Open actual account navigation",
    () => account.click(),
    () => expect(page.getByRole("dialog", { name: "Account navigation", exact: true })).toBeVisible(),
  );
  await measure(
    "Return to Personal Harbor",
    () =>
      page
        .getByRole("dialog", { name: "Account navigation", exact: true })
        .getByRole("link", { name: "Personal Harbor", exact: true })
        .click(),
    () => expect(heading("Overview")).toBeVisible(),
  );
  const mobile = page.locator("details.personal-harbor__mobile-sections");
  if ((await mobile.isVisible()) && !(await mobile.evaluate((element) => element.hasAttribute("open")))) {
    await measure(
      "Open Personal Harbor sections",
      () => mobile.locator("summary").click(),
      () => expect(mobile.getByRole("link", { name: "Sessions & Devices", exact: true })).toBeVisible(),
    );
  }
  await measure(
    "Open Sessions and Devices",
    () =>
      page
        .getByRole("navigation", { name: "Personal Harbor sections", exact: true })
        .getByRole("link", { name: "Sessions & Devices", exact: true })
        .click(),
    () => expect(heading("Sessions & Devices")).toBeVisible(),
  );
  const devices = page.getByRole("region", { name: "Connected devices", exact: true });
  await measure(
    "Open ordinary Voyage device preferences",
    () => page.getByRole("link", { name: "Connect your Voyage devices", exact: true }).click(),
    () => expect(devices.getByRole("combobox", { name: "Chronicle", exact: true })).toBeVisible(),
  );
  const chooser = devices.getByRole("combobox", { name: "Chronicle", exact: true });
  const current = await chooser.inputValue();
  // The unbound preference page starts with the actual empty Chronicle choice.
  // Refuse a surprising preselection instead of accepting an unexplained bind.
  expect(current).toBe("");
  const response = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname === "/api/crossdeck" &&
      url.searchParams.get("voyage") === voyageId &&
      response.request().method() === "GET" &&
      response.status() === 200
    );
  });
  await measure(
    "Choose the actual Voyage",
    () => chooser.selectOption(voyageId),
    async () => {
      await expect(chooser).toHaveValue(voyageId);
      const body = await (await response).json();
      expect(body.voyages.some((voyage: { id: string }) => voyage.id === voyageId)).toBe(true);
      expect(body.surfaces.every((surface: { voyageId: string }) => surface.voyageId === voyageId)).toBe(
        true,
      );
    },
  );
  return { devices, feedback };
}
