import { landfallFixture } from "@/landfall/fixtures";

/** Published synthetic policy, shared by the native client and real authority.
 * Restart acceptance deliberately uses a ten-minute authored evidence window;
 * unrelated/stale-evidence cases retain the original thirty-second policy.
 * No observation timestamp, current clock or product default is changed. */
export function deviceLabFixtureForScenario(scenarioId: string) {
  const definition = structuredClone(landfallFixture);
  if (scenarioId === "offline-restart-canonical-reconcile") {
    const physicalIds = new Set(
      definition.worldspaces.filter((world) => world.kind === "PHYSICAL").map((world) => world.id),
    );
    for (const waypoint of definition.waypoints)
      if (physicalIds.has(waypoint.worldspaceId)) waypoint.evidenceProfile.maximumAgeSeconds = 600;
  }
  return definition;
}
