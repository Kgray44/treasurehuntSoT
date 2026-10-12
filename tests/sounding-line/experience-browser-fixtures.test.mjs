import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { chromium } from "playwright";
import {
  runExperienceJourney,
  captureProductExperience,
  assertIsolatedExperienceFixtureEnvironment,
  resolveExperienceFixturePath,
} from "../../scripts/sounding-line/experience-browser.mjs";
import { experienceDigest, validateExperienceEvidence } from "../../scripts/sounding-line/product-experience.mjs";

test("authenticated experience fixtures refuse shared databases, profiles and missing isolation", () => {
  const root = path.resolve("artifacts/experience-fixture-guard");
  const database = path.join(
    root,
    "artifacts/sounding-line/generic-0123456789ab",
    `validation-isolated-20261011-123456789-${"a".repeat(32)}.db`,
  );
  const environment = {
    SOUNDING_LINE_SUITE_PROFILE: "generic",
    FOREVER_VALIDATION_ISOLATION: "1",
    SOUNDING_LINE_TASK_OWNED_HTTP: "1",
    FOREVER_VALIDATION_NONCE_HASH: "b".repeat(64),
    DATABASE_URL: `file:${database}`,
  };
  assert.equal(assertIsolatedExperienceFixtureEnvironment(root, environment).databasePath, database);
  for (const changes of [
    { SOUNDING_LINE_SUITE_PROFILE: "homeport-phase3" },
    { FOREVER_VALIDATION_ISOLATION: "0" },
    { SOUNDING_LINE_TASK_OWNED_HTTP: "0" },
    { FOREVER_VALIDATION_NONCE_HASH: "" },
    { DATABASE_URL: "file:prisma/dev.db" },
    { DATABASE_URL: `file:${path.resolve(root, "prisma/dev.db")}` },
    { DATABASE_URL: `file:${path.resolve(root, "../shared.db")}` },
  ])
    assert.throws(
      () => assertIsolatedExperienceFixtureEnvironment(root, { ...environment, ...changes }),
      /ISOLATED_ROLE_FIXTURE_REFUSED/u,
    );
  assert.equal(
    resolveExperienceFixturePath("/devices/companion?voyage={voyageId}", { voyageId: "one/voyage" }),
    "/devices/companion?voyage=one%2Fvoyage",
  );
  assert.equal(resolveExperienceFixturePath("/sign-in"), "/sign-in");
  assert.throws(
    () => resolveExperienceFixturePath("/player/playthroughs/{voyageId}/journal"),
    /ISOLATED_ROLE_FIXTURE_REQUIRED/u,
  );
});

// Deliberately deficient, task-owned rendered fixtures. Never edit production UI.
const shell = (body) =>
  `<!doctype html><html lang="en"><head><title>Experience fixture</title><style>body{font:18px system-ui;margin:24px;max-width:800px}a,button{display:inline-block;padding:14px}:focus-visible{outline:3px solid #164fc0}</style></head><body><main>${body}</main></body></html>`;
