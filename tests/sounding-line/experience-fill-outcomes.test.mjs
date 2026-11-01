import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { chromium } from "playwright";
import { runExperienceJourney } from "../../scripts/sounding-line/experience-browser.mjs";

test(
  "rendered typing outcomes preserve navigation causes and reject no-op action groups",
  { timeout: 120000 },
  async (t) => {
    const root = await mkdtemp(path.join(tmpdir(), "experience-fill-outcomes-"));
    const server = createServer((_request, response) => {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Owned form fixture</title>
      <style>body{font:18px system-ui;margin:20px}a,input{display:block;margin:12px;padding:8px}</style>
      </head><body><main>
      <section id="studio"><h1>Voyagewright Studio</h1><a href="/studio/tales/new" id="create">Create Chronicle</a></section>
      <section id="form" hidden><h1>Create Chronicle</h1>
      <label>Title<input id="title"></label><label>Description<input id="description"></label>
      <p id="draft" hidden>Unsaved changes</p><a href="#" id="keep">Keep form</a>
      <a href="/studio/library" id="back">← Back to Studio</a></section>
      <section id="personal" hidden><h1>Personal Information</h1><label>Display name<input id="display"></label>
      <p id="personal-draft" hidden>Unsaved changes</p><a href="/" id="home-link">Return to Home</a></section>
      <section id="home" hidden><h1>Home</h1></section>
      </main><script>
      const byId=id=>document.getElementById(id);
      const mode=new URL(location.href).searchParams.get('mode');
      const show=(section,pathname)=>{for(const id of ['studio','form','personal','home'])byId(id).hidden=id!==section;history.pushState({},'',pathname);};
      if(location.pathname==='/account/personal-information')show('personal',location.pathname);
      if(mode==='already-form'){show('form','/studio/tales/new');byId('create').hidden=false;byId('studio').hidden=false;}
      if(mode==='already-feedback')byId('personal-draft').hidden=false;
      byId('create').onclick=event=>{event.preventDefault();if(mode!=='already-form')show('form','/studio/tales/new');};
      byId('keep').onclick=event=>event.preventDefault();
      for(const id of ['title','description'])byId(id).oninput=()=>{byId('draft').hidden=false;};
      byId('display').oninput=()=>{if(mode!=='missing-feedback')byId('personal-draft').hidden=false;};
      byId('back').onclick=event=>{event.preventDefault();window.returnedDraft={title:byId('title').value,description:byId('description').value};show('studio','/studio/library');};
      byId('home-link').onclick=event=>{event.preventDefault();window.returnedDraft={display:byId('display').value};show('home','/');};
      </script></body></html>`);
    });
    let browser;
    t.after(async () => {
      try {
        await browser?.close();
      } finally {
        server.closeAllConnections();
        if (server.listening) await new Promise((resolve) => server.close(resolve));
      }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    browser = await chromium.launch({ headless: true });
    const base = `http://127.0.0.1:${server.address().port}`;
    const navigation = {
      id: "workspace-creation-draft-return",
      outcome: "Open the creation form, retain an unsaved draft and return to Studio.",
      steps: [
        { action: "click", role: "link", name: "Create Chronicle" },
        { action: "fill", role: "textbox", name: "Title", value: "Unsaved compatibility draft" },
        { action: "fill", role: "textbox", name: "Description", value: "A second local field" },
        {
          action: "assert",
          kind: "outcome",
          role: "heading",
          name: "Create Chronicle",
          text: "Create Chronicle",
          path: "/studio/tales/new",
          meaning: "The creation task accepts a local draft without publishing it.",
          state: "CREATION_FORM_READABLE",
        },
        { action: "click", role: "link", name: "← Back to Studio" },
        { action: "assert", role: "heading", name: "Voyagewright Studio", path: "/studio/library", returnPath: true },
      ],
    };
    const typing = {
      id: "motion-draft-feedback-and-home-return",
      outcome: "Typing produces visible unsaved feedback and retains the natural Home return.",
      steps: [
        { action: "assert", role: "heading", name: "Personal Information" },
        { action: "fill", role: "textbox", name: "Display name", value: "Unsaved motion compatibility draft" },
        {
          action: "assert",
          kind: "outcome",
          role: "main",
          name: "",
          text: "Unsaved changes",
          path: "/account/personal-information",
          meaning: "The actual local form announces its unsaved state without claiming saved account data.",
          state: "DRAFT_FEEDBACK_VISIBLE",
        },
        { action: "click", role: "link", name: "Return to Home" },
        { action: "assert", role: "main", name: "", path: "/", returnPath: true },
      ],
    };
    const run = async (journey, entry, device = "DESKTOP", motionMode = "REDUCED") => {
      const context = await browser.newContext({
        viewport: device === "MOBILE" ? { width: 390, height: 844 } : { width: 1440, height: 900 },
        reducedMotion: motionMode === "REDUCED" ? "reduce" : "no-preference",
      });
      try {
        const page = await context.newPage();
        page.setDefaultTimeout(3000);
        await page.goto(base + entry);
        const artifactRoot = path.join(root, `${device}-${motionMode}-${journey.id}`);
        await mkdir(artifactRoot, { recursive: true });
        const result = await runExperienceJourney({
          page,
          root,
          artifactRoot,
          device,
          motionMode,
          contract: { id: "fixture-fill-outcomes", experience: { entryPoint: entry } },
          journey,
        });
        return { result, draft: await page.evaluate(() => window.returnedDraft) };
      } finally {
        await context.close();
      }
    };
    for (const device of ["DESKTOP", "MOBILE"]) {
      for (const motionMode of ["NORMAL", "REDUCED"]) {
        await t.test(`navigation and consecutive fills ${device} ${motionMode}`, async () => {
          const observed = await run(navigation, "/studio/library", device, motionMode);
          assert.equal(observed.result.result.status, "PASS");
          assert.equal(observed.result.result.returnPathVerified, true);
          assert.equal(observed.result.captures.length, 1);
          assert.deepEqual(observed.draft, {
            title: "Unsaved compatibility draft",
            description: "A second local field",
          });
        });
        await t.test(`fill-only feedback ${device} ${motionMode}`, async () => {
          const observed = await run(typing, "/account/personal-information", device, motionMode);
          assert.equal(observed.result.result.status, "PASS");
          assert.equal(observed.result.result.returnPathVerified, true);
          assert.equal(observed.result.captures.length, 1);
          assert.deepEqual(observed.draft, { display: "Unsaved motion compatibility draft" });
        });
      }
    }
    await t.test("pre-existing navigation outcome remains rejected through fills", async () => {
      await assert.rejects(
        () => run(navigation, "/studio/library?mode=already-form"),
        /ACTION_OUTCOME_NOT_OBSERVED.*before-true:after-true/u,
      );
    });
    await t.test("pre-existing typing feedback remains rejected", async () => {
      await assert.rejects(
        () => run(typing, "/account/personal-information?mode=already-feedback"),
        /ACTION_OUTCOME_NOT_OBSERVED.*before-true:after-true/u,
      );
    });
    await t.test("a later click starts its own causal group", async () => {
      const changed = structuredClone(navigation);
      changed.steps.splice(3, 0, { action: "click", role: "link", name: "Keep form" });
      await assert.rejects(
        () => run(changed, "/studio/library"),
        /ACTION_OUTCOME_NOT_OBSERVED.*before-true:after-true/u,
      );
    });
    await t.test("typing without promised feedback remains rejected", async () => {
      await assert.rejects(
        () => run(typing, "/account/personal-information?mode=missing-feedback"),
        /ACTION_OUTCOME_NOT_OBSERVED.*after-false/u,
      );
    });
  },
);
