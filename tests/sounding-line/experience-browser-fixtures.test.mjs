import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { chromium } from "playwright";
import { runExperienceJourney, captureProductExperience } from "../../scripts/sounding-line/experience-browser.mjs";
import { experienceDigest, validateExperienceEvidence } from "../../scripts/sounding-line/product-experience.mjs";

// Deliberately deficient, task-owned rendered fixtures. Never edit production UI.
const shell = (body) =>
  `<!doctype html><html lang="en"><head><title>Experience fixture</title><style>body{font:18px system-ui;margin:24px;max-width:800px}a,button{display:inline-block;padding:14px}:focus-visible{outline:3px solid #164fc0}</style></head><body><main>${body}</main></body></html>`;

async function syntheticCaptureWorkspace(prefix) {
  // These servers render synthetic HTML, never the repository's campaign source.
  // An owned non-Git root keeps that boundary explicit while dependencies resolve
  // through the repository's ancestor node_modules directory.
  const parent = path.join(process.cwd(), "artifacts");
  await mkdir(parent, { recursive: true });
  const workspace = await mkdtemp(path.join(parent, prefix));
  assert.equal(path.dirname(workspace), parent);
  return workspace;
}

test("unobscured continuation rejects a keyboard-usable covered action in both motion modes", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "experience-unobscured-"));
  const server = createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "text/html" });
    response.end(
      shell(`<h1 id="journal">Current Voyage</h1><button id="leave">Leave Journal</button>
      <section id="away" hidden><h2>Outside Journal</h2><button id="back">Return to Journal</button></section>
      <section id="tray" style="position:fixed;bottom:10px;left:10px"><button id="continue">Continue Voyage</button></section>
      <aside id="notice" style="position:fixed;inset:0;z-index:70;background:white" hidden>Readable fallback notice</aside>
      <h2 id="next" hidden>The same Voyage next objective</h2><script>
      document.querySelector('#leave').onclick=()=>{history.pushState({},'', '/away');document.querySelector('#away').hidden=false;document.querySelector('#journal').hidden=true;};
      document.querySelector('#back').onclick=()=>{history.pushState({},'', '/journal');document.querySelector('#away').hidden=true;document.querySelector('#journal').hidden=false;document.querySelector('#notice').hidden=!location.search.includes('covered');};
      document.querySelector('#continue').onclick=()=>document.querySelector('#next').hidden=false;
      </script>`),
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    for (const motionMode of ["NORMAL", "REDUCED"]) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        reducedMotion: motionMode === "REDUCED" ? "reduce" : "no-preference",
      });
      try {
        const page = await context.newPage();
        const journey = {
          id: "phone-return",
          steps: [
            { action: "click", role: "button", name: "Leave Journal" },
            {
              action: "assert",
              kind: "outcome",
              role: "heading",
              name: "Outside Journal",
              path: "/away",
              meaning: "The user leaves the current Journal.",
            },
            { action: "click", role: "button", name: "Return to Journal" },
            { action: "assert", role: "heading", name: "Current Voyage", path: "/journal", returnPath: true },
            { action: "assert", role: "button", name: "Continue Voyage", unobscured: true },
            { action: "click", role: "button", name: "Continue Voyage" },
            {
              action: "assert",
              kind: "outcome",
              role: "heading",
              name: "The same Voyage next objective",
              path: "/journal",
              meaning: "The same Voyage primary continuation has completed.",
            },
          ],
        };
        // Positive control: this covered button remains keyboard operable.
        await page.goto(`http://127.0.0.1:${server.address().port}/journal?covered`);
        await page.evaluate(() => (document.querySelector("#notice").hidden = false));
        await page.getByRole("button", { name: "Continue Voyage", exact: true }).focus();
        await page.keyboard.press("Enter");
        assert.equal(await page.getByRole("heading", { name: "The same Voyage next objective" }).isVisible(), true);
        // Navigation preserves the fixture's covered flag through history state.
        journey.steps[1].path = "/away";
        await page.goto(`http://127.0.0.1:${server.address().port}/journal`);
        await page.evaluate(() => {
          window.covered = true;
          document
            .querySelector("#back")
            .addEventListener("click", () => (document.querySelector("#notice").hidden = false));
        });
        await assert.rejects(
          () =>
            runExperienceJourney({
              page,
              root,
              artifactRoot: root,
              device: "MOBILE",
              motionMode,
              contract: { id: "fixture-unobscured", experience: {} },
              journey,
            }),
          /PRIMARY_ACTION_OBSCURED/u,
        );
        await page.goto(`http://127.0.0.1:${server.address().port}/journal`);
        const observed = await runExperienceJourney({
          page,
          root,
          artifactRoot: root,
          device: "MOBILE",
          motionMode,
          contract: { id: "fixture-unobscured", experience: {} },
          journey,
        });
        assert.equal(observed.result.status, "PASS");
        assert.deepEqual(observed.result.unobscuredActions, [
          { role: "button", name: "Continue Voyage", viewportHitTest: true, trialClick: true },
        ]);
        assert.equal(await page.getByText("Readable fallback notice").count(), 1);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});

