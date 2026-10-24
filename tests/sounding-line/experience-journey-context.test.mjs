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

// Deterministic UI/dataflow models of the actual registered Community steps.
// They execute no browser, server, database, screenshots or axe.
const communityToken = "PARALLAX_COMMUNITY_SCENE_NAME";
// Inline source-bound model: no candidate registry or production fixture import.
const communityContract = {
  id: "parallax.spatial-community-publishing.experience",
  experience: {
    entryPoint: "/studio/library",
  },
};
const communityJourney = {
  id: "creator-saved-scene-community-package-review",
  outcome:
    "The Creator saves a private spatial definition, reviews the actual Community package and rights, and returns without publishing",
  steps: [
    {
      action: "click",
      role: "link",
      name: "Spatial Studio",
    },
    {
      action: "assert",
      role: "main",
      name: "",
      text: "Save to Library",
      path: "/studio/parallax",
      kind: "outcome",
      meaning: "The natural entry opens canonical Spatial Studio.",
    },
    {
      action: "click",
      role: "button",
      name: "Open scene settings",
    },
    {
      action: "fill",
      role: "textbox",
      name: "Experience title",
      contextValue: "PARALLAX_COMMUNITY_SCENE_NAME",
    },
    {
      action: "click",
      role: "button",
      name: "Save to Library",
    },
    {
      action: "assert",
      role: "main",
      name: "",
      text: "Saved to Library · one definition",
      path: "/studio/parallax",
      kind: "outcome",
      meaning: "Save retains a private reusable source without Community publication.",
    },
    {
      action: "click",
      role: "button",
      name: "Open Library",
    },
    {
      action: "click",
      role: "tab",
      name: "Assets",
    },
    {
      action: "keyboard",
      key: "ArrowDown",
      expectFocus: {
        role: "tab",
        name: "Environments",
      },
    },
    {
      action: "keyboard",
      key: "ArrowDown",
      expectFocus: {
        role: "tab",
        name: "Scenes",
      },
    },
    {
      action: "click",
      role: "tab",
      name: "Scenes",
    },
    {
      action: "click",
      role: "button",
      name: "Inspect PARALLAX_COMMUNITY_SCENE_NAME",
      contextName: "PARALLAX_COMMUNITY_SCENE_INSPECT_NAME",
    },
    {
      action: "assert",
      role: "complementary",
      name: "PARALLAX_COMMUNITY_SCENE_NAME details",
      text: "Private Library",
      path: "/studio/parallax",
      kind: "outcome",
      meaning: "Saved Scene details expose its private state and contextual action.",
      contextName: "PARALLAX_COMMUNITY_SCENE_DETAILS_NAME",
    },
    {
      action: "click",
      role: "button",
      name: "Publish to Community…",
    },
    {
      action: "assert",
      role: "dialog",
      name: "Publish to Community",
      text: "This is your private saved source",
      path: "/studio/parallax",
      kind: "outcome",
      meaning: "One wizard distinguishes the saved source from a Community release.",
    },
    {
      action: "click",
      role: "button",
      name: "Continue",
    },
    {
      action: "fill",
      role: "textbox",
      name: "Description",
      value: "A synthetic tabletop Scene for other Creators.",
    },
    {
      action: "click",
      role: "button",
      name: "Continue",
    },
    {
      action: "assert",
      role: "dialog",
      name: "Publish to Community",
      text: "The server resolves the saved revision",
      path: "/studio/parallax",
      kind: "outcome",
      meaning: "Included content explains the resolved dependency boundary.",
    },
    {
      action: "click",
      role: "button",
      name: "Continue",
    },
    {
      action: "assert",
      role: "dialog",
      name: "Publish to Community",
      text: "Visibility: Community after approval",
      path: "/studio/parallax",
      kind: "outcome",
      meaning: "Sharing explains moderation and requires license and rights review.",
    },
    {
      action: "click",
      role: "checkbox",
      name: "I own or have permission to redistribute every included element and reviewed its credits.",
    },
    {
      action: "keyboard",
      key: "Space",
    },
    {
      action: "click",
      role: "button",
      name: "Review package",
    },
    {
      action: "assert",
      role: "dialog",
      name: "Publish to Community",
      text: "SERVER-VERIFIED PACKAGE",
      path: "/studio/parallax",
      kind: "outcome",
      meaning: "The server returns sanitized contents and attribution before submission.",
    },
    {
      action: "click",
      role: "button",
      name: "Close publishing",
    },
    {
      action: "click",
      role: "link",
      name: "← Creator Studio",
    },
    {
      action: "assert",
      role: "heading",
      name: "Voyagewright Studio",
      text: "Voyagewright Studio",
      path: "/studio/library",
      returnPath: true,
    },
  ],
};

function communityFixture(
  catalog,
  device,
  {
    noOpTitle = false,
    noOpSave = false,
    noOpInspect = false,
    preexistingSaved = false,
    preexistingDetails = null,
  } = {},
) {
  const state = {
    title: "Desk Map",
    path: "/studio/library",
    settings: false,
    library: false,
    saved: preexistingSaved,
    selected: preexistingDetails,
    publishing: false,
    stage: 0,
    rights: false,
    description: "",
  };
  const calls = [];
  const dialogTexts = [
    "This is your private saved source",
    "Description",
    "The server resolves the saved revision",
    "Visibility: Community after approval",
    "SERVER-VERIFIED PACKAGE",
  ];
  const text = (role) =>
    role === "main"
      ? state.path === "/studio/parallax"
        ? "Save to Library" + (state.saved ? " Saved to Library · one definition" : "")
        : "Library home"
      : role === "dialog"
        ? dialogTexts[state.stage]
        : role === "complementary"
          ? "Private Library"
          : "Voyagewright Studio";
  const count = (role, name) => {
    if (role === "main") return 1;
    if (role === "heading") return Number(name === "Voyagewright Studio" && state.path === "/studio/library");
    if (role === "textbox" && name === "Experience title") return Number(state.settings);
    if (role === "button" && name.startsWith("Inspect "))
      return state.library ? catalog.filter((item) => "Inspect " + item.name === name).length : 0;
    if (role === "complementary") return Number(state.library && name === state.selected + " details");
    if (role === "dialog") return Number(state.publishing && name === "Publish to Community");
    if (role === "tab") return Number(state.library);
    return 1;
  };
  const page = {
    url: () => "https://fixture.invalid" + state.path,
    keyboard: {
      press: async (key) => {
        if (key === "Space") state.rights = !state.rights;
      },
    },
    waitForURL: async (predicate) => assert(predicate(new URL(page.url()))),
    evaluate: async (fn) => String(fn).includes("matchMedia"),
    getByRole: (role, { name, exact }) => {
      calls.push({ role, name });
      assert.equal(exact, true);
      assert(!String(name).includes(communityToken), "tokens must resolve in lookahead and execution");
      const visible = () => {
        const matches = count(role, name);
        assert(matches < 2, "STRICT_DUPLICATE:" + role + ":" + name);
        return matches === 1;
      };
      const target = {
        isVisible: async () => visible(),
        innerText: async () => text(role),
        getAttribute: async () => "model-community-creator",
        evaluate: async () => true,
        waitFor: async () => assert(visible(), "CONTROL_MISSING:" + role + ":" + name),
        filter: ({ hasText }) => ({
          waitFor: async () =>
            assert(visible() && text(role).includes(hasText), "CONTROL_MISSING:" + role + ":" + name + ":" + hasText),
        }),
        fill: async (value) => {
          if (role === "textbox" && name === "Experience title") {
            if (!noOpTitle) state.title = value;
          } else if (role === "textbox" && name === "Description") state.description = value;
          else assert.fail("Unexpected Community fill");
        },
        press: async (key) => {
          assert.equal(key, "Enter");
          if (name === "Spatial Studio") state.path = "/studio/parallax";
          if (name === "Open scene settings") state.settings = true;
          if (name === "Save to Library" && !noOpSave) {
            catalog.push({ id: "community-definition-" + catalog.length, name: state.title });
            state.saved = true;
          }
          if (name === "Open Library") {
            state.library = true;
            if (device === "MOBILE") state.settings = false;
          }
          if (name.startsWith("Inspect ") && !noOpInspect) state.selected = name.slice("Inspect ".length);
          if (name === "Publish to Community…") {
            state.publishing = true;
            state.stage = 0;
          }
          if (name === "Continue") state.stage++;
          if (name === "Review package") {
            assert(state.rights);
            state.stage = 4;
          }
          if (name === "Close publishing") state.publishing = false;
          if (name === "← Creator Studio") state.path = "/studio/library";
        },
      };
      return target;
    },
  };
  return { page, state, calls };
}

test("Community finite names preserve two distinct sources and exact discovery in one shared Creator catalog", async () => {
  const catalog = [];
  const original = structuredClone(communityJourney);
  for (const device of ["DESKTOP", "MOBILE"]) {
    const f = communityFixture(catalog, device);
    const result = await runExperienceJourney({
      page: f.page,
      contract: communityContract,
      journey: communityJourney,
      device,
      motionMode: "REDUCED",
      role: "CREATOR",
    });
    const expected = "Community review Scene " + device + " REDUCED";
    assert.equal(result.result.status, "PASS");
    assert.equal(f.state.title, expected);
    assert.equal(f.state.selected, expected);
    assert.equal(f.state.path, "/studio/library");
    assert.equal(f.state.publishing, false, "review closes without publication");
    assert.deepEqual(result.result.stepContext.applicability, []);
    assert.deepEqual(
      result.result.stepContext.substitutions.map(({ step, field, value }) => ({ step, field, value })),
      [
        { step: 3, field: "value", value: expected },
        { step: 11, field: "name", value: "Inspect " + expected },
        { step: 12, field: "name", value: expected + " details" },
      ],
    );
    assert.deepEqual(
      result.result.observations,
      communityJourney.steps.flatMap((step, index) =>
        step.action === "assert" && step.kind === "outcome"
          ? [
              {
                step: index,
                meaning: step.meaning,
                role: step.role,
                name: step.contextName ? expected + " details" : step.name,
                text: step.text ?? null,
              },
            ]
          : [],
      ),
    );
  }
  assert.equal(new Set(catalog.map((item) => item.id)).size, 2);
  assert.equal(new Set(catalog.map((item) => item.name)).size, 2);
  assert.deepEqual(communityJourney, original);
});