test("real browser rejects A–G deficient outcomes and captures a valid journey", { timeout: 120000 }, async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "experience-rendered-"));
  // capture resolves the real repository's browser dependencies.
  const workspace = process.cwd();
  const output = `artifacts/experience-fixtures-${process.pid}`;
  const server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    const scenario = url.searchParams.get("case") ?? "positive";
    const suffix = `?case=${scenario}`;
    let body = `<h1>Current Voyage</h1><a href="/lens${suffix}">Use phone as Lens</a>`;
    if (url.pathname === "/lens") {
      if (scenario === "A") body = "<h1>Generic device</h1><p>Role saved: CHRONICLE_LENS</p>";
      else if (scenario === "B")
        body = "<h1>Account settings</h1><p>Configure your profile before returning to play.</p>";
      else if (scenario === "C") body = "<h1>Service response</h1><p>API succeeded: object created.</p>";
      else if (scenario === "E") body = "<h1>Chronicle Lens</h1><p>No released clue available.</p>";
      else if (scenario === "F")
        body = "<h1>Hand calibration</h1><p>No hand detected</p><p>Landmarks: 21; pointing eligible: false</p>";
      else if (scenario === "G")
        body = "<h1>Chronicle Lens</h1><button>View released clue</button><p>Choose a mode</p>";
      else
        body = `<h1>Chronicle Lens</h1><p>Released clue: the blue compass.</p><a href="/voyage${suffix}">Return to Voyage</a>`;
    }
    response.writeHead(200, { "Content-Type": "text/html" });
    response.end(shell(body));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseURL = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  const journey = {
    id: "natural-lens",
    roles: ["ANONYMOUS"],
    outcome: "The advertised Lens presents the released clue and returns to the same Voyage",
    steps: [
      { action: "click", role: "link", name: "Use phone as Lens" },
      {
        action: "assert",
        kind: "outcome",
        role: "main",
        name: "",
        text: "Released clue: the blue compass",
        path: "/lens",
        meaning: "The destination presents the actual released clue",
        state: "LENS_READY",
      },
      { action: "click", role: "link", name: "Return to Voyage" },
      {
        action: "assert",
        role: "heading",
        name: "Current Voyage",
        path: "/voyage",
        returnPath: true,
        state: "RETURNED",
      },
    ],
  };
  const contract = {
    id: "rendered-lens",
    experience: {
      entryPoint: "/voyage",
      devices: ["DESKTOP", "MOBILE"],
      roles: ["ANONYMOUS"],
      states: ["LENS_READY", "RETURNED"],
      systems: ["parallax"],
      journeys: [journey],
      recordingRequired: true,
    },
  };
  try {
    for (const scenario of ["A", "B", "C", "E", "F", "G"])
      await t.test(`${scenario}: missing promised rendered outcome is rejected`, async () => {
        const context = await browser.newContext({ baseURL });
        const page = await context.newPage();
        await page.goto(`/voyage?case=${scenario}`);
        const expectedJourney = structuredClone(journey);
        if (scenario === "F") expectedJourney.steps[1].text = "Hand detected; pointing unavailable";
        await assert.rejects(
          runExperienceJourney({
            page,
            contract,
            journey: expectedJourney,
            device: "DESKTOP",
            artifactRoot: root,
            root,
          }),
          /USER_OUTCOME_FAILED/u,
        );
        await context.close();
      });
    await t.test("a no-op control cannot satisfy an already-present outcome", async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.setContent(
        shell("<h1>Chronicle Lens</h1><button>Use phone as Lens</button><p>Released clue: the blue compass</p>"),
      );
      const noOp = structuredClone(journey);
      noOp.steps[0].role = "button";
      noOp.steps[1].path = "blank";
      await assert.rejects(
        runExperienceJourney({ page, contract, journey: noOp, device: "DESKTOP", artifactRoot: root, root }),
        /JOURNEY_DESTINATION_FAILED|ACTION_OUTCOME_NOT_OBSERVED/u,
      );
      await context.close();
    });
    await t.test("native modal outcomes preserve actual inert Voyage continuity", async () => {
      const context = await browser.newContext({ baseURL });
      const page = await context.newPage();
      await page.goto("/voyage");
      await page.setContent(
        shell(
          "<h1>Current Voyage</h1><button onclick=\"document.querySelector('dialog').showModal()\">Use phone as Lens</button>",
        )
          .replace("<main>", '<main data-voyage="persisted-voyage">')
          .replace(
            "</main>",
            '</main><dialog aria-label="Chronicle Lens"><p>Released clue: the blue compass</p><button onclick="this.closest(\'dialog\').close()">Return to Voyage</button></dialog>',
          ),
      );
      const modalContract = structuredClone(contract);
      modalContract.experience.continuity = {
        checks: [{ id: "same-voyage", role: "main", name: "", attribute: "data-voyage" }],
      };
      const modalJourney = structuredClone(journey);
      modalJourney.steps[0].role = "button";
      modalJourney.steps[1].role = "dialog";
      modalJourney.steps[1].name = "Chronicle Lens";
      modalJourney.steps[1].path = "/voyage";
      modalJourney.steps[2].role = "button";
      modalJourney.steps[3].role = "main";
      modalJourney.steps[3].name = "";
      modalJourney.steps[3].absentRole = { role: "dialog", name: "Chronicle Lens" };
      const observed = await runExperienceJourney({
        page,
        contract: modalContract,
        journey: modalJourney,
        device: "DESKTOP",
        artifactRoot: root,
        root,
      });
      assert.equal(observed.result.status, "PASS");
      assert.equal(observed.result.continuity.length, 1);
      assert.ok(
        observed.result.continuity.every(
          (value) => value.before === value.after && value.atOutcomes.every((outcome) => outcome === value.before),
        ),
      );
      await context.close();
    });
    const plan = {
      applicable: true,
      contracts: [contract],
      contractIds: [contract.id],
      baseSha: "a".repeat(40),
      sourceDigest: "b".repeat(64),
      contractDigest: experienceDigest([contract]),
    };
    const evidence = await captureProductExperience({ root: workspace, plan, baseURL, outputDirectory: output });
    assert.equal(evidence.journeys.length, 2);
    assert.ok(
      evidence.journeys.every(
        (run) =>
          run.status === "PASS" &&
          run.returnPathVerified &&
          run.accessibility.keyboard &&
          !run.accessibility.axeSerious.length,
      ),
    );
    assert.equal(evidence.artifacts.filter((artifact) => artifact.type === "recording").length, 2);
    await t.test("D: actual screenshots and recordings still require independent visual review", () => {
      assert.throws(
        () => validateExperienceEvidence({ root: workspace, plan, evidence }),
        /VISUAL_EVIDENCE_INCOMPLETE/u,
      );
    });
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
    await rm(path.join(workspace, output), { recursive: true, force: true });
  }
});
