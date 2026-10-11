import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { chromium } from "playwright";
import { runExperienceJourney, captureProductExperience } from "../../scripts/sounding-line/experience-browser.mjs";
import { experienceDigest, validateExperienceEvidence } from "../../scripts/sounding-line/product-experience.mjs";

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
