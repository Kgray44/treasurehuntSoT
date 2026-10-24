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

const reusableAssetToken = "PARALLAX_REUSABLE_ASSET_NAME";
const authoredContract = { id: "parallax.authored-library-and-simulation.experience", experience: {} };
const authoredJourney = {
  id: "creator-reusable-definition-and-scene-copy",
  outcome: "Save a separate definition, inspect it, place its copy and return",
  steps: [
    { action: "fill", role: "textbox", name: "Asset name", contextValue: reusableAssetToken },
    { action: "click", role: "button", name: "Save selected object as reusable asset" },
    {
      action: "assert",
      kind: "outcome",
      role: "status",
      name: "Asset saved",
      text: "Source scene unchanged",
      path: "/studio/parallax",
      meaning: "A separate definition and immutable version were saved without changing the source Scene",
      feedbackBoundary: true,
    },
    { action: "fill", role: "searchbox", name: "Search assets", contextValue: reusableAssetToken },
    {
      action: "click",
      role: "button",
      name: `Inspect ${reusableAssetToken}`,
      contextName: "PARALLAX_REUSABLE_ASSET_INSPECT_NAME",
    },
    {
      action: "assert",
      kind: "outcome",
      role: "complementary",
      name: `${reusableAssetToken} details`,
      contextName: "PARALLAX_REUSABLE_ASSET_DETAILS_NAME",
      text: "Private Library",
      path: "/studio/parallax",
      meaning: "The separate owned definition and its release are discoverable through the canonical Library",
      feedbackBoundary: true,
    },
    { action: "click", role: "button", name: "Place in Scene" },
    {
      action: "assert",
      kind: "outcome",
      role: "status",
      name: "Independent released copy added",
      text: "Independent released copy added",
      path: "/studio/parallax",
      meaning: "The immutable definition produced an independent Scene copy",
      feedbackBoundary: true,
    },
    { action: "click", role: "link", name: "Return to Creator Library" },
    { action: "assert", role: "heading", name: "Creator Library", path: "/studio/library", returnPath: true },
  ],
};

function authoredFixture(
  catalog,
  motionMode,
  { noOpSave = false, noOpInspect = false, preexistingDetails = null } = {},
) {
  const state = {
    assetName: null,
    search: "",
    saved: false,
    selected: preexistingDetails,
    copied: false,
    path: "/studio/parallax",
  };
  const calls = [];
  const count = (role, name) => {
    if (role === "button" && name.startsWith("Inspect "))
      return catalog.filter(
        (item) => `Inspect ${item.name}` === name && item.name.toLowerCase().includes(state.search.toLowerCase()),
      ).length;
    if (role === "complementary") return Number(name === `${state.selected} details`);
    if (name === "Asset saved") return Number(state.saved);
    if (name === "Independent released copy added") return Number(state.copied);
    if (name === "Creator Library") return Number(state.path === "/studio/library");
    return 1;
  };
  const page = {
    url: () => `https://fixture.invalid${state.path}`,
    keyboard: { press: async () => {} },
    waitForURL: async (predicate) => assert(predicate(new URL(page.url()))),
    evaluate: async (fn) => String(fn).includes("matchMedia") && motionMode === "REDUCED",
    getByRole: (role, { name, exact }) => {
      calls.push({ role, name });
      assert.equal(exact, true);
      assert(!name.includes(reusableAssetToken), "lookahead and execution must both use the resolved fixed name");
      const visible = () => {
        const matches = count(role, name);
        assert(matches < 2, `STRICT_DUPLICATE:${role}:${name}`);
        return matches === 1;
      };
      const target = {
        isVisible: async () => visible(),
        innerText: async () =>
          name === "Asset saved" ? "Source scene unchanged" : role === "complementary" ? "Private Library" : name,
        waitFor: async () => assert(visible(), `CONTROL_MISSING:${role}:${name}`),
        filter: () => target,
        evaluate: async () => true,
        fill: async (value) => {
          if (role === "textbox" && name === "Asset name") state.assetName = value;
          else if (role === "searchbox" && name === "Search assets") state.search = value;
          else assert.fail("Unexpected fill control");
        },
        press: async (key) => {
          assert.equal(key, "Enter");
          if (name === "Save selected object as reusable asset" && !noOpSave) {
            // Saving allocates a new identity; equal names are deliberately not deduplicated.
            catalog.push({ id: `definition-${catalog.length}`, name: state.assetName });
            state.saved = true;
          }
          if (name.startsWith("Inspect ") && !noOpInspect) state.selected = name.slice("Inspect ".length);
          if (name === "Place in Scene") state.copied = true;
          if (name === "Return to Creator Library") state.path = "/studio/library";
        },
      };
      return target;
    },
  };
  return { page, state, calls };
}

