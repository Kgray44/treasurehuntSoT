import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { chromium } from "playwright";
import { EXPERIENCE_VIEWPORTS, runExperienceJourney } from "../../scripts/sounding-line/experience-browser.mjs";

// A native-select representation probe, not SC02 or actual product acceptance.
test(
  "accepted semantic click and keyboard select native Source in all four viewport/motion contexts",
  { timeout: 45000 },
  async () => {
    const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Synthetic Source</title>
    <label>Source<select aria-label="Source"><option value="ALL">All sources</option><option value="BUILT_IN">Built-in</option><option value="MY_CREATIONS">My creations</option><option value="FAVORITES">Favorites</option><option value="RECENTLY_USED">Recently used</option></select></label>
    <section aria-label="Asset results"><button>Shared composition</button><button>Shared composition</button><button>Built-in only asset</button></section>
    <a href="/library">Return to library</a><script>
    document.querySelector('select').onchange=(event)=>{
      const personal=event.target.value==='MY_CREATIONS';
      document.querySelector('section').innerHTML=personal?'<button>Shared composition</button>':'<button>Shared composition</button><button>Shared composition</button><button>Built-in only asset</button>';
      document.querySelector('a').href='/library?source='+event.target.value;
    };</script></html>`;
    const server = createServer((request, response) => {
      response.writeHead(200, { "Content-Type": "text/html" });
      response.end(
        request.url.startsWith("/library")
          ? '<!doctype html><html lang="en"><title>Library</title><h1>Library home</h1></html>'
          : html,
      );
    });
    let browser;
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const baseURL = `http://127.0.0.1:${server.address().port}`;
    try {
      browser = await chromium.launch({ headless: true });
      for (const device of ["DESKTOP", "MOBILE"])
        for (const motionMode of ["NORMAL", "REDUCED"]) {
          const context = await browser.newContext({
            baseURL,
            viewport: EXPERIENCE_VIEWPORTS[device],
            reducedMotion: motionMode === "REDUCED" ? "reduce" : "no-preference",
          });
          try {
            const page = await context.newPage();
            page.setDefaultTimeout(5000);
            await page.goto("/studio");
            const observed = await runExperienceJourney({
              page,
              contract: { id: "synthetic-native-source", experience: { entryPoint: "/studio" } },
              journey: {
                id: "native-source",
                outcome: "Choose personal Source through public keyboard controls and return",
                steps: [
                  { action: "click", role: "combobox", name: "Source" },
                  { action: "keyboard", key: "m", expectFocus: { role: "combobox", name: "Source" } },
                  { action: "keyboard", key: "Enter", expectFocus: { role: "combobox", name: "Source" } },
                  {
                    action: "assert",
                    kind: "outcome",
                    role: "region",
                    name: "Asset results",
                    text: "Shared composition",
                    absentRole: { role: "button", name: "Built-in only asset" },
                    path: "/studio",
                    meaning: "Personal Source removes built-in aliases while retaining the saved composition",
                  },
                  { action: "click", role: "link", name: "Return to library" },
                  { action: "assert", role: "heading", name: "Library home", path: "/library", returnPath: true },
                ],
              },
              device,
              motionMode,
              artifactRoot: process.cwd(),
              root: process.cwd(),
            });
            assert.equal(observed.result.status, "PASS");
            assert.equal(observed.result.returnPathVerified, true);
            assert.equal(new URL(page.url()).searchParams.get("source"), "MY_CREATIONS");
            assert.equal(observed.result.accessibility.motionPreferenceVerified, true);
            assert.deepEqual(observed.captures, []);
          } finally {
            await context.close();
          }
        }
    } finally {
      if (browser) await browser.close();
      await new Promise((resolve) => server.close(resolve));
    }
  },
);
