import assert from "node:assert/strict";
import test from "node:test";
import { runExperienceJourney } from "../../scripts/sounding-line/experience-browser.mjs";

test("feedback timing ends before independent continuity inspection", async (t) => {
  let clock = 0;
  let updated = false;
  let continuityReads = 0;
  let pathname = "/scene";
  t.mock.method(performance, "now", () => clock);

  const texts = {
    "Update scene": "Update scene",
    "Updated scene": "Ordinary Room",
    "Return to Studio": "Return to Studio",
    Studio: "Studio",
  };
  const page = {
    url: () => "http://127.0.0.1" + pathname,
    evaluate: async () => false,
    waitForURL: async (matches) => assert.ok(matches(new URL(page.url()))),
    getByRole: (_role, { name }) => {
      const isVisible = () => (name === "Updated scene" ? updated : name === "Studio" ? pathname === "/studio" : true);
      const waitFor = async () => assert.ok(isVisible());
      return {
        isVisible,
        waitFor,
        innerText: async () => texts[name],
        filter: ({ hasText }) => ({
          waitFor: async () => {
            await waitFor();
            assert.ok(texts[name].includes(hasText));
          },
        }),
        evaluate: async () => true,
        press: async (key) => {
          assert.equal(key, "Enter");
          if (name === "Update scene") {
            clock += 600;
            updated = true;
          } else {
            assert.equal(name, "Return to Studio");
            pathname = "/studio";
          }
        },
        getAttribute: async (name) => {
          assert.equal(name, "data-creator");
          continuityReads++;
          clock += 4_000;
          return "same-creator";
        },
      };
    },
  };

  const measurement = "Keyboard activation to visible scene feedback";
  const { result } = await runExperienceJourney({
    page,
    device: "DESKTOP",
    motionMode: "NORMAL",
    contract: {
      id: "fixture-feedback-boundary.experience",
      experience: {
        entryPoint: "/scene",
        motion: { measurement },
        continuity: {
          checks: [{ id: "creator", role: "link", name: "Creator identity", attribute: "data-creator" }],
        },
      },
    },
    journey: {
      id: "update-scene-and-return",
      outcome: "Show the updated scene and return to Studio.",
      steps: [
        { action: "click", role: "button", name: "Update scene" },
        {
          action: "assert",
          kind: "outcome",
          role: "region",
          name: "Updated scene",
          text: "Ordinary Room",
          path: "/scene",
          meaning: "The selected scene is now visible.",
          feedbackBoundary: true,
        },
        { action: "click", role: "link", name: "Return to Studio" },
        { action: "assert", role: "heading", name: "Studio", path: "/studio", returnPath: true },
      ],
    },
  });

  assert.equal(result.feedbackMs, 600);
  assert.equal(result.measurement, measurement);
  assert.equal(result.returnPathVerified, true);
  assert.equal(continuityReads, 3);
  const [continuity] = result.continuity;
  assert.equal(continuity.after, continuity.before);
  assert.deepEqual(continuity.atOutcomes, [continuity.before]);
});