test("authored reusable assets have four distinct names in one cumulative Creator library and strict details outcomes", async () => {
  const catalog = [];
  const original = structuredClone(authoredJourney);
  for (const device of ["DESKTOP", "MOBILE"])
    for (const motionMode of ["NORMAL", "REDUCED"]) {
      const f = authoredFixture(catalog, motionMode);
      const result = await runExperienceJourney({
        page: f.page,
        contract: authoredContract,
        journey: authoredJourney,
        device,
        motionMode,
        role: "CREATOR",
      });
      const expected = `Reusable review clue ${device} ${motionMode}`;
      assert.equal(result.result.status, "PASS");
      assert.equal(f.state.assetName, expected);
      assert.equal(f.state.search, expected);
      assert.equal(f.state.selected, expected);
      assert.equal(f.state.copied, true);
      assert.deepEqual(result.result.stepContext.applicability, []);
      assert.deepEqual(
        result.result.stepContext.substitutions.map(({ step, field, value }) => ({ step, field, value })),
        [
          { step: 0, field: "value", value: expected },
          { step: 3, field: "value", value: expected },
          { step: 4, field: "name", value: `Inspect ${expected}` },
          { step: 5, field: "name", value: `${expected} details` },
        ],
      );
      assert.deepEqual(
        result.result.observations.map(({ step, meaning, role, text }) => ({ step, meaning, role, text })),
        [2, 5, 7].map((step) => ({
          step,
          meaning: authoredJourney.steps[step].meaning,
          role: authoredJourney.steps[step].role,
          text: authoredJourney.steps[step].text,
        })),
      );
      assert(f.calls.some((call) => call.role === "button" && call.name === `Inspect ${expected}`));
      assert(f.calls.some((call) => call.role === "complementary" && call.name === `${expected} details`));
    }
  assert.equal(new Set(catalog.map((item) => item.name)).size, 4);
  assert.equal(new Set(catalog.map((item) => item.id)).size, 4);
  assert.deepEqual(authoredJourney, original, "resolution must not mutate the source assertions or tokens");
});

test("fixed authored asset names reproduce a strict duplicate after a second save in the shared fixture", async () => {
  const catalog = [];
  const literal = structuredClone(authoredJourney);
  for (const step of literal.steps) {
    if (step.contextValue) step.value = "Reusable review clue";
    if (step.contextName) step.name = step.name.replace(reusableAssetToken, "Reusable review clue");
    delete step.contextValue;
    delete step.contextName;
  }
  const first = authoredFixture(catalog, "NORMAL");
  assert.equal(
    (
      await runExperienceJourney({
        page: first.page,
        contract: authoredContract,
        journey: literal,
        device: "DESKTOP",
        motionMode: "NORMAL",
      })
    ).result.status,
    "PASS",
  );
  const second = authoredFixture(catalog, "REDUCED");
  await assert.rejects(
    runExperienceJourney({
      page: second.page,
      contract: authoredContract,
      journey: literal,
      device: "DESKTOP",
      motionMode: "REDUCED",
    }),
    /STRICT_DUPLICATE:button:Inspect Reusable review clue/u,
  );
  assert.equal(catalog.length, 2);
  assert.equal(new Set(catalog.map((item) => item.id)).size, 2);
});

test("authored name substitution preserves no-op and pre-existing true outcome rejection", async () => {
  for (const options of [
    { noOpSave: true },
    { noOpInspect: true },
    { noOpInspect: true, preexistingDetails: "Reusable review clue DESKTOP NORMAL" },
  ]) {
    const f = authoredFixture([], "NORMAL", options);
    await assert.rejects(
      runExperienceJourney({
        page: f.page,
        contract: authoredContract,
        journey: authoredJourney,
        device: "DESKTOP",
        motionMode: "NORMAL",
      }),
      options.preexistingDetails ? /ACTION_OUTCOME_NOT_OBSERVED/u : /CONTROL_MISSING/u,
    );
  }
});

test("authored contextual names reject invalid scopes, controls, tokens, interpolation and all conditional steps before browser use", async () => {
  const mutations = [
    (input) => {
      input.contract.id = "unrelated";
    },
    (input) => {
      input.journey.id = "unrelated";
    },
    (input) => {
      input.device = "TABLET";
    },
    (input) => {
      input.motionMode = "FAST";
    },
    (input) => {
      input.journey.steps[0].contextValue = "SC02_COMPOSITION_NAME";
    },
    (input) => {
      input.journey.steps[0].contextValue = "process.env.SECRET";
    },
    (input) => {
      input.journey.steps[0].value = "literal";
    },
    (input) => {
      input.journey.steps[0].name = "Object name";
    },
    (input) => {
      input.journey.steps[0].role = "searchbox";
    },
    (input) => {
      input.journey.steps[0].action = "click";
    },
    (input) => {
      input.journey.steps[3].name = "Search compositions";
    },
    (input) => {
      input.journey.steps[4].contextName = "PARALLAX_REUSABLE_ASSET_DETAILS_NAME";
    },
    (input) => {
      input.journey.steps[4].name = "Inspect arbitrary";
    },
    (input) => {
      input.journey.steps[4].action = "assert";
    },
    (input) => {
      input.journey.steps[5].contextName = "PARALLAX_REUSABLE_ASSET_INSPECT_NAME";
    },
    (input) => {
      input.journey.steps[5].role = "region";
    },
    (input) => {
      input.journey.steps[5].kind = "navigation";
    },
    (input) => {
      input.journey.steps[5].name = "arbitrary details";
    },
    (input) => {
      input.journey.steps[5].text = "{{DEVICE}}";
    },
    (input) => {
      input.journey.steps[1].when = { device: "MOBILE" };
    },
    (input) => {
      input.journey.steps[4].devices = ["MOBILE"];
    },
    (input) => {
      input.journey.steps[5].devices = ["DESKTOP"];
    },
    (input) => {
      input.journey.steps[9].devices = ["DESKTOP", "MOBILE"];
    },
  ];
  for (const mutation of mutations) {
    const input = {
      contract: structuredClone(authoredContract),
      journey: structuredClone(authoredJourney),
      device: "DESKTOP",
      motionMode: "NORMAL",
    };
    mutation(input);
    const f = authoredFixture([], "NORMAL");
    await assert.rejects(
      runExperienceJourney({ page: f.page, ...input }),
      /JOURNEY_CONTEXT|JOURNEY_NAVIGATION_CONDITION|JOURNEY_SYNTHETIC_NAME|JOURNEY_CONTEXT_FIELD/u,
    );
    assert.deepEqual(f.calls, []);
  }
});