test("Community repeated constant titles still fail strict second-context discovery", async () => {
  const literal = structuredClone(communityJourney);
  for (const step of literal.steps) {
    if (step.contextValue) step.value = "Desk Map";
    if (step.contextName) step.name = step.name.replace(communityToken, "Desk Map");
    delete step.contextValue;
    delete step.contextName;
  }
  const catalog = [];
  const first = communityFixture(catalog, "DESKTOP");
  assert.equal(
    (
      await runExperienceJourney({
        page: first.page,
        contract: communityContract,
        journey: literal,
        device: "DESKTOP",
        motionMode: "REDUCED",
        role: "CREATOR",
      })
    ).result.status,
    "PASS",
  );
  const second = communityFixture(catalog, "MOBILE");
  await assert.rejects(
    runExperienceJourney({
      page: second.page,
      contract: communityContract,
      journey: literal,
      device: "MOBILE",
      motionMode: "REDUCED",
      role: "CREATOR",
    }),
    /STRICT_DUPLICATE:button:Inspect Desk Map/u,
  );
  assert.equal(catalog.length, 2);
});

test("Community title, save and inspection no-ops and already-true predicates remain failures", async () => {
  for (const [options, expected] of [
    [{ noOpTitle: true }, /CONTROL_MISSING/u],
    [{ noOpSave: true }, /USER_OUTCOME_FAILED/u],
    [{ noOpInspect: true }, /CONTROL_MISSING/u],
    [{ noOpSave: true, preexistingSaved: true }, /ACTION_OUTCOME_NOT_OBSERVED/u],
    [
      { noOpInspect: true, preexistingDetails: "Community review Scene DESKTOP REDUCED" },
      /ACTION_OUTCOME_NOT_OBSERVED/u,
    ],
  ]) {
    const f = communityFixture([], "DESKTOP", options);
    await assert.rejects(
      runExperienceJourney({
        page: f.page,
        contract: communityContract,
        journey: communityJourney,
        device: "DESKTOP",
        motionMode: "REDUCED",
        role: "CREATOR",
      }),
      expected,
    );
  }
});

test("Community existing exact contextual title does not permit duplicate suppression", async () => {
  const catalog = [{ id: "retained-distinct-source", name: "Community review Scene DESKTOP REDUCED" }];
  const f = communityFixture(catalog, "DESKTOP");
  await assert.rejects(
    runExperienceJourney({
      page: f.page,
      contract: communityContract,
      journey: communityJourney,
      device: "DESKTOP",
      motionMode: "REDUCED",
      role: "CREATOR",
    }),
    /STRICT_DUPLICATE:button:Inspect Community review Scene/u,
  );
  assert.equal(catalog.length, 2);
  assert.equal(catalog[0].id, "retained-distinct-source");
});

test("Community rejects wrong scope, role, device, motion, token and all navigation skips before UI use", async () => {
  const mutations = [
    (x) => {
      x.contract.id = "unrelated";
    },
    (x) => {
      x.journey.id = "unrelated";
    },
    (x) => {
      x.device = "TABLET";
    },
    (x) => {
      x.role = "PLAYER";
    },
    (x) => {
      x.motionMode = "NORMAL";
    },
    (x) => {
      x.motionMode = "FAST";
    },
    (x) => {
      x.journey.steps[3].contextValue = "SC02_COMPOSITION_NAME";
    },
    (x) => {
      x.journey.steps[3].contextValue = "PARALLAX_REUSABLE_ASSET_NAME";
    },
    (x) => {
      x.journey.steps[3].contextValue = "process.env.SECRET";
    },
    (x) => {
      x.journey.steps[3].value = "literal";
    },
    (x) => {
      x.journey.steps[3].name = "Object name";
    },
    (x) => {
      x.journey.steps[3].role = "searchbox";
    },
    (x) => {
      x.journey.steps[3].action = "click";
    },
    (x) => {
      x.journey.steps[11].contextName = "PARALLAX_COMMUNITY_SCENE_DETAILS_NAME";
    },
    (x) => {
      x.journey.steps[11].name = "Inspect arbitrary";
    },
    (x) => {
      x.journey.steps[11].action = "assert";
    },
    (x) => {
      x.journey.steps[12].role = "region";
    },
    (x) => {
      x.journey.steps[12].kind = "navigation";
    },
    (x) => {
      x.journey.steps[12].name = "arbitrary details";
    },
    (x) => {
      delete x.journey.steps[11].contextName;
    },
    (x) => {
      x.journey.steps[0].devices = ["MOBILE"];
    },
    (x) => {
      x.journey.steps[0].when = { device: "MOBILE" };
    },
    (x) => {
      x.journey.steps[12].text = "{{DEVICE}}";
    },
    (x) => {
      x.journey.steps[12].text = "PARALLAX_COMMUNITY_SCENE_NAME";
    },
    (x) => {
      x.journey.steps[12].meaning = "PARALLAX_COMMUNITY_SCENE_NAME";
    },
    (x) => {
      x.journey.steps[12].contextText = "unsupported";
    },
    (x) => {
      x.journey.steps[1].path = "/PARALLAX_COMMUNITY_SCENE_NAME";
    },
    (x) => {
      x.journey.steps[0].name = "PARALLAX_COMMUNITY_SCENE_NAME";
    },
  ];
  for (const mutation of mutations) {
    const input = {
      contract: structuredClone(communityContract),
      journey: structuredClone(communityJourney),
      device: "DESKTOP",
      motionMode: "REDUCED",
      role: "CREATOR",
    };
    mutation(input);
    const f = communityFixture([], "DESKTOP");
    await assert.rejects(
      runExperienceJourney({ page: f.page, ...input }),
      /JOURNEY_CONTEXT|JOURNEY_NAVIGATION_CONDITION|JOURNEY_SYNTHETIC_NAME/u,
    );
    assert.deepEqual(f.calls, []);
  }
});

test("Community reserved tokens in unrelated literal or unsupported fields fail before UI use", async () => {
  for (const step of [
    { action: "assert", role: "heading", name: "Any", text: "PARALLAX_COMMUNITY_SCENE_NAME" },
    { action: "fill", role: "textbox", name: "Any", value: "PARALLAX_COMMUNITY_SCENE_NAME" },
    { action: "click", role: "button", name: "PARALLAX_COMMUNITY_SCENE_NAME" },
    { action: "assert", role: "heading", name: "Any", path: "/PARALLAX_COMMUNITY_SCENE_NAME" },
    { action: "click", role: "button", name: "Any", contextText: "PARALLAX_COMMUNITY_SCENE_NAME" },
    { action: "click", role: "button", name: "Any", unknown: { token: "PARALLAX_COMMUNITY_SCENE_NAME" } },
  ]) {
    const f = communityFixture([], "DESKTOP");
    await assert.rejects(
      runExperienceJourney({
        page: f.page,
        contract: { id: "unrelated", experience: {} },
        journey: { id: "literal-outside-scope", steps: [step] },
        device: "DESKTOP",
        motionMode: "REDUCED",
        role: "CREATOR",
      }),
      /JOURNEY_CONTEXT_INVALID/u,
    );
    assert.deepEqual(f.calls, []);
  }
});

