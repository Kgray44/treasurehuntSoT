import assert from "node:assert/strict";
import test from "node:test";
import { runExperienceJourney } from "../../scripts/sounding-line/experience-browser.mjs";

test("unrelated legacy journeys retain literal brace labels, text and ignored unknown fields", async () => {
  let current = "/home";
  const names = [];
  const page = {
    url: () => `https://fixture.invalid${current}`,
    keyboard: { press: async () => {} },
    waitForURL: async (predicate) => assert(predicate(new URL(page.url()))),
    evaluate: async (fn) => String(fn).includes("matchMedia"),
    getByRole: (_role, { name }) => {
      names.push(name);
      const target = {
        isVisible: async () => true,
        innerText: async () => "literal {{kept}} text",
        waitFor: async () => {},
        filter: () => target,
        evaluate: async () => true,
        press: async () => {
          current = name.startsWith("Show") ? "/ready" : "/home";
        },
      };
      return target;
    },
  };
  const result = await runExperienceJourney({
    page,
    device: "DESKTOP",
    motionMode: "REDUCED",
    contract: { id: "unrelated-legacy", experience: {} },
    journey: {
      id: "literal-controls",
      steps: [
        { action: "click", role: "button", name: "Show {{literal}}", when: { legacy: true } },
        {
          action: "assert",
          kind: "outcome",
          role: "heading",
          name: "Ready {{literal}}",
          text: "literal {{kept}}",
          path: "/ready",
          meaning: "Literal UI labels remain literal",
        },
        { action: "click", role: "link", name: "Back" },
        { action: "assert", role: "heading", name: "Home", path: "/home", returnPath: true },
      ],
    },
  });
  assert.equal(result.result.status, "PASS");
  assert.equal(result.result.stepContext, undefined);
  assert(names.includes("Ready {{literal}}"));
});

const template = "SC02_COMPOSITION_NAME";
const contract = { id: "spatial-pilot.experience", experience: { entryPoint: "/studio" } };
const journey = {
  id: "sc02-assets-and-reusable-composition",
  outcome: "Place, save and independently reuse a synthetic composition",
  steps: [
    { action: "fill", role: "textbox", name: "Object name", contextValue: template },
    { action: "click", role: "button", name: "Add to active Scene" },
    { action: "click", kind: "navigation", role: "button", name: "Open object properties", devices: ["MOBILE"] },
    {
      action: "assert",
      kind: "outcome",
      role: "region",
      name: "Properties",
      text: "PHYSICAL ASSET",
      path: "/studio",
      meaning: "The added object is inspected",
      feedbackBoundary: true,
    },
    { action: "click", role: "button", name: "Save selected composition" },
    {
      action: "assert",
      kind: "outcome",
      role: "status",
      name: "Saved composition",
      text: "Saved composition",
      path: "/studio",
      meaning: "The context-specific composition is now saved",
    },
    { action: "click", role: "button", name: `Inspect ${template}`, contextName: "SC02_COMPOSITION_INSPECT_NAME" },
    {
      action: "assert",
      kind: "outcome",
      role: "region",
      name: "Reused properties",
      text: "INTERACTION VOLUME",
      path: "/studio",
      meaning: "An independent instance is inspected",
    },
    { action: "click", role: "link", name: "Return to library" },
    { action: "assert", role: "heading", name: "Library home", path: "/library", returnPath: true },
  ],
};

function fixture(device, motionMode, { noOp = false, preexisting = false } = {}) {
  const state = {
    placed: preexisting,
    properties: preexisting,
    saved: false,
    reused: false,
    name: null,
    path: "/studio",
  };
  const calls = [];
  const visible = (name) => {
    if (name === "Saved composition") return state.saved;
    if (name === "Properties") return state.properties;
    if (name === "Open object properties") return device === "MOBILE";
    if (name === "Reused properties") return state.reused;
    if (name === "Library home") return state.path === "/library";
    if (name.startsWith("Inspect ")) return state.saved && name === `Inspect ${state.name}`;
    return true;
  };
  const page = {
    url: () => `https://fixture.invalid${state.path}`,
    keyboard: { press: async () => {} },
    waitForURL: async (predicate) => assert(predicate(new URL(page.url()))),
    evaluate: async (fn) => (String(fn).includes("matchMedia") ? motionMode === "REDUCED" : false),
    getByRole: (role, { name, exact }) => {
      calls.push({ role, name });
      assert.equal(exact, true);
      assert(!name.includes("{{"), "lookahead and execution must both use resolved names");
      assert(!name.includes("SC02_COMPOSITION_NAME"), "the fixed token must resolve in predicate and action targets");
      const target = {
        isVisible: async () => visible(name),
        innerText: async () =>
          name === "Properties"
            ? "PHYSICAL ASSET"
            : name === "Reused properties"
              ? "INTERACTION VOLUME"
              : "Saved composition",
        waitFor: async () => assert(visible(name), `CONTROL_MISSING:${name}`),
        filter: () => target,
        evaluate: async () => true,
        fill: async (value) => {
          state.name = value;
        },
        press: async (key) => {
          assert.equal(key, "Enter");
          if (name === "Add to active Scene" && !noOp) {
            state.placed = true;
            state.properties = device === "DESKTOP";
          }
          if (name === "Open object properties") state.properties = state.placed;
          if (name === "Save selected composition") state.saved = true;
          if (name.startsWith("Inspect ")) state.reused = true;
          if (name === "Return to library") state.path = "/library";
        },
      };
      return target;
    },
  };
  return { state, calls, page };
}