test(
  "cached sign-in preserves fresh device and purpose setup across normal and reduced contexts",
  { timeout: 120000 },
  async () => {
    const repository = process.cwd();
    const workspace = await syntheticCaptureWorkspace("experience-context-setup-");
    const output = "capture";
    const observations = {
      logins: [],
      registrations: [],
      purposes: [],
      anonymousCookies: [],
      prematureRegistrations: 0,
    };
    const devices = new Map();
    const server = createServer(async (request, response) => {
      const url = new URL(request.url, "http://localhost");
      const actor = /(?:^|; )fixture_session=([^;]+)/u.exec(request.headers.cookie ?? "")?.[1];
      const html = (body) => {
        response.writeHead(200, { "Content-Type": "text/html" });
        response.end(shell(body));
      };
      const json = (value, status = 200) => {
        response.writeHead(status, { "Content-Type": "application/json" });
        response.end(JSON.stringify(value));
      };
      if (["/sign-in", "/custom-sign-in"].includes(url.pathname)) {
        html(
          '<h1>Fixture sign in</h1><form action="/login" method="post"><label>Email or Player name<input name="identifier" autocomplete="username"></label><label>Password<input name="password" type="password" autocomplete="current-password"></label><button>Sign in</button></form><script>document.querySelector("form").onsubmit=async(event)=>{event.preventDefault();await fetch("/login",{method:"POST",body:new URLSearchParams(new FormData(event.target))});setTimeout(()=>location.assign("/setup"),150);};</script>',
        );
      } else if (url.pathname === "/login") {
        let body = "";
        for await (const chunk of request) body += chunk;
        const identity = new URLSearchParams(body).get("identifier");
        observations.logins.push(identity);
        response.writeHead(200, {
          "Set-Cookie": `fixture_session=${identity}; Path=/; HttpOnly; SameSite=Lax`,
        });
        response.end();
      } else if (url.pathname === "/premature") {
        observations.prematureRegistrations++;
        json({ error: "Setup readiness must be awaited" }, 409);
      } else if (url.pathname === "/register") {
        if (!actor) return json({ error: "Authentication required" }, 401);
        const id = randomUUID();
        devices.set(id, { actor, purpose: false });
        observations.registrations.push({ actor, id });
        json({ id });
      } else if (url.pathname === "/purpose") {
        const id = url.searchParams.get("id"),
          device = devices.get(id);
        if (!device || device.actor !== actor) return json({ error: "Owned context required" }, 403);
        device.purpose = true;
        observations.purposes.push({ actor, id });
        json({ ready: true });
      } else if (url.pathname === "/state") {
        const device = devices.get(url.searchParams.get("id"));
        json({ ready: Boolean(device && device.actor === actor && device.purpose) });
      } else if (url.pathname === "/setup") {
        if (!actor) {
          response.writeHead(303, { Location: "/sign-in?returnTo=%2Fsetup" });
          response.end();
          return;
        }
        html(`<h1>Register this browser context</h1><nav aria-label="Setup ready" hidden>Setup ready</nav><label>Device name<input id="device-name"></label><button id="register">Use this device</button><a id="open" href="/companion" hidden>Open on this device</a><script>
      let setupReady=false;setTimeout(()=>{setupReady=true;document.querySelector('nav').hidden=false;},500);
      document.querySelector('#register').onclick=async()=>{if(!setupReady){await fetch('/premature');return;}if(!document.querySelector('#device-name').value)return;const state=await(await fetch('/register',{method:'POST'})).json();sessionStorage.setItem('fixture-device-id',state.id);document.querySelector('#open').hidden=false;};
      </script>`);
      } else if (["/companion", "/journey"].includes(url.pathname)) {
        html(`<h1>Fixture companion</h1><p id="disconnected" hidden>Reconnect this device</p><button id="change" hidden>Change companion purpose</button><button id="purpose" hidden>Journal companion</button><section id="ready" aria-label="Journal companion" hidden><h2>Owned fixture Journal is ready</h2><a href="/away">Leave companion</a></section><script>
      const id=sessionStorage.getItem('fixture-device-id');
      const showReady=()=>{document.querySelector('#ready').hidden=false;document.querySelector('#change').hidden=true;document.querySelector('#purpose').hidden=true;};
      if(!id)document.querySelector('#disconnected').hidden=false;
      else fetch('/state?id='+encodeURIComponent(id)).then(r=>r.json()).then(s=>{if(s.ready)showReady();else document.querySelector('#change').hidden=false;});
      document.querySelector('#change').onclick=()=>{document.querySelector('#purpose').hidden=false;};
      document.querySelector('#purpose').onclick=async()=>{const response=await fetch('/purpose?id='+encodeURIComponent(id),{method:'POST'});if(response.ok)showReady();};
      </script>`);
      } else if (url.pathname === "/away") {
        html('<h1>Outside companion</h1><a href="/journey">Return to companion</a>');
      } else if (url.pathname === "/public") {
        observations.anonymousCookies.push(request.headers.cookie ?? "");
        html('<h1>Public fixture</h1><a href="/public-away">Leave public fixture</a>');
      } else if (url.pathname === "/public-away")
        html('<h1>Public outside</h1><a href="/public">Return to public fixture</a>');
      else {
        response.writeHead(404);
        response.end();
      }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const contract = (id, identity, devices, motion, signIn = "/sign-in") => ({
      id,
      experience: {
        entryPoint: "/journey",
        devices,
        roles: ["PLAYER"],
        recordingRequired: true,
        states: ["READY", "RETURNED"],
        ...(motion ? { motion: { feedbackBudgetMs: 5000 } } : {}),
        roleSetup: {
          PLAYER: {
            entryPoint: `${signIn}?returnTo=%2Fsetup`,
            steps: [
              { action: "fill", role: "textbox", name: "Email or Player name", value: identity },
              { action: "fill", role: "textbox", name: "Password", value: "Synthetic-Fixture-Only" },
              { action: "click", role: "button", name: "Sign in" },
              { action: "wait", role: "navigation", name: "Setup ready" },
              { action: "fill", role: "textbox", name: "Device name", value: "Owned fixture device" },
              { action: "click", role: "button", name: "Use this device" },
              { action: "click", role: "link", name: "Open on this device" },
              { action: "click", role: "button", name: "Change companion purpose" },
              { action: "click", role: "button", name: "Journal companion" },
            ],
            witness: { role: "region", name: "Journal companion", text: "Owned fixture Journal is ready" },
          },
        },
        journeys: [
          {
            id: "context-round-trip",
            roles: ["PLAYER"],
            steps: [
              {
                action: "assert",
                role: "region",
                name: "Journal companion",
                text: "Owned fixture Journal is ready",
                state: "READY",
              },
              { action: "click", role: "link", name: "Leave companion" },
              {
                action: "assert",
                kind: "outcome",
                role: "heading",
                name: "Outside companion",
                path: "/away",
                meaning: "The context can leave its prepared companion.",
              },
              { action: "click", role: "link", name: "Return to companion" },
              {
                action: "assert",
                role: "region",
                name: "Journal companion",
                path: "/journey",
                returnPath: true,
                state: "RETURNED",
              },
            ],
          },
        ],
      },
    });
    const contracts = [
      contract("fixture.context-setup", "first@example.invalid", ["DESKTOP", "MOBILE"], true),
      contract("fixture.other-account", "second@example.invalid", ["DESKTOP"], true, "/custom-sign-in"),
      contract("fixture.other-canonical-account", "third@example.invalid", ["DESKTOP"], false),
      {
        id: "fixture.anonymous",
        experience: {
          entryPoint: "/public",
          devices: ["DESKTOP"],
          roles: ["ANONYMOUS"],
          states: ["READY", "RETURNED"],
          recordingRequired: true,
          journeys: [
            {
              id: "public-round-trip",
              roles: ["ANONYMOUS"],
              steps: [
                { action: "assert", role: "heading", name: "Public fixture", state: "READY" },
                { action: "click", role: "link", name: "Leave public fixture" },
                {
                  action: "assert",
                  kind: "outcome",
                  role: "heading",
                  name: "Public outside",
                  path: "/public-away",
                  meaning: "Anonymous navigation stays public.",
                },
                { action: "click", role: "link", name: "Return to public fixture" },
                {
                  action: "assert",
                  role: "heading",
                  name: "Public fixture",
                  path: "/public",
                  returnPath: true,
                  state: "RETURNED",
                },
              ],
            },
          ],
        },
      },
    ];
    const plan = {
      applicable: true,
      contracts,
      contractIds: contracts.map((c) => c.id),
      baseSha: execFileSync("git", ["rev-parse", "HEAD"], { cwd: repository, encoding: "utf8" }).trim(),
      sourceDigest: createHash("sha256")
        .update(await readFile(new URL("../../scripts/sounding-line/experience-browser.mjs", import.meta.url)))
        .update(await readFile(new URL(import.meta.url)))
        .digest("hex"),
      contractDigest: experienceDigest(contracts),
    };
    try {
      const evidence = await captureProductExperience({
        root: workspace,
        plan,
        baseURL: `http://127.0.0.1:${server.address().port}`,
        outputDirectory: output,
      });
      assert.equal(evidence.journeys.length, 8);
      assert.ok(evidence.journeys.every((j) => j.status === "PASS" && j.roleVerified && j.returnPathVerified));
      assert.deepEqual(observations.logins, [
        "first@example.invalid",
        "second@example.invalid",
        "second@example.invalid",
        "third@example.invalid",
      ]);
      assert.equal(observations.registrations.filter((r) => r.actor === "first@example.invalid").length, 4);
      assert.equal(observations.registrations.filter((r) => r.actor === "second@example.invalid").length, 2);
      assert.equal(observations.registrations.filter((r) => r.actor === "third@example.invalid").length, 1);
      assert.equal(new Set(observations.registrations.map((r) => r.id)).size, 7);
      assert.equal(observations.prematureRegistrations, 0);
      assert.deepEqual(observations.purposes, observations.registrations);
      assert.ok(
        observations.anonymousCookies.length > 0 && observations.anonymousCookies.every((value) => value === ""),
      );
      assert.deepEqual(
        evidence.journeys.filter((j) => j.contractId === "fixture.context-setup").map((j) => [j.device, j.motionMode]),
        [
          ["DESKTOP", "NORMAL"],
          ["DESKTOP", "REDUCED"],
          ["MOBILE", "NORMAL"],
          ["MOBILE", "REDUCED"],
        ],
      );
      await writeFile(
        path.join(workspace, output, "setup-observations.json"),
        JSON.stringify(
          { classification: "Synthetic real-browser helper regression; not consumer acceptance", ...observations },
          null,
          2,
        ) + "\n",
      );
      console.log(`SOURCE_BOUND_SETUP_FIXTURE ${path.relative(repository, path.join(workspace, output))}`);
    } finally {
      await new Promise((resolve) => server.close(resolve));
      if (process.env.SOUNDING_LINE_RETAIN_SETUP_FIXTURE_EVIDENCE !== "1")
        await rm(workspace, { recursive: true, force: true });
    }
  },
);
test("real browser rejects A–G deficient outcomes and captures a valid journey", { timeout: 120000 }, async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "experience-rendered-"));
  const repository = process.cwd();
  const workspace = await syntheticCaptureWorkspace("experience-fixtures-");
  const output = "capture";
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
      baseSha: execFileSync("git", ["rev-parse", "HEAD"], { cwd: repository, encoding: "utf8" }).trim(),
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
    await rm(workspace, { recursive: true, force: true });
  }
});