const roomReloadContract = {
  id: "parallax.parametric-room-correction.experience",
  name: "Editable generic room features and known-measurement correction",
  authority: "one-voyage",
  owners: ["spatial-pilot", "one-voyage", "project-crossdeck", "reach"],
  critical: true,
  experience: {
    persona: "A Creator authoring a real spatial scene with assistance and ordinary editor controls",
    objective: "Correct a room's actual furniture and approximate scale using ordinary Creator controls",
    visibleOutcome:
      "New editable generic geometry appears, attached supports remain protected, known measurement scales the same room, and saved corrections survive reload",
    integrationOwner: "Parallax parametric room correction",
    systems: ["project-parallax", "project-crossdeck", "one-voyage"],
    sourcePaths: ["src/components/studio/parallax", "src/app/studio/parallax"],
    projectionPaths: ["src/parallax"],
    entryPoint: "/studio/library",
    states: ["ROOM_EDIT_READY", "ROOM_FEATURE_ADDED", "ROOM_SAVED", "RETURNED"],
    devices: ["DESKTOP", "MOBILE"],
    roles: ["CREATOR"],
    accessibility:
      "Labeled feature, type and measurement controls support keyboard input; native disclosure summaries expose grouped corrections; phone preserves a usable contextual Inspector and access to the canvas. Themes and reduced motion retain meaning.",
    fallback:
      "Without a configured credential or AI allowance, ordinary authoring and guided placement controls remain available.",
    navigation:
      "Creator Library opens Spatial Studio; assistance overlays the scene; closing and returning restores the ordinary Creator Library.",
    designTarget:
      "Preserve the blue workstation and Room feature selector. Add room features creates explicitly generic placeholders. Classification edits labels; Rebuild changes the actual model while retaining the chosen name, footprint and pose. Remove and Rebuild reject attached supports with recovery guidance; the whole floor stays singular. A known feature width/height/depth uniformly scales approximate room geometry, keeps only that reference measured, and preserves clue sizes and normal history/save. Results must be observable in the actual renderer and correction fields must remain accessible on phone.",
    references: [
      {
        family: "Gateway / public entry",
        path: "Development_Docs/Projects/Project_Homeport/evidence/phase6/HP-P6-EV-001-root-standard-desktop.png",
        sourceSha: "e02ee0dae0469a2ba573beaf409c0b34e8668d09",
        maturity: "ACCEPTED_HOMEPORT_VISUAL_REFERENCE",
        reason: "Accepted public entry establishes hierarchy and a coherent shell around distinct role destinations.",
        preserve:
          "Visible account access, clear destinations, cinematic composition and a usable reduced-motion equivalent.",
      },
      {
        family: "Gateway / public entry",
        path: "Development_Docs/Projects/Project_Homeport/evidence/phase6/HP-P6-EV-002-root-modern-mobile.png",
        sourceSha: "e02ee0dae0469a2ba573beaf409c0b34e8668d09",
        maturity: "ACCEPTED_HOMEPORT_VISUAL_REFERENCE",
        reason: "Accepted constrained gateway keeps the same destinations and account access.",
        preserve: "Mobile task hierarchy, readable controls and contextual navigation.",
      },
    ],
    homeportScreenIds: ["screen-page-studio-library", "screen-page-studio"],
    homeportJourneyIds: ["B"],
    browserTests: [
      "tests/e2e/parallax-parametric-room.spec.ts",
      "tests/e2e/parallax-room-features.spec.ts",
      "tests/e2e/parallax-rooms.spec.ts",
      "tests/e2e/parallax-construction-checks.spec.ts",
    ],
    fixtureProfile: "generic",
    recordingRequired: true,
    limitations: [
      "This increment provides generic editable geometry and an approximate scale reference. Door/window models do not cut openings or simulate opening. It does not establish photograph perception, native calibration, full overhaul, physical readiness or owner acceptance.",
    ],
    roleSetup: {
      CREATOR: {
        entryPoint: "/sign-in?returnTo=%2Fstudio%2Flibrary",
        steps: [
          {
            action: "fill",
            role: "textbox",
            name: "Email or Player name",
            value: "parallax-review-rooms-creator@example.test",
          },
          {
            action: "fill",
            role: "textbox",
            name: "Password",
            value: "Synthetic-Parallax-Review-2026!",
          },
          {
            action: "click",
            role: "button",
            name: "Sign in",
          },
        ],
        witness: {
          role: "heading",
          name: "Voyagewright Studio",
          text: "Voyagewright Studio",
        },
      },
    },
    continuity: {
      objective:
        "The same authenticated Creator identity survives the Studio entry, assistance review and return to the canonical Chronicle library.",
      checks: [
        {
          id: "creator-identity",
          role: "button",
          name: "Synthetic Parallax Rooms Creator",
          attribute: "aria-label",
        },
      ],
    },
    motion: {
      measurement: "Visible keyboard action to rendered editor or assistance feedback",
      feedbackBudgetMs: 3000,
    },
    journeys: [
      {
        id: "creator-adds-generic-room-feature-and-saves",
        roles: ["CREATOR"],
        outcome:
          "New editable generic geometry appears, attached supports remain protected, known measurement scales the same room, and saved corrections survive reload",
        steps: [
          {
            action: "click",
            role: "link",
            name: "Spatial Studio",
          },
          {
            action: "click",
            role: "button",
            name: "Edit room features",
          },
          {
            action: "click",
            role: "button",
            name: "Open spatial context",
          },
          {
            action: "assert",
            role: "region",
            name: "Room spatial context",
            text: "Editable authoring geometry",
            path: "/studio/parallax",
            state: "ROOM_EDIT_READY",
            kind: "outcome",
            meaning: "Editable authoring geometry",
            feedbackBoundary: true,
          },
          {
            action: "click",
            role: "button",
            name: "Add room feature",
          },
          {
            action: "assert",
            role: "region",
            name: "Room feature editor",
            text: "Added a generic desk",
            path: "/studio/parallax",
            state: "ROOM_FEATURE_ADDED",
            kind: "outcome",
            meaning: "Added a generic desk",
            feedbackBoundary: true,
          },
          {
            action: "assert",
            role: "main",
            name: "",
            text: "Working draft saved",
            path: "/studio/parallax",
          },
          {
            action: "reload",
          },
          {
            action: "assert",
            role: "main",
            name: "",
            text: "Working draft opened",
            path: "/studio/parallax",
          },
          {
            action: "click",
            role: "button",
            name: "Edit room features",
          },
          {
            action: "assert",
            role: "combobox",
            name: "Room feature",
            text: "New desk",
            path: "/studio/parallax",
          },
          {
            action: "click",
            role: "combobox",
            name: "Authoring mode",
          },
          {
            action: "keyboard",
            key: "Escape",
            expectFocus: {
              role: "combobox",
              name: "Authoring mode",
            },
          },
          {
            action: "keyboard",
            key: "Shift+F10",
            expectFocus: {
              role: "menuitem",
              name: "Save draft",
            },
          },
          {
            action: "click",
            role: "menuitem",
            name: "Save draft",
          },
          {
            action: "assert",
            role: "main",
            name: "",
            text: "Working draft saved",
            path: "/studio/parallax",
            state: "ROOM_SAVED",
            kind: "outcome",
            meaning: "The normal Creator Save retains the editable room",
            feedbackBoundary: true,
          },
          {
            action: "click",
            role: "link",
            name: "\u2190 Creator Studio",
          },
          {
            action: "assert",
            role: "main",
            name: "",
            text: "Voyagewright Studio",
            path: "/studio/library",
            state: "RETURNED",
            kind: "return",
            meaning: "Creator returns to the canonical Library",
            feedbackBoundary: true,
            returnPath: true,
          },
        ],
      },
    ],
  },
};

import {
  validateExperienceContract,
  validateRoomReloadJourney,
} from "../../scripts/sounding-line/product-experience.mjs";

function roomReloadInput() {
  const contract = structuredClone(roomReloadContract);
  const journey = contract.experience.journeys[0];
  // Pure resolver/action model: retain all predicates but do not pretend to capture application media.
  for (const step of journey.steps) delete step.state;
  return { contract, journey };
}

function roomReloadModel(device = "DESKTOP", motionMode = "REDUCED", options = {}) {
  const state = {
    url: options.initialURL ?? "https://fixture.invalid/studio/library",
    spatial: false,
    feature: false,
    featureRetained: true,
    editing: false,
    status: "Working draft opened",
    menu: false,
    focus: null,
    tabTarget: null,
  };
  const calls = [],
    reloads = [],
    keys = [];
  const text = (role, name) => {
    if (role === "main")
      return new URL(state.url).pathname === "/studio/library" ? "Voyagewright Studio" : state.status;
    if (name === "Room spatial context") return "Editable authoring geometry";
    if (name === "Room feature editor") return "Added a generic desk";
    if (name === "Room feature") return state.featureRetained ? "New desk" : "Original wall";
    return name;
  };
  const visible = (name) =>
    name === "Room spatial context"
      ? state.spatial
      : name === "Room feature editor"
        ? state.feature
        : name === "Save draft"
          ? state.menu
          : true;
  const page = {
    url: () => state.url,
    reload: async (config) => {
      reloads.push({ url: state.url, config });
      if (options.reloadError) throw options.reloadError;
      if (!options.noOpReload) {
        state.spatial = false;
        state.editing = false;
        state.status = options.preexistingSavedAfterReload ? "Working draft saved" : "Working draft opened";
        state.featureRetained = !options.lostGeometry;
      }
      if (options.redirectAfterReload) state.url = options.redirectAfterReload;
    },
    keyboard: {
      press: async (key) => {
        keys.push(key);
        if (key === "Tab") state.focus = state.tabTarget;
        if (key === "Escape") assert.equal(state.focus, "Authoring mode");
        if (key === "Shift+F10") {
          assert.equal(state.focus, "Authoring mode");
          state.menu = true;
          if (!options.badMenuFocus) state.focus = "Save draft";
        }
      },
    },
    waitForURL: async (predicate) => assert(predicate(new URL(state.url))),
    evaluate: async (fn) => (String(fn).includes("matchMedia") ? motionMode === "REDUCED" : false),
    getByRole: (role, { name, exact }) => {
      calls.push({ role, name });
      assert.equal(exact, true);
      const target = {
        isVisible: async () => visible(name),
        innerText: async () => text(role, name),
        getAttribute: async () => "stable-synthetic-room-continuity",
        waitFor: async () => assert(visible(name), "MODEL_CONTROL_MISSING:" + name),
        filter: ({ hasText }) => ({
          waitFor: async () => assert(text(role, name).includes(hasText), "MODEL_TEXT_MISSING:" + hasText),
        }),
        evaluate: async () => {
          state.tabTarget = name;
          return state.focus === name;
        },
        press: async (key) => {
          assert.equal(key, "Enter");
          assert(visible(name));
          if (name === "Spatial Studio") state.url = "https://fixture.invalid/studio/parallax";
          if (name === "Edit room features") state.editing = true;
          if (name === "Open spatial context") state.spatial = true;
          if (name === "Add room feature") {
            state.feature = true;
            state.status = "Working draft saved";
            state.url = "https://fixture.invalid/studio/parallax?definition=synthetic-room&view=room#authoring";
          }
          if (name === "Save draft") {
            assert.equal(state.menu, true);
            if (!options.noOpSave) state.status = "Working draft saved";
            state.menu = false;
          }
          if (name === "← Creator Studio") state.url = "https://fixture.invalid/studio/library";
        },
      };
      return target;
    },
  };
  return { state, page, calls, reloads, keys, device, motionMode };
}

const runRoomReload = (f, input = roomReloadInput(), overrides = {}) =>
  runExperienceJourney({
    page: f.page,
    contract: input.contract,
    journey: input.journey,
    device: f.device,
    motionMode: f.motionMode,
    role: "CREATOR",
    baseURL: "https://fixture.invalid",
    ...overrides,
  });

test("ROOM exact four-context reload admission and schema keep the original outcome predicates", async () => {
  assert.doesNotThrow(() => validateExperienceContract(roomReloadContract));
  for (const device of ["DESKTOP", "MOBILE"])
    for (const motionMode of ["NORMAL", "REDUCED"]) {
      const f = roomReloadModel(device, motionMode);
      const input = roomReloadInput();
      const result = await runRoomReload(f, input);
      assert.equal(result.result.status, "PASS");
      assert.equal(result.result.returnPathVerified, true);
      assert.equal(f.reloads.length, 1);
      assert.deepEqual(f.reloads[0].config, { waitUntil: "domcontentloaded", timeout: 30000 });
      assert.equal(
        f.reloads[0].url,
        "https://fixture.invalid/studio/parallax?definition=synthetic-room&view=room#authoring",
      );
      assert.equal(result.result.savedSceneReloads.length, 1);
      assert.equal(result.result.savedSceneReloads[0].sameFullURL, true);
      assert.equal(result.result.savedSceneReloads[0].timeoutMs, 30000);
      assert.equal(result.result.savedSceneReloads[0].step, 7);
      assert.deepEqual(
        f.keys.filter((key) => key !== "Tab"),
        ["Escape", "Shift+F10"],
      );
      assert.deepEqual(
        result.result.observations,
        input.journey.steps.flatMap((step, index) =>
          step.kind === "outcome"
            ? [{ step: index, meaning: step.meaning, role: step.role, name: step.name, text: step.text }]
            : [],
        ),
      );
    }
});

