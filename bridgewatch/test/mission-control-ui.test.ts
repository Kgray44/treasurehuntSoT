import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../public/", import.meta.url));
const html = readFileSync(`${root}index.html`, "utf8");
const app = readFileSync(`${root}app.js`, "utf8");
const css = readFileSync(`${root}style.css`, "utf8");

describe("v1.2 mission-control navigation", () => {
  it("uses named stations and hash deep links instead of a single long-form dashboard", () => {
    expect(html).toContain('aria-label="Mission control stations"');
    for (const station of [
      "Overview",
      "Program",
      "Projects",
      "Operations",
      "GitHub",
      "Attention",
      "History",
      "Sources",
      "Data & Coverage",
    ])
      expect(html).toContain(`>${station}<`);
    expect(app).toContain('window.addEventListener("hashchange", renderRoute)');
    expect(app).toContain("function renderProjectProfile");
    expect(app).toContain("function renderComparison");
    expect(app).toContain("function renderPullRequestProfile");
    expect(app).toContain("function renderSourceProfile");
    expect(app).toContain("Sources & Data Quality");
    expect(app).toContain("function renderDataFabric");
    expect(app).toContain("function renderFactProfile");
    expect(app).toContain("Data fabric & observation coverage");
  });

  it("keeps dense technical detail readable, focusable, and phone-safe", () => {
    expect(css).toContain(".station-nav");
    expect(css).toContain("@media (max-width: 42rem)");
    expect(css).toContain(".table-wrap");
    expect(css).toContain("overflow-wrap: anywhere");
    expect(css).toContain("prefers-reduced-motion");
    expect(css).toContain("focus-visible");
    expect(html).toContain('id="route" class="station" aria-live="polite"');
    expect(app).toContain("Failure classification");
    expect(app).toContain("Serving retained stale data");
    expect(app).toContain("sourceDateText");
  });

  it("offers bounded client-side search or filtering for every requested observation collection", () => {
    expect(app).toContain("function filteredTable");
    expect(app).toContain("Search projects");
    expect(app).toContain("Search versions");
    expect(app).toContain("Search phases");
    expect(app).toContain("Search PRs");
    expect(app).toContain("Search branches");
    expect(app).toContain("Search retained history");
    expect(app).toContain("Search observed facts");
    expect(app).toContain('"Open", "Historical", "All"');
  });
});
