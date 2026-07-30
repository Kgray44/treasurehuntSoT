import { readFileSync } from "node:fs";
import path from "node:path";
import { resolveLegacyCampaign } from "../../src/compatibility/legacy-companion";
import { db } from "../../src/lib/db";
import { expect, openPhase3Player, phase3Test, type Phase3EventType } from "./fixtures/lanternwake-phase3";

const groups = [
  { id: "A", name: "chapter and block progression", eventType: "CHAPTER_RELEASED", action: "presentation" },
  { id: "B", name: "hints and readable information", eventType: "JOURNAL_ANNOTATION_ADDED", action: "releaseHint" },
  { id: "C", name: "artifact and collection progression", eventType: "ARTIFACT_AWARDED", action: "presentation" },
  { id: "D", name: "map and route progression", eventType: "MAP_LOCATION_REVEALED", action: "presentation" },
  { id: "E", name: "objective and quest progression", eventType: "SIDE_QUEST_UPDATED", action: "presentation" },
  { id: "F", name: "finale progression", eventType: "FINALE_TEASED", action: "presentation" },
  { id: "G", name: "session control", eventType: "CAMPAIGN_PAUSED", action: "pause" },
] as const satisfies readonly {
  id: string;
  name: string;
  eventType: Phase3EventType;
  action: "pause" | "presentation" | "releaseHint";
}[];

function mappingPath() {
  return path.join(
    process.cwd(),
    "Development_Docs",
    "Programs",
    "Lanternwake",
    "Project_Lanternwake_Canonical_Event_Matrix_Mapping.csv",
  );
}

function readMappingRows() {
  const [header, ...rows] = readFileSync(mappingPath(), "utf8").trim().split(/\r?\n/u);
  expect(header).toContain("legacy case ID");
  expect(rows).toHaveLength(102);
  const ids = rows.map((row) => row.split(",", 1)[0]);
  expect(new Set(ids).size).toBe(102);
  expect(ids).toEqual(Array.from({ length: 102 }, (_, index) => `P3-CASE-${String(index + 1).padStart(3, "0")}`));
  for (const row of rows) {
    expect(row).not.toMatch(/,(unknown|deferred|planned|future|blocked|unmapped),/iu);
  }
}

phase3Test.describe("Lanternwake canonical event matrix", () => {
  phase3Test.skip(
    ({ browserName }) => browserName !== "chromium",
    "The canonical event matrix uses its declared Chromium progression project.",
  );

  phase3Test("legacy matrix mapping is complete and production journal has no retired receipt dependency", async () => {
    readMappingRows();
    const canonicalSources = [
      "src/components/player/journal/ChronicleJournalSession.tsx",
      "src/app/player/playthroughs/[playthroughId]/journal/page.tsx",
      "src/app/api/play/sessions/[sessionId]/events/route.ts",
    ];
    for (const source of canonicalSources) {
      const text = readFileSync(path.join(process.cwd(), source), "utf8");
      expect(text).not.toContain("forever:progression-receipt");
      expect(text).not.toContain("PlayerExperience");
    }
  });

  for (const group of groups) {
    phase3Test(`canonical Group ${group.id}: ${group.name}`, async ({ page, phase3 }) => {
      phase3Test.setTimeout(45_000);
      await phase3.proveIsolation();
      const fixture = await phase3.createCase(`canonical-group-${group.id}`, group.eventType);
      await openPhase3Player(page, fixture, "journal");
      const resolved = await resolveLegacyCampaign(fixture.slug);
      expect(resolved, "The migrated fixture must resolve to a canonical TaleSession.").toBeTruthy();
      const action = await phase3.canonicalCaptainAction(fixture, group.action);
      const session = await db.taleSession.findUniqueOrThrow({
        where: { id: resolved!.sessionId },
        select: { id: true, currentSequence: true, status: true, events: { orderBy: { sequence: "asc" } } },
      });
      expect(session.id).toBe(action.sessionId);
      expect(session.status).toBe(group.action === "pause" ? "PAUSED" : "ACTIVE");
      expect(session.events.length).toBeGreaterThan(0);
      expect(session.events.at(-1)).toMatchObject({ eventType: action.eventType });
      await expect(page.locator(".chronicle-journal-shell")).toBeVisible();
      const heading = page.locator(".chronicle-journal-shell").getByRole("heading", { level: 2 });
      await heading.focus();
      await expect(heading).toBeFocused();
      await expect(page.locator("[data-testid='progression-scene-host']")).toHaveCount(0);
      // A static fallback has no source clone; when PageFlip creates one it
      // must stay inert. The dedicated accessibility family proves the clone
      // tree itself, while this canonical matrix accepts either governed mode.
      const sourceClones = page.locator("[data-pageflip-source]");
      for (let index = 0; index < (await sourceClones.count()); index += 1) {
        await expect(sourceClones.nth(index)).toHaveAttribute("inert", "");
      }
    });
  }
});