test("ROOM reload rejects wrong declared scope, duplicate reload and undeclared step data before UI", async () => {
  const changes = [
    (x) => {
      x.contract.id = "unrelated";
    },
    (x) => {
      x.journey.id = "unrelated";
    },
    (x) => {
      x.contract.experience.roles = ["PLAYER"];
    },
    (x) => {
      x.journey.roles = ["PLAYER"];
    },
    (x) => {
      x.contract.experience.devices = ["DESKTOP", "DESKTOP"];
    },
    (x) => {
      delete x.contract.experience.motion;
    },
    (x) => {
      x.journey.steps.push({ action: "reload" });
    },
    ...["url", "path", "value", "name", "role", "timeout", "state", "when", "devices", "contextName", "unknown"].map(
      (key) => (x) => {
        x.journey.steps[7][key] = key === "url" ? "https://other.invalid" : "{{not-supported}}";
      },
    ),
    (x) => {
      x.journey.steps[0].when = { device: "MOBILE" };
    },
    (x) => {
      x.journey.steps[0].name = "{{template}}";
    },
    (x) => {
      x.journey.steps[12].expectFocus.name = "{{nested-template}}";
    },
  ];
  for (const change of changes) {
    const x = roomReloadInput();
    change(x);
    assert.throws(() => validateRoomReloadJourney(x.contract, x.journey), /JOURNEY_RELOAD_(SCOPE|STEP)_INVALID/);
    assert.throws(() => validateExperienceContract(x.contract), /JOURNEY_RELOAD_(SCOPE|STEP)_INVALID/);
    const f = roomReloadModel();
    await assert.rejects(runRoomReload(f, x), /JOURNEY_RELOAD_(SCOPE|STEP)_INVALID/);
    assert.equal(f.calls.length, 0);
    assert.equal(f.reloads.length, 0);
  }
});

test("ROOM reload rejects unsupported runtime roles, devices, motion and base authority before UI", async () => {
  for (const overrides of [
    { role: "ANONYMOUS" },
    { role: "PLAYER" },
    { device: "TABLET" },
    { motionMode: "AUTO" },
    { baseURL: undefined },
    { baseURL: "not-an-absolute-url" },
    { baseURL: "file:///untrusted" },
    { baseURL: "https://other.invalid" },
  ]) {
    const f = roomReloadModel();
    await assert.rejects(
      runRoomReload(f, roomReloadInput(), overrides),
      /JOURNEY_RELOAD_(SCOPE_INVALID|BASE_REQUIRED)/,
    );
    assert.equal(f.calls.length, 0);
    assert.equal(f.reloads.length, 0);
  }
});

test("ROOM saved URL rejects wrong path, absent empty or duplicate definition and Library selectors before reload", async () => {
  for (const initialURL of [
    "https://fixture.invalid/studio/library?definition=one",
    "https://fixture.invalid/studio/parallax",
    "https://fixture.invalid/studio/parallax?definition=",
    "https://fixture.invalid/studio/parallax?definition=%20",
    "https://fixture.invalid/studio/parallax?definition=one&definition=two",
    ...["library", "libraryKind", "libraryVersion"].map(
      (key) => "https://fixture.invalid/studio/parallax?definition=one&" + key + "=selected",
    ),
    "https://foreign.invalid/studio/parallax?definition=one",
  ]) {
    const f = roomReloadModel("DESKTOP", "REDUCED", { initialURL });
    const x = roomReloadInput();
    x.journey.steps = [{ action: "reload" }];
    await assert.rejects(runRoomReload(f, x), /JOURNEY_RELOAD_(URL_INVALID|BASE_REQUIRED)/);
    assert.equal(f.keys.length, 0);
    assert.equal(f.reloads.length, 0);
  }
});

test("ROOM reload requires the exact full saved URL afterward and never retries timeout", async () => {
  for (const redirectAfterReload of [
    "https://fixture.invalid/studio/parallax?definition=different",
    "https://fixture.invalid/studio/parallax?definition=synthetic-room&view=room#different",
    "https://fixture.invalid/studio/parallax?view=room&definition=synthetic-room#authoring",
    "https://foreign.invalid/studio/parallax?definition=synthetic-room&view=room#authoring",
  ]) {
    const f = roomReloadModel("DESKTOP", "REDUCED", { redirectAfterReload });
    await assert.rejects(runRoomReload(f), /JOURNEY_RELOAD_DESTINATION_CHANGED/);
    assert.equal(f.reloads.length, 1);
  }
  const timeout = new Error("SYNTHETIC_RELOAD_TIMEOUT");
  const f = roomReloadModel("DESKTOP", "REDUCED", { reloadError: timeout });
  await assert.rejects(runRoomReload(f), (error) => error === timeout);
  assert.equal(f.reloads.length, 1);
});

test("ROOM reload no-op, lost geometry, bad focus and no-op explicit Save remain failed", async () => {
  for (const options of [{ noOpReload: true }, { lostGeometry: true }, { noOpSave: true }, { badMenuFocus: true }]) {
    const f = roomReloadModel("DESKTOP", "REDUCED", options);
    await assert.rejects(runRoomReload(f), /USER_OUTCOME_FAILED|KEYBOARD_FOCUS_FAILED|ACTION_OUTCOME_NOT_OBSERVED/);
    assert.equal(f.reloads.length, 1);
  }
});

test("ROOM reload cannot credit its own outcome or a pre-existing true Save predicate", async () => {
  const f = roomReloadModel("DESKTOP", "REDUCED", {
    initialURL: "https://fixture.invalid/studio/parallax?definition=one",
  });
  const x = roomReloadInput();
  x.journey.steps = [
    { action: "click", role: "button", name: "Add room feature" },
    { action: "reload" },
    {
      action: "assert",
      kind: "outcome",
      role: "main",
      name: "",
      text: "Working draft opened",
      path: "/studio/parallax",
      meaning: "Reload cannot replace the original Save outcome",
    },
  ];
  await assert.rejects(runRoomReload(f, x), /ACTION_OUTCOME_NOT_OBSERVED/);
  const saved = roomReloadInput();
  saved.journey.steps = saved.journey.steps.filter(
    (step) => !(step.action === "assert" && step.text === "Working draft opened"),
  );
  const already = roomReloadModel("DESKTOP", "REDUCED", { preexistingSavedAfterReload: true });
  await assert.rejects(runRoomReload(already, saved), /ACTION_OUTCOME_NOT_OBSERVED/);
});

test("ROOM reload alone provides no semantic PASS or visible-action credit", async () => {
  const f = roomReloadModel("DESKTOP", "REDUCED", {
    initialURL: "https://fixture.invalid/studio/parallax?definition=one",
  });
  const x = roomReloadInput();
  x.journey.steps = [{ action: "reload" }];
  await assert.rejects(runRoomReload(f, x), /SEMANTIC_JOURNEY_FAILED/);
  assert.equal(f.reloads.length, 1);
  assert.equal(f.keys.length, 0);
});