test(
  "state capture preserves viewport-bound interaction and the next keyboard action",
  { timeout: 120000 },
  async () => {
    const root = await mkdtemp(path.join(tmpdir(), "experience-viewport-"));
    const server = createServer((request, response) => {
      response.writeHead(200, { "Content-Type": "text/html" });
      response.end(`<!doctype html><html lang="en"><head><title>Viewport-bound fixture</title>
      <style>body{margin:24px;font:18px system-ui;min-height:1800px}button{padding:14px}</style></head>
      <body><main><h1>Current Voyage</h1><button id="begin">Begin setup</button></main>
      <script>
        const size=[innerWidth,innerHeight];let prepared=false;
        window.geometryChanges=[];
        addEventListener('resize',()=>{
          if(innerWidth!==size[0]||innerHeight!==size[1]){
            geometryChanges.push([innerWidth,innerHeight]);
            if(prepared){prepared=false;document.querySelector('main').innerHTML='<h1>Setup invalidated</h1>';}
          }
        });
        document.querySelector('#begin').onclick=()=>{
          prepared=true;history.pushState({},'', '/check');
          document.querySelector('main').innerHTML='<h1>Independent check required</h1><button id="check">Check new target</button>';
          document.querySelector('#check').onclick=()=>{
            prepared=false;history.pushState({},'', '/checked');
            document.querySelector('main').innerHTML='<h1>Check complete</h1><a href="/voyage">Return to Voyage</a>';
            document.querySelector('a').onclick=(event)=>{
              event.preventDefault();history.pushState({},'', '/voyage');
              document.querySelector('main').innerHTML='<h1>Current Voyage</h1>';
            };
          };
        };
      </script></body></html>`);
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage();
      const session = await context.newCDPSession(page);
      await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await page.goto(`http://127.0.0.1:${server.address().port}/voyage`);
      const observed = await runExperienceJourney({
        page,
        root,
        artifactRoot: root,
        device: "DESKTOP",
        contract: { id: "viewport-bound", experience: {} },
        journey: {
          id: "capture-preserves-context",
          steps: [
            { action: "click", role: "button", name: "Begin setup" },
            {
              action: "assert",
              kind: "outcome",
              role: "heading",
              name: "Independent check required",
              path: "/check",
              state: "CHECK_READY",
            },
            { action: "click", role: "button", name: "Check new target" },
            {
              action: "assert",
              kind: "outcome",
              role: "heading",
              name: "Check complete",
              path: "/checked",
              state: "CHECKED",
            },
            { action: "click", role: "link", name: "Return to Voyage" },
            {
              action: "assert",
              role: "heading",
              name: "Current Voyage",
              path: "/voyage",
              returnPath: true,
            },
          ],
        },
      });
      assert.equal(observed.result.status, "PASS");
      assert.equal(observed.result.returnPathVerified, true);
      assert.deepEqual(await page.evaluate(() => window.geometryChanges), []);
      assert.equal(observed.captures.length, 2);
      for (const capture of observed.captures) {
        const png = await readFile(path.join(root, capture.path));
        assert.equal(png.readUInt32BE(16), 1440);
        assert.equal(png.readUInt32BE(20), 900);
      }
      // Positive control: a genuine resize must still destroy the prepared context.
      await page.reload();
      await page.getByRole("button", { name: "Begin setup", exact: true }).click();
      await page
        .getByRole("heading", {
          name: "Independent check required",
          exact: true,
        })
        .waitFor();
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.getByRole("heading", { name: "Setup invalidated", exact: true }).waitFor();
      assert.equal(await page.getByRole("button", { name: "Check new target", exact: true }).isVisible(), false);
      assert.ok(
        (await page.evaluate(() => window.geometryChanges)).some(([width, height]) => width === 1280 && height === 900),
      );
    } finally {
      await context.close();
      await browser.close();
      await new Promise((resolve) => server.close(resolve));
      await rm(root, { recursive: true, force: true });
    }
  },
);