test("SC02 shares navigation applicability and fixed synthetic names across lookahead/execution in all four contexts, preserving causal rejection", async () => {
  const names = new Set();
  for (const device of ["DESKTOP", "MOBILE"])
    for (const motionMode of ["NORMAL", "REDUCED"]) {
      const f = fixture(device, motionMode);
      const result = await runExperienceJourney({
        page: f.page,
        contract,
        journey,
        device,
        motionMode,
        role: "CREATOR",
      });
      assert.equal(result.result.status, "PASS");
      assert.deepEqual(
        result.result.observations.map((row) => row.step),
        [3, 5, 7],
      );
      assert.deepEqual(result.result.stepContext.applicability, [
        { step: 2, devices: ["MOBILE"], applicable: device === "MOBILE" },
      ]);
      assert.equal(
        f.calls.some((row) => row.name === "Open object properties"),
        device === "MOBILE",
      );
      const expected = `SC02 synthetic composition ${device} ${motionMode}`;
      assert.equal(f.state.name, expected);
      names.add(expected);
      assert(
        result.result.stepContext.substitutions.some(
          (row) => row.step === 6 && row.field === "name" && row.value === `Inspect ${expected}`,
        ),
      );
      const stuck = fixture(device, motionMode, { noOp: true, preexisting: true });
      await assert.rejects(
        runExperienceJourney({ page: stuck.page, contract, journey, device, motionMode }),
        /ACTION_OUTCOME_NOT_OBSERVED/u,
      );
    }
  assert.equal(names.size, 4);
  const searchJourney = structuredClone(journey);
  searchJourney.steps[0] = { action: "fill", role: "searchbox", name: "Search compositions", contextValue: template };
  const searchFixture = fixture("MOBILE", "REDUCED");
  const searchResult = await runExperienceJourney({
    page: searchFixture.page,
    contract,
    journey: searchJourney,
    device: "MOBILE",
    motionMode: "REDUCED",
  });
  assert.equal(searchResult.result.status, "PASS");
  assert.equal(searchFixture.state.name, "SC02 synthetic composition MOBILE REDUCED");
  for (const mutation of [
    (j) => {
      j.steps[3].devices = ["MOBILE"];
    },
    (j) => {
      j.steps[0].devices = ["MOBILE"];
    },
    (j) => {
      j.steps[2].kind = "outcome";
    },
    (j) => {
      j.steps[2].name = "Save selected composition";
    },
    (j) => {
      j.steps[2].devices.push("NORMAL");
    },
    (j) => {
      j.steps[2].devices[0] = "TABLET";
    },
    (j) => {
      j.steps[2].state = "SKIPPED_OUTCOME";
    },
    (j) => {
      j.steps[0].contextValue = "process.env.SECRET";
    },
    (j) => {
      j.steps[0].value = "arbitrary literal plus context";
    },
    (j) => {
      j.steps[6].contextName = "ARBITRARY_SELECTOR";
    },
    (j) => {
      j.steps[6].action = "assert";
    },
    (j) => {
      j.steps[3].text = "{{DEVICE}}";
    },
    (j) => {
      j.id = "unrelated-journey";
    },
  ]) {
    const changed = structuredClone(journey);
    mutation(changed);
    const f = fixture("DESKTOP", "NORMAL");
    await assert.rejects(
      runExperienceJourney({ page: f.page, contract, journey: changed, device: "DESKTOP", motionMode: "NORMAL" }),
      /JOURNEY_CONTEXT|JOURNEY_NAVIGATION_CONDITION|JOURNEY_SYNTHETIC_NAME/u,
    );
    assert.deepEqual(f.calls, []);
  }
});