// These tests model the Save predicate/action only. The valid state stops before
// screenshot capture; no synthetic file is labelled ACTUAL_APPLICATION evidence.
import { validateSceneSavedConfirmation } from "../../scripts/sounding-line/product-experience.mjs";
const sceneSavedContract = {
  id: "parallax.scene-manager.experience",
  name: "Reusable Environments and independent Scene management",
  authority: "one-voyage",
  owners: ["project-parallax"],
  critical: true,
  experience: {
    persona: "A Creator authoring multiple independent Scenes in a reusable Environment",
    objective:
      "Understand shared Environment structure and manage independent Scene content without accidental cross-Scene changes",
    visibleOutcome:
      "A Creator creates The Haunted Bedroom, authors three independent Scenes, switches, duplicates, renames, saves and reviews explicit Environment revision impacts",
    integrationOwner: "Parallax SC-01 Environment and Scene Manager",
    systems: ["project-parallax"],
    sourcePaths: [
      "src/components/studio/parallax/SceneManager.tsx",
      "src/components/studio/parallax/SceneManager.module.css",
      "src/components/studio/parallax/LegacyEnvironmentWorkspace.tsx",
      "src/components/studio/parallax/EnvironmentDefinitionWorkspace.tsx",
      "src/components/studio/parallax/EnvironmentCreateDialog.tsx",
    ],
    projectionPaths: [
      "src/parallax/scene-environment-authoring.ts",
      "src/parallax/legacy-environment-service.ts",
      "src/parallax/environment-library-compatibility.ts",
      "src/parallax/environment-version-resolution.ts",
      "src/parallax/library-lifecycle-service.ts",
      "src/parallax/environment-authoring.ts",
      "src/parallax/legacy-environment-preview.ts",
      "src/parallax/scene-comparison.ts",
    ],
    entryPoint: "/studio/library",
    states: [
      "EDITOR_READY",
      "MANAGER_READY",
      "ENVIRONMENT_EDITING",
      "ENVIRONMENT_SAVED",
      "FIRST_SCENE",
      "SECOND_SCENE",
      "THIRD_SCENE",
      "DUPLICATED",
      "RENAMED",
      "RETURNED",
      "ENVIRONMENT_IMPACT",
      "SCENE_REVALIDATED",
      "COMPARED",
    ],
    devices: ["DESKTOP", "MOBILE"],
    roles: ["CREATOR"],
    accessibility:
      "Native dialog focus containment, explicit labels, visible focus, keyboard entry/Escape and responsive layout preserve the full creation and review workflow.",
    fallback:
      "When 3D rendering is unavailable, the canonical Scene hierarchy, inspector, content-derived gallery and Guided preview remain available.",
    navigation:
      "Creator Library opens Spatial Studio. Manage Scenes opens one contextual gallery. Closing returns to the same active Scene and canvas; Creator Studio returns to the Library.",
    designTarget:
      "Keep the shared Environment and active Scene visible once in a compact context above the canvas. One focused modal manages independent Scenes with content-derived thumbnails, descriptions, save state and explicit immutable version selection. Shared edits open the existing Environment workspace for that same owned definition; built-ins create an owned copy. Working autosave, explicit Library membership and immutable release remain distinct. Revision impact is reviewed per Scene, preserves Undo, identifies changed supports or semantic references, and never rewrites a released Scene. Preserve the blue Studio palette, native modal focus containment, usable narrow controls, reduced motion and natural return to the same Scene.",
    references: [
      {
        family: "Gateway / public entry",
        path: "Development_Docs/Projects/Project_Homeport/evidence/phase6/HP-P6-EV-001-root-standard-desktop.png",
        sourceSha: "e02ee0dae0469a2ba573beaf409c0b34e8668d09",
        maturity: "ACCEPTED_HOMEPORT_VISUAL_REFERENCE",
        reason: "Accepted public entry establishes hierarchy and a coherent shell around distinct role destinations.",
        preserve:
          "Visible account access, clear destinations, cinematic composition and a usable reduced-motion equivalent.",
      },
      {
        family: "Gateway / public entry",
        path: "Development_Docs/Projects/Project_Homeport/evidence/phase6/HP-P6-EV-002-root-modern-mobile.png",
        sourceSha: "e02ee0dae0469a2ba573beaf409c0b34e8668d09",
        maturity: "ACCEPTED_HOMEPORT_VISUAL_REFERENCE",
        reason: "Accepted constrained gateway keeps the same destinations and account access.",
        preserve: "Mobile task hierarchy, readable controls and contextual navigation.",
      },
    ],
    homeportScreenIds: ["screen-page-studio-library", "screen-page-studio"],
    homeportJourneyIds: ["B"],
    browserTests: ["tests/e2e/parallax-scene-manager.spec.ts"],
    fixtureProfile: "generic",
    recordingRequired: true,
    limitations: [
      "Synthetic geometry and browser evidence do not establish physical reconstruction accuracy, native AR rendering or owner product acceptance. Existing SC-02 element consumers retain their own qualification; SC-03 Chronicle editor integration is outside this task.",
    ],
    roleSetup: {
      CREATOR: {
        entryPoint: "/sign-in?returnTo=%2Fstudio%2Flibrary",
        steps: [
          {
            action: "fill",
            role: "textbox",
            name: "Email or Player name",
            value: "parallax-review-floating-creator@example.test",
          },
          {
            action: "fill",
            role: "textbox",
            name: "Password",
            value: "Synthetic-Parallax-Review-2026!",
          },
          {
            action: "click",
            role: "button",
            name: "Sign in",
          },
        ],
        witness: {
          role: "heading",
          name: "Voyagewright Studio",
          text: "Voyagewright Studio",
        },
      },
    },
    continuity: {
      objective:
        "The same authenticated Creator identity survives Library entry, independent Scene creation and return to the canonical Creator Library.",
      checks: [
        {
          id: "creator-identity",
          role: "button",
          name: "Synthetic Parallax Floating Creator",
          attribute: "aria-label",
        },
      ],
    },
    motion: {
      measurement: "Visible keyboard activation to rendered Scene Manager action feedback",
      feedbackBudgetMs: 3000,
      justification:
        "Give useful visible feedback within three seconds on the isolated production browser; this is a browser interaction budget.",
    },
    journeys: [
      {
        id: "creator-shared-environment-independent-scenes",
        roles: ["CREATOR"],
        outcome:
          "A Creator creates The Haunted Bedroom, authors three independent Scenes, switches, duplicates, renames, saves and reviews explicit Environment revision impacts",
        steps: [
          {
            action: "click",
            role: "link",
            name: "Spatial Studio",
          },
          {
            action: "assert",
            role: "main",
            name: "",
            text: "Manage Scenes",
            path: "/studio/parallax",
            state: "EDITOR_READY",
            kind: "outcome",
            meaning: "Creator Library opens the canonical Scene workspace.",
            feedbackBoundary: true,
          },
          {
            action: "click",
            role: "button",
            name: "Manage Scenes",
          },
          {
            action: "assert",
            role: "dialog",
            name: "Environments & Scenes",
            text: "Build the room once.",
            path: "/studio/parallax",
            state: "MANAGER_READY",
            kind: "outcome",
            meaning: "One Manager separates shared structure from independent Scene content.",
            feedbackBoundary: true,
          },
          {
            action: "click",
            role: "button",
            name: "New Environment",
          },
          {
            action: "click",
            role: "button",
            name: "Existing environment Choose a saved room or preset. Edit a separate copy.",
          },
          {
            action: "fill",
            role: "searchbox",
            name: "Find existing environment",
            value: "Bedroom",
          },
          {
            action: "click",
            role: "button",
            name: "Start from Bedroom",
          },
          {
            action: "assert",
            role: "main",
            name: "",
            text: "Parallax / Environment definition",
            path: "/studio/parallax",
            state: "ENVIRONMENT_EDITING",
            kind: "outcome",
            meaning: "Shared structure opens in its distinct canonical working workspace.",
            feedbackBoundary: true,
          },
          {
            action: "fill",
            role: "textbox",
            name: "Name",
            value: "The Haunted Bedroom",
          },
          {
            action: "fill",
            role: "textbox",
            name: "Environment description",
            value: "An invented bedroom shared by three independent Scenes.",
          },
          {
            action: "click",
            role: "button",
            name: "Save to Library",
          },
          {
            action: "click",
            role: "button",
            name: "Versions",
          },
          {
            action: "click",
            role: "button",
            name: "Create immutable version",
          },
          {
            action: "click",
            role: "button",
            name: "Back to scene",
          },
          {
            action: "assert",
            role: "heading",
            name: "Scenes in The Haunted Bedroom",
            text: "Scenes in The Haunted Bedroom",
            path: "/studio/parallax",
            state: "ENVIRONMENT_SAVED",
            kind: "outcome",
            meaning: "The owned released Environment is available as an explicit Scene source.",
            feedbackBoundary: true,
          },
          {
            action: "fill",
            role: "textbox",
            name: "Scene name",
            value: "Ordinary Room",
          },
          {
            action: "fill",
            role: "textbox",
            name: "Scene description",
            value: "The room without supernatural content.",
          },
          {
            action: "click",
            role: "combobox",
            name: "Scene starting content",
          },
          {
            action: "keyboard",
            key: "Home",
          },
          {
            action: "keyboard",
            key: "Enter",
          },
          {
            action: "click",
            role: "button",
            name: "Create Scene from baseline",
          },
          {
            action: "assert",
            role: "region",
            name: "Scene gallery",
            text: "Ordinary Room",
            path: "/studio/parallax",
            state: "FIRST_SCENE",
            kind: "outcome",
            meaning: "An independently saved Scene appears in the same Environment gallery.",
            feedbackBoundary: true,
          },
          {
            action: "fill",
            role: "textbox",
            name: "Scene name",
            value: "The Haunting",
          },
          {
            action: "fill",
            role: "textbox",
            name: "Scene description",
            value: "Spectral footsteps cross the shared bedroom.",
          },
          {
            action: "click",
            role: "combobox",
            name: "Scene starting content",
          },
          {
            action: "keyboard",
            key: "Home",
          },
          {
            action: "keyboard",
            key: "ArrowDown",
          },
          {
            action: "keyboard",
            key: "Enter",
          },
          {
            action: "click",
            role: "button",
            name: "Create Scene from baseline",
          },
          {
            action: "assert",
            role: "region",
            name: "Scene gallery",
            text: "The Haunting",
            path: "/studio/parallax",
            state: "SECOND_SCENE",
            kind: "outcome",
            meaning: "An independently saved Scene appears in the same Environment gallery.",
            feedbackBoundary: true,
          },
          {
            action: "fill",
            role: "textbox",
            name: "Scene name",
            value: "The Hidden Letter",
          },
          {
            action: "fill",
            role: "textbox",
            name: "Scene description",
            value: "An independent letter contains the hidden clue.",
          },
          {
            action: "click",
            role: "combobox",
            name: "Scene starting content",
          },
          {
            action: "keyboard",
            key: "Home",
          },
          {
            action: "keyboard",
            key: "ArrowDown",
          },
          {
            action: "keyboard",
            key: "ArrowDown",
          },
          {
            action: "keyboard",
            key: "Enter",
          },
          {
            action: "click",
            role: "button",
            name: "Create Scene from baseline",
          },
          {
            action: "assert",
            role: "region",
            name: "Scene gallery",
            text: "The Hidden Letter",
            path: "/studio/parallax",
            state: "THIRD_SCENE",
            kind: "outcome",
            meaning: "An independently saved Scene appears in the same Environment gallery.",
            feedbackBoundary: true,
          },
          {
            action: "click",
            role: "button",
            name: "Duplicate active Scene",
          },
          {
            action: "assert",
            role: "dialog",
            name: "Environments & Scenes",
            text: "Independent Scene copy created",
            path: "/studio/parallax",
            state: "DUPLICATED",
            kind: "outcome",
            meaning: "The copy has an independent definition and retains its immutable Environment pin.",
            feedbackBoundary: true,
          },
          {
            action: "fill",
            role: "textbox",
            name: "Rename active Scene",
            value: "The Letter Study",
          },
          {
            action: "click",
            role: "button",
            name: "Rename Scene",
          },
          {
            action: "click",
            role: "button",
            name: "Save Scene",
          },
          {
            action: "assert",
            role: "region",
            name: "Active Scene information",
            text: "The Letter Study",
            path: "/studio/parallax",
            state: "RENAMED",
            confirmation: "Scene saved.",
            kind: "outcome",
            meaning: "The renamed Scene saves independently.",
            feedbackBoundary: true,
          },
          {
            action: "click",
            role: "button",
            name: "Edit shared Environment",
          },
          {
            action: "click",
            role: "combobox",
            name: "Base preview lighting",
          },
          {
            action: "keyboard",
            key: "Home",
          },
          {
            action: "keyboard",
            key: "ArrowDown",
          },
          {
            action: "keyboard",
            key: "Enter",
          },
          {
            action: "click",
            role: "button",
            name: "Versions",
          },
          {
            action: "click",
            role: "button",
            name: "Create immutable version",
          },
          {
            action: "click",
            role: "button",
            name: "Back to scene",
          },
          {
            action: "click",
            role: "button",
            name: "Review Environment impact",
          },
          {
            action: "assert",
            role: "region",
            name: "Environment impact review",
            text: "REVIEW REQUIRED",
            path: "/studio/parallax",
            state: "ENVIRONMENT_IMPACT",
            kind: "outcome",
            meaning: "Existing Scenes remain pinned while the Creator reviews the explicit Environment version change.",
            feedbackBoundary: true,
          },
          {
            action: "click",
            role: "button",
            name: "Update and revalidate Ordinary Room",
          },
          {
            action: "assert",
            role: "region",
            name: "Active Scene information",
            text: "Ordinary Room",
            path: "/studio/parallax",
            state: "SCENE_REVALIDATED",
            kind: "outcome",
            meaning:
              "Only the selected working Scene adopts the reviewed version, with its own history and conflict revision.",
            feedbackBoundary: true,
          },
          {
            action: "click",
            role: "combobox",
            name: "Compare active Scene with",
          },
          {
            action: "keyboard",
            key: "Home",
          },
          {
            action: "keyboard",
            key: "ArrowDown",
          },
          {
            action: "keyboard",
            key: "Enter",
          },
          {
            action: "click",
            role: "button",
            name: "Compare Scenes",
          },
          {
            action: "assert",
            role: "region",
            name: "Scene comparison results",
            text: "ENVIRONMENT REFERENCE",
            path: "/studio/parallax",
            state: "COMPARED",
            kind: "outcome",
            meaning: "The existing Tideglass projection identifies differing immutable Environment references.",
            feedbackBoundary: true,
          },
          {
            action: "click",
            role: "button",
            name: "Close Scene Manager",
          },
          {
            action: "click",
            role: "link",
            name: "← Creator Studio",
          },
          {
            action: "assert",
            role: "heading",
            name: "Voyagewright Studio",
            text: "Voyagewright Studio",
            path: "/studio/library",
            state: "RETURNED",
            returnPath: true,
          },
        ],
      },
    ],
  },
};
const sceneMediaBoundary = new Error("PURE_MODEL_STOP_BEFORE_APPLICATION_SCREENSHOT");
function sceneSavedInput() {
  const contract = structuredClone(sceneSavedContract);
  const journey = contract.experience.journeys[0];
  const predicate = journey.steps.find((step) => step.state === "RENAMED");
  journey.steps = [{ action: "click", role: "button", name: "Save Scene" }, predicate];
  return { contract, journey };
}
function sceneSavedModel(options = {}) {
  const state = {
    title: "The Letter Study",
    notice: options.preexistingSaved ? "Scene saved." : "Scene renamed. Save or use Undo to restore its name.",
  };
  const calls = [],
    waits = [],
    saves = [],
    captures = [];
  let filteredWaitStarts = 0;
  const filtered = (kind, hasText) => ({
    waitFor: async (config) => {
      filteredWaitStarts++;
      waits.push({ kind, config });
      await Promise.resolve();
      assert.equal(filteredWaitStarts, 2, "Both predicates start within the same original five-second wait");
      assert.deepEqual(config, { state: "visible", timeout: 5000 });
      const text = kind === "title" ? state.title : state.notice;
      assert(kind !== "status" || !options.hiddenStatus, "MODEL_STATUS_HIDDEN");
      assert(typeof hasText === "string" ? text.includes(hasText) : hasText.test(text), "MODEL_PREDICATE_FALSE");
    },
  });
  const status = {
    count: async () => options.statusCount ?? 1,
    isVisible: async () => !options.hiddenStatus,
    innerText: async () => state.notice,
    filter: ({ hasText }) => filtered("status", hasText),
  };
  const page = {
    url: () => "https://fixture.invalid/studio/parallax?definition=synthetic-scene",
    keyboard: {
      press: async () => {
        throw Error("UNEXPECTED_KEYBOARD");
      },
    },
    waitForURL: async (predicate) => assert(predicate(new URL(page.url()))),
    screenshot: async () => {
      captures.push("stopped-before-file-write");
      throw sceneMediaBoundary;
    },
    getByRole: (role, selector) => {
      calls.push({ role, ...selector });
      if (role === "button" && selector.name === "Synthetic Parallax Floating Creator") {
        assert.equal(selector.exact, true);
        return {
          getAttribute: async (attribute) => {
            assert.equal(attribute, "aria-label");
            return "stable-synthetic-scene-creator";
          },
        };
      }
      if (role === "dialog") {
        assert.deepEqual(selector, { name: "Environments & Scenes", exact: true });
        return {
          getByRole: (childRole) => {
            assert.equal(childRole, "status");
            return status;
          },
        };
      }
      assert.equal(selector.exact, true);
      assert(["Save Scene", "Active Scene information"].includes(selector.name));
      return {
        waitFor: async () => {},
        isVisible: async () => true,
        innerText: async () => state.title,
        evaluate: async () => true,
        filter: ({ hasText }) => filtered("title", hasText),
        press: async (key) => {
          assert.equal(key, "Enter");
          saves.push(selector.name);
          if (!options.noOpSave) state.notice = "Scene saved.";
          if (options.falseTitleAfter) state.title = "Old title";
          if (options.falseStatusAfter) state.notice = "Scene renamed. Save or use Undo to restore its name.";
        },
      };
    },
  };
  return { state, calls, waits, saves, captures, page };
}
const runSceneSaved = (model, input = sceneSavedInput(), overrides = {}) =>
  runExperienceJourney({
    page: model.page,
    contract: input.contract,
    journey: input.journey,
    artifactRoot: process.cwd(),
    root: process.cwd(),
    device: "DESKTOP",
    role: "CREATOR",
    motionMode: "NORMAL",
    ...overrides,
  });

test("Scene Save confirmation admits four exact contexts and passes the causal guard before media capture", async () => {
  assert.doesNotThrow(() => validateExperienceContract(sceneSavedContract));
  for (const device of ["DESKTOP", "MOBILE"])
    for (const motionMode of ["NORMAL", "REDUCED"]) {
      const model = sceneSavedModel();
      await assert.rejects(
        runSceneSaved(model, sceneSavedInput(), { device, motionMode }),
        (error) => error === sceneMediaBoundary,
      );
      assert.deepEqual(model.saves, ["Save Scene"]);
      assert.deepEqual(model.captures, ["stopped-before-file-write"]);
      assert.deepEqual(
        model.waits.map((x) => x.kind),
        ["title", "status"],
      );
    }
});

test("Scene Save rejects no-op Save after Rename, pre-existing true confirmation and false after predicates", async () => {
  for (const options of [
    { noOpSave: true },
    { preexistingSaved: true },
    { falseTitleAfter: true },
    { falseStatusAfter: true },
  ]) {
    const model = sceneSavedModel(options);
    await assert.rejects(runSceneSaved(model), /USER_OUTCOME_FAILED|ACTION_OUTCOME_NOT_OBSERVED/);
    assert.equal(model.captures.length, 0);
    assert.equal(model.saves.length, 1);
  }
});

test("Scene Save requires one visible exact status within the exact Scene Manager dialog", async () => {
  for (const options of [{ hiddenStatus: true }, { statusCount: 0 }, { statusCount: 2 }]) {
    const model = sceneSavedModel(options);
    await assert.rejects(runSceneSaved(model), /USER_OUTCOME_FAILED|ACTION_OUTCOME_NOT_OBSERVED/);
    assert.equal(model.captures.length, 0);
  }
  // A global or other-dialog status is never queried; every status call is scoped above.
});

test("Scene Save rejects wrong contract, journey, declared role, device or motion before UI", async () => {
  for (const change of [
    (x) => {
      x.contract.id = "unrelated";
    },
    (x) => {
      x.journey.id = "unrelated";
    },
    (x) => {
      x.contract.experience.roles = ["PLAYER"];
    },
    (x) => {
      x.journey.roles = ["PLAYER"];
    },
    (x) => {
      x.contract.experience.devices = ["DESKTOP", "DESKTOP"];
    },
    (x) => {
      x.contract.experience.motion = false;
    },
  ]) {
    const input = sceneSavedInput();
    change(input);
    assert.throws(
      () => validateSceneSavedConfirmation(input.contract, input.journey),
      /SCENE_SAVE_CONFIRMATION_SCOPE_INVALID/,
    );
    assert.throws(() => validateExperienceContract(input.contract), /SCENE_SAVE_CONFIRMATION_SCOPE_INVALID/);
    const model = sceneSavedModel();
    await assert.rejects(runSceneSaved(model, input), /SCENE_SAVE_CONFIRMATION_SCOPE_INVALID/);
    assert.equal(model.calls.length, 0);
  }
});

test("Scene Save rejects unsupported runtime contexts before UI", async () => {
  for (const overrides of [{ role: "ANONYMOUS" }, { role: "PLAYER" }, { device: "TABLET" }, { motionMode: "AUTO" }]) {
    const model = sceneSavedModel();
    await assert.rejects(runSceneSaved(model, sceneSavedInput(), overrides), /SCENE_SAVE_CONFIRMATION_SCOPE_INVALID/);
    assert.equal(model.calls.length, 0);
  }
});

test("Scene Save rejects every changed original predicate, extra keys, unsupported values and nested confirmation before UI", async () => {
  const changes = Object.keys(sceneSavedInput().journey.steps[1]).map((key) => (x) => {
    x.journey.steps[1][key] = key === "feedbackBoundary" ? false : "wrong";
  });
  changes.push(
    (x) => {
      x.journey.steps.push(structuredClone(x.journey.steps[1]));
    },
    ...["url", "timeout", "when", "devices", "contextName", "unknown"].map((key) => (x) => {
      x.journey.steps[1][key] = true;
    }),
    ...[null, {}, "{{Scene saved.}}", "Scene saved", "scene saved."].map((value) => (x) => {
      x.journey.steps[1].confirmation = value;
    }),
    (x) => {
      delete x.journey.steps[1].confirmation;
      x.journey.steps[0].nested = { confirmation: "Scene saved." };
    },
    (x) => {
      delete x.journey.steps[1].confirmation;
      x.journey.steps[0].confirmation = "Scene saved.";
    },
  );
  for (const change of changes) {
    const input = sceneSavedInput();
    change(input);
    assert.throws(
      () => validateSceneSavedConfirmation(input.contract, input.journey),
      /SCENE_SAVE_CONFIRMATION_STEP_INVALID/,
    );
    const model = sceneSavedModel();
    await assert.rejects(runSceneSaved(model, input), /SCENE_SAVE_CONFIRMATION_STEP_INVALID/);
    assert.equal(model.calls.length, 0);
  }
});

test("Scene confirmation has no behavior when absent and preserves legacy journey admission", () => {
  const input = sceneSavedInput();
  delete input.journey.steps[1].confirmation;
  assert.equal(validateSceneSavedConfirmation(input.contract, input.journey), null);
  input.contract.id = "unrelated";
  assert.equal(validateSceneSavedConfirmation(input.contract, input.journey), null);
});

// Pure native-summary selector/action model; this is not a browser/product result.
import { validateRoomNativeDisclosures } from "../../scripts/sounding-line/product-experience.mjs";
function roomMobileDisclosureInput() {
  const input = roomReloadInput();
  input.journey.steps = input.journey.steps.flatMap((step) =>
    step.action === "click" && step.role === "button" && step.name === "Edit room features"
      ? [{ action: "click", kind: "navigation", nativeSummary: "View & audio", devices: ["MOBILE"] }, step]
      : [step],
  );
  input.journey.steps.find((step) => step.kind === "outcome" && step.text === "Working draft saved").role = "status";
  return input;
}
function roomMobileDisclosureModel(device, motionMode, options = {}) {
  const f = roomReloadModel(device, motionMode, options);
  let open = device === "DESKTOP" || !!options.hydrationInitiallyOpen || !!options.alwaysOpen;
  f.disclosureOpens = 0;
  f.nativeSelections = [];
  f.hydrationClosures = 0;
  const get = f.page.getByRole,
    reload = f.page.reload;
  f.page.reload = async (settings) => {
    await reload(settings);
    open = device === "DESKTOP" || !!options.hydrationInitiallyOpen || !!options.alwaysOpen;
  };
  f.page.getByRole = (role, selector) => {
    assert.notEqual(selector.name, "View & audio", "MODEL_NATIVE_SUMMARY_HAS_NO_ARIA_ROLE");
    const target = get(role, selector),
      name = selector.name;
    if (role === "status") {
      target.innerText = async () => f.state.status;
      target.filter = ({ hasText }) => ({
        waitFor: async () => assert(f.state.status.includes(hasText), "MODEL_TEXT_MISSING:" + hasText),
      });
    }
    if (name !== "Edit room features") return target;
    const evaluate = target.evaluate;
    target.isVisible = async () => open;
    target.waitFor = async () => assert(open, "MODEL_DISCLOSURE_CONTROL_HIDDEN");
    target.evaluate = async (...args) => {
      assert(open, "MODEL_DISCLOSURE_CONTROL_HIDDEN");
      return evaluate(...args);
    };
    return target;
  };
  const summary = { tagName: options.wrongTag ? "DIV" : "SUMMARY", textContent: "View & audio" };
  const details = {
    tagName: options.wrongParent ? "DIV" : "DETAILS",
    firstElementChild: options.notFirst ? {} : summary,
    get open() {
      return open;
    },
  };
  summary.parentElement = details;
  f.page.locator = (selector) => {
    assert(["details > summary", "details:not([open]) > summary"].includes(selector));
    const closed = selector.includes(":not");
    return {
      filter: ({ hasText }) => {
        assert.equal(hasText.source, "^View & audio$");
        assert.equal(hasText.flags, "u");
        f.nativeSelections.push(selector);
        return {
          count: async () => options.summaryCount ?? 1,
          waitFor: async (config) => {
            assert.deepEqual(config, { state: "visible", timeout: 30000 });
            assert.equal(device, "MOBILE");
            assert(!options.hiddenNative, "MODEL_NATIVE_SUMMARY_HIDDEN");
            if (closed && open && options.hydrationInitiallyOpen) {
              open = false;
              f.hydrationClosures++;
            }
            assert(!closed || !open, "MODEL_NATIVE_SUMMARY_CLOSED_WAIT");
          },
          click: async (config) => {
            assert.deepEqual(config, { trial: true, timeout: 5000 });
            assert(!options.obscuredNative, "MODEL_NATIVE_SUMMARY_OBSCURED");
          },
          evaluate: async (fn) => {
            if (String(fn).includes("document.activeElement")) {
              f.state.tabTarget = "View & audio";
              return f.state.focus === "View & audio";
            }
            return fn(summary);
          },
          press: async (key) => {
            assert.equal(key, "Enter");
            assert.equal(f.state.focus, "View & audio");
            f.disclosureOpens++;
            if (!options.noOpDisclosure) open = true;
          },
        };
      },
    };
  };
  return f;
}
test("ROOM mobile native disclosure opens exactly twice and desktop skips both without changing outcomes", async () => {
  for (const device of ["DESKTOP", "MOBILE"])
    for (const motion of ["NORMAL", "REDUCED"]) {
      const input = roomMobileDisclosureInput(),
        f = roomMobileDisclosureModel(device, motion);
      assert.doesNotThrow(() => validateExperienceContract(input.contract));
      const result = await runRoomReload(f, input);
      assert.equal(result.result.status, "PASS");
      assert.equal(f.disclosureOpens, device === "MOBILE" ? 2 : 0);
      assert.doesNotThrow(() =>
        validateRoomNativeDisclosures(input.contract, input.journey, JSON.parse(JSON.stringify(result.result)), device),
      );
      assert.equal(f.nativeSelections.length > 0, device === "MOBILE");
      assert.equal(f.reloads.length, 1);
      assert.deepEqual(
        result.result.stepContext.applicability,
        input.journey.steps.flatMap((step, index) =>
          step.devices ? [{ step: index, devices: ["MOBILE"], applicable: device === "MOBILE" }] : [],
        ),
      );
      assert.deepEqual(
        result.result.observations,
        input.journey.steps.flatMap((step, index) =>
          step.kind === "outcome"
            ? [{ step: index, meaning: step.meaning, role: step.role, name: step.name, text: step.text }]
            : [],
        ),
      );
      assert.equal(result.result.nativeDisclosures?.length ?? 0, device === "MOBILE" ? 2 : 0);
      for (const observed of result.result.nativeDisclosures ?? []) {
        assert.deepEqual(observed.before, {
          tagName: "SUMMARY",
          parentTagName: "DETAILS",
          firstChild: true,
          text: "View & audio",
          open: false,
        });
        assert.deepEqual(observed.after, { ...observed.before, open: true });
        assert.equal(observed.keyboard, "Enter");
        assert(!Object.hasOwn(observed, "role"));
      }
    }
  const hydrated = roomMobileDisclosureModel("MOBILE", "NORMAL", { hydrationInitiallyOpen: true });
  await runRoomReload(hydrated, roomMobileDisclosureInput());
  assert.equal(hydrated.hydrationClosures, 2);
  assert.equal(hydrated.disclosureOpens, 2);
});
test("ROOM native disclosure omission, no-op, malformed identity, obscuration and never-closed parents remain failures", async () => {
  const mobile = roomMobileDisclosureModel("MOBILE", "NORMAL");
  await assert.rejects(runRoomReload(mobile, roomReloadInput()), /MODEL_DISCLOSURE_CONTROL_HIDDEN/);
  for (const [options, error] of [
    [{ noOpDisclosure: true }, /NATIVE_DISCLOSURE_NOT_OPENED/],
    [{ summaryCount: 2 }, /NATIVE_DISCLOSURE_IDENTITY_INVALID/],
    [{ summaryCount: 0 }, /NATIVE_DISCLOSURE_IDENTITY_INVALID/],
    [{ wrongTag: true }, /NATIVE_DISCLOSURE_IDENTITY_INVALID/],
    [{ wrongParent: true }, /NATIVE_DISCLOSURE_IDENTITY_INVALID/],
    [{ notFirst: true }, /NATIVE_DISCLOSURE_IDENTITY_INVALID/],
    [{ hiddenNative: true }, /MODEL_NATIVE_SUMMARY_HIDDEN/],
    [{ obscuredNative: true }, /MODEL_NATIVE_SUMMARY_OBSCURED/],
    [{ alwaysOpen: true }, /MODEL_NATIVE_SUMMARY_CLOSED_WAIT/],
  ]) {
    const f = roomMobileDisclosureModel("MOBILE", "REDUCED", options);
    await assert.rejects(runRoomReload(f, roomMobileDisclosureInput()), error);
    assert.equal(f.disclosureOpens, options.noOpDisclosure ? 1 : 0);
  }
  const input = roomMobileDisclosureInput(),
    fixture = roomMobileDisclosureModel("MOBILE", "NORMAL");
  const actual = (await runRoomReload(fixture, input)).result;
  for (const mutate of [
    (r) => {
      delete r.nativeDisclosures;
    },
    (r) => {
      r.nativeDisclosures.pop();
    },
    (r) => {
      r.nativeDisclosures.push(structuredClone(r.nativeDisclosures[0]));
    },
    (r) => {
      r.nativeDisclosures[0].step++;
    },
    (r) => {
      r.nativeDisclosures[0].role = "button";
    },
    (r) => {
      r.nativeDisclosures[0].nativeSummary = "Other";
    },
    (r) => {
      r.nativeDisclosures[0].keyboard = "Space";
    },
    (r) => {
      r.nativeDisclosures[0].before.open = true;
    },
    (r) => {
      r.nativeDisclosures[0].after.open = false;
    },
    (r) => {
      r.nativeDisclosures[0].before.tagName = "BUTTON";
    },
    (r) => {
      r.nativeDisclosures[0].after.parentTagName = "DIV";
    },
    (r) => {
      r.nativeDisclosures[0].before.firstChild = false;
    },
    (r) => {
      r.nativeDisclosures[0].after.text = "Other";
    },
  ]) {
    const bad = structuredClone(actual);
    mutate(bad);
    assert.throws(
      () => validateRoomNativeDisclosures(input.contract, input.journey, bad, "MOBILE"),
      /NATIVE_DISCLOSURE_EVIDENCE_INVALID/,
    );
  }
  assert.throws(
    () => validateRoomNativeDisclosures(input.contract, input.journey, actual, "DESKTOP"),
    /NATIVE_DISCLOSURE_EVIDENCE_INVALID/,
  );
});
test("ROOM rejects malformed native declarations, old fake-role declarations and nonadjacent or extra navigation before UI", async () => {
  const mutations = [
    (x, d) => {
      d[0].action = "assert";
    },
    (x, d) => {
      d[0].role = "button";
    },
    (x, d) => {
      d[0].name = "View & audio";
    },
    (x, d) => {
      d[0].nativeSummary = "Other";
    },
    (x, d) => {
      d[0].kind = "outcome";
    },
    (x, d) => {
      delete d[0].nativeSummary;
      d[0].role = "button";
      d[0].name = "View & audio";
    },
    (x, d) => {
      d[0].devices = ["DESKTOP"];
    },
    (x, d) => {
      d[0].devices = ["MOBILE", "DESKTOP"];
    },
    (x, d) => {
      d[0].devices = ["MOBILE", "MOBILE"];
    },
    (x, d) => {
      d[0].devices = "MOBILE";
    },
    (x, d) => {
      d[0].devices = [];
    },
    (x, d) => {
      d[0].devices = ["TABLET"];
    },
    (x, d) => {
      delete d[0].devices;
    },
    (x, d) => {
      d[0].when = { device: "MOBILE" };
    },
    (x, d) => {
      d[0].contextName = "anything";
    },
    (x, d) => {
      d[0].timeout = 30000;
    },
    (x, d) => {
      d[0].path = "/studio/parallax";
    },
    (x, d) => {
      d[0].state = "ROOM_EDIT_READY";
    },
    (x, d) => {
      x.journey.steps.splice(x.journey.steps.indexOf(d[0]), 1);
    },
    (x, d) => {
      x.journey.steps.splice(x.journey.steps.indexOf(d[1]), 1);
    },
    (x, d) => {
      x.journey.steps.unshift(structuredClone(d[0]));
    },
    (x) => {
      x.journey.steps[0].devices = ["MOBILE"];
    },
    (x, d) => {
      const i = x.journey.steps.indexOf(d[0]);
      [x.journey.steps[i], x.journey.steps[i + 1]] = [x.journey.steps[i + 1], x.journey.steps[i]];
    },
    (x) => {
      x.journey.steps[0].unsupported = { nativeSummary: "View & audio" };
    },
  ];
  for (const mutate of mutations) {
    const x = roomMobileDisclosureInput(),
      d = x.journey.steps.filter((s) => s.devices);
    mutate(x, d);
    assert.throws(() => validateRoomReloadJourney(x.contract, x.journey), /JOURNEY_RELOAD_(SCOPE|STEP)_INVALID/);
    assert.throws(() => validateExperienceContract(x.contract), /JOURNEY_RELOAD_(SCOPE|STEP)_INVALID/);
    const f = roomMobileDisclosureModel("MOBILE", "NORMAL");
    await assert.rejects(runRoomReload(f, x), /JOURNEY_RELOAD_(SCOPE|STEP)_INVALID/);
    assert.equal(f.calls.length, 0);
  }
});
test("ROOM native disclosure rejects unsupported scopes, native fields elsewhere and Community reserved tokens before UI", async () => {
  for (const mutate of [
    (x) => {
      x.contract.id = "spatial-pilot.experience";
    },
    (x) => {
      x.journey.id = "other";
    },
    (x) => {
      x.contract.experience.roles = ["PLAYER"];
    },
    (x) => {
      x.journey.roles = ["PLAYER"];
    },
    (x) => {
      x.contract.experience.devices = ["DESKTOP", "DESKTOP"];
    },
    (x) => {
      delete x.contract.experience.motion;
    },
  ]) {
    const x = roomMobileDisclosureInput();
    mutate(x);
    assert.throws(() => validateExperienceContract(x.contract), /JOURNEY_RELOAD_SCOPE_INVALID/);
    const f = roomMobileDisclosureModel("MOBILE", "NORMAL");
    await assert.rejects(runRoomReload(f, x), /JOURNEY_RELOAD_SCOPE_INVALID/);
    assert.equal(f.calls.length, 0);
  }
  for (const override of [{ role: "PLAYER" }, { device: "TABLET" }, { motionMode: "OTHER" }]) {
    const f = roomMobileDisclosureModel("MOBILE", "NORMAL");
    await assert.rejects(runRoomReload(f, roomMobileDisclosureInput(), override), /JOURNEY_RELOAD_SCOPE_INVALID/);
    assert.equal(f.calls.length, 0);
  }
  const unrelated = roomMobileDisclosureInput();
  unrelated.journey.steps = unrelated.journey.steps.filter((s) => s.action !== "reload");
  unrelated.contract.id = "unrelated";
  assert.throws(() => validateExperienceContract(unrelated.contract), /JOURNEY_RELOAD_SCOPE_INVALID/);
  const reserved = roomMobileDisclosureInput();
  reserved.journey.steps[0].name = "PARALLAX_COMMUNITY_SCENE_NAME";
  const f = roomMobileDisclosureModel("MOBILE", "NORMAL");
  await assert.rejects(runRoomReload(f, reserved), /JOURNEY_CONTEXT_INVALID/);
  assert.equal(f.calls.length, 0);
});
test("ROOM native disclosure preserves no-op Save, already-true Save and lost geometry causal failures", async () => {
  for (const [options, error] of [
    [{ noOpSave: true }, /USER_OUTCOME_FAILED/],
    [{ preexistingSavedAfterReload: true }, /ACTION_OUTCOME_NOT_OBSERVED:.*before-true:after-true/],
    [{ lostGeometry: true }, /USER_OUTCOME_FAILED/],
  ]) {
    const f = roomMobileDisclosureModel("MOBILE", "NORMAL", options),
      input = roomMobileDisclosureInput();
    if (options.preexistingSavedAfterReload)
      input.journey.steps = input.journey.steps.filter(
        (s) => !(s.action === "assert" && s.text === "Working draft opened"),
      );
    await assert.rejects(runRoomReload(f, input), error);
    assert.equal(f.reloads.length, 1);
  }
});

// Pure resolver models: the second inspection represents return-to-source
// reinspection. These models do not prove Profile UI, native DOM or capture.
test("Community permits one bounded reinspection of the same per-context saved Scene", async () => {
  const journey = structuredClone(communityJourney);
  journey.steps.splice(13, 0, structuredClone(journey.steps[11]));
  const retained = structuredClone(journey);
  const catalog = [];
  for (const device of ["DESKTOP", "MOBILE"]) {
    const f = communityFixture(catalog, device);
    const result = await runExperienceJourney({
      page: f.page,
      contract: communityContract,
      journey,
      device,
      motionMode: "REDUCED",
      role: "CREATOR",
    });
    const expected = "Community review Scene " + device + " REDUCED";
    const substitutions = result.result.stepContext.substitutions;
    assert.equal(result.result.status, "PASS");
    assert.equal(substitutions.length, 4);
    assert.deepEqual(
      substitutions.filter((row) => row.token === "PARALLAX_COMMUNITY_SCENE_INSPECT_NAME"),
      [11, 13].map((step) => ({
        step,
        field: "name",
        token: "PARALLAX_COMMUNITY_SCENE_INSPECT_NAME",
        value: "Inspect " + expected,
      })),
    );
    assert.equal(f.state.selected, expected);
    assert.equal(catalog.filter((row) => row.name === expected).length, 1);
    assert.equal(f.state.path, "/studio/library");
    assert.equal(f.state.publishing, false);
  }
  assert.deepEqual(journey, retained);
});

test("Community bounded reinspection rejects missing or third inspection and malformed scope before UI", async () => {
  const valid = structuredClone(communityJourney);
  valid.steps.splice(13, 0, structuredClone(valid.steps[11]));
  const mutations = [
    (x) => {
      x.journey.steps = x.journey.steps.filter((step) => step.contextName !== "PARALLAX_COMMUNITY_SCENE_INSPECT_NAME");
    },
    (x) => {
      x.journey.steps.splice(14, 0, structuredClone(x.journey.steps[11]));
    },
    (x) => {
      x.journey.steps[13].name = "Inspect another Scene";
    },
    (x) => {
      x.journey.steps[13].role = "link";
    },
    (x) => {
      x.journey.steps[13].action = "assert";
    },
    (x) => {
      x.journey.steps[13].contextName = "PARALLAX_COMMUNITY_SCENE_DETAILS_NAME";
    },
    (x) => {
      x.journey.steps[13].contextText = "PARALLAX_COMMUNITY_SCENE_NAME";
    },
    (x) => {
      x.journey.steps[13].devices = ["MOBILE"];
    },
    (x) => {
      x.contract.id = "unrelated";
    },
    (x) => {
      x.journey.id = "unrelated";
    },
    (x) => {
      x.role = "PLAYER";
    },
    (x) => {
      x.device = "TABLET";
    },
    (x) => {
      x.motionMode = "NORMAL";
    },
  ];
  for (const mutation of mutations) {
    const input = {
      contract: structuredClone(communityContract),
      journey: structuredClone(valid),
      role: "CREATOR",
      device: "DESKTOP",
      motionMode: "REDUCED",
    };
    mutation(input);
    const f = communityFixture([], "DESKTOP");
    await assert.rejects(
      runExperienceJourney({ page: f.page, ...input }),
      /JOURNEY_CONTEXT|JOURNEY_NAVIGATION_CONDITION|JOURNEY_SYNTHETIC_NAME/u,
    );
    assert.deepEqual(f.calls, []);
  }
});
