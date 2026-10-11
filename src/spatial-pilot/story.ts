import { getBlockDefinition } from "@/chronicle/block-registry";
import type { StudioDraftInput } from "@/chronicle/types";
import { landfallFixture, virtualCoordinate } from "@/landfall/fixtures";
import { validateLandfallDefinition } from "@/landfall/definition";

export const PILOT_SLUG = "lost-navigators-chart-pilot";
export const PILOT_TITLE = "The Lost Navigator’s Chart";
export const PILOT_EDITION = "spatial-chronicle-pilot-v1";
function registeredDefaults(blockType: string) {
  const values = { ...getBlockDefinition(blockType)!.defaultConfiguration };
  delete values.completionMode;
  return values;
}

export function pilotLandfall(taleId: string) {
  const source = structuredClone(landfallFixture);
  const world = source.worldspaces[1];
  world.name = "The Lantern Isles";
  const map = source.maps[1];
  map.name = "Morrow’s unfinished chart";
  map.renderer = "VECTOR_2D";
  map.source = { type: "AUTHORED_VECTOR" };
  const original = source.waypoints[1];
  const places = [
    { id: "pilot-landing", name: "Lantern Quay", x: 0.18, y: 0.75, hidden: false },
    { id: "pilot-desk", name: "The Navigator’s Loft", x: 0.43, y: 0.52, hidden: false },
    { id: "pilot-light", name: "The Unlit Lighthouse", x: 0.65, y: 0.24, hidden: false },
    { id: "pilot-haven", name: "Haven of the Returning Tide", x: 0.83, y: 0.36, hidden: true },
  ];
  return validateLandfallDefinition({
    ...source,
    taleId,
    worldspaces: [world],
    maps: [map],
    transitions: [],
    waypoints: places.map((place) => ({
      ...original,
      id: place.id,
      name: place.name,
      type: place.hidden ? "HIDDEN_WAYPOINT" : "ARRIVAL_POINT",
      geometry: { type: "POINT_RADIUS", center: virtualCoordinate(place.x, place.y), radius: 0.06 },
      visibility: { hiddenUntilRevealed: place.hidden, publicLabel: place.hidden ? undefined : place.name },
      sequence: { afterWaypointIds: [], optional: false },
    })),
    routes: [
      {
        ...source.routes[1],
        id: "pilot-course",
        name: "The returning tide",
        model: "FLEXIBLE",
        waypointIds: ["pilot-desk", "pilot-light", "pilot-landing"],
        geometry: {
          type: "ROUTE_LINE",
          points: places.filter((p) => !p.hidden).map((p) => virtualCoordinate(p.x, p.y)),
        },
      },
    ],
  });
}

export function pilotChapters(taleId: string): StudioDraftInput["chapters"] {
  const beats = [
    [
      "invitation",
      "narrative",
      "The Navigator’s Invitation",
      "A bottle beneath the harbor bell",
      "The harbor bell has been silent for thirty years. Tonight it rings once. Beneath it you find a salt-clouded bottle and a letter signed by Iona Morrow, the navigator who sailed beyond the last marked island.\n\n‘My chart was never a route to treasure. It was a promise to bring the lost home. If the bell rings, someone still needs the way.’\n\nThe ink ends at a compass rose. Unfold Morrow’s chart and follow the three remaining marks.",
    ],
    [
      "chart",
      "livingChart",
      "Open the Living Chart",
      "Three marks on an unfinished sea",
      "Lantern Quay, the Navigator’s Loft, and the Unlit Lighthouse remain on the chart. Explore their marks and trace the returning tide. The fourth harbor has been rubbed away. Your first objective is the loft, where Morrow kept her last message.",
    ],
    [
      "lens",
      "narrative",
      "Prepare the Chronicle Lens",
      "The desk that waited",
      "The loft is empty, but Morrow’s parchment still rests beside a brass compass. Open the Chronicle Lens below. Inspect the parchment and read the message in its authored scene. Guided View carries the same clue when a camera or spatial provider is unavailable.",
    ],
    [
      "message",
      "narrative",
      "A Message in Space",
      "A light for the returning tide",
      "The parchment reads: ‘The northern light is not a warning. It is a welcome. Carry my chart to the lighthouse; face the compass rose, and remember the harbor that was erased.’\n\nMorrow did not vanish chasing gold. She stayed beyond the reef to guide stranded ships. Take her chart onward.",
    ],
    [
      "pair",
      "livingChart",
      "The Second Device",
      "A companion at the helm",
      "A chart is easier to carry than a desk. If you have a phone, open Voyage devices from the navigator’s ribbon, connect this screen, and pair the phone with the same navigator account. You can sail on this screen when a second device is unavailable.",
    ],
    [
      "pass",
      "livingChart",
      "Pass the Chart",
      "Carry the course to the lighthouse",
      "Open the chart, then close its drawer and use Send to… to choose your phone and Control there. On the phone choose Receive; the chart passes only when it opens there. Explore the same course on the companion. Prefer one screen? Keep the chart here and continue.",
    ],
    [
      "bearing",
      "narrative",
      "Read the Compass",
      "The northern light",
      "At the lighthouse, a brass inscription says: ‘Face north; the returning tide lies beyond the empty mark.’ Open Morrow’s compass from the navigator’s ribbon. If this device can provide a trustworthy heading, turn toward north. Otherwise read the compass rose on screen. Both reveal the same bearing; the compass never advances your story for you.",
    ],
    [
      "recovery",
      "livingChart",
      "Weather the Separation",
      "A chart survives the storm",
      "A squall divides the two horizons. Your journey is safe in the Journal. For an optional recovery trial, leave the phone’s Journal, wait for its device to appear disconnected, then choose Recover view here on the other screen. Reopen the phone’s Journal to rejoin. You can also simply continue sailing.",
    ],
    [
      "reveal",
      "locationReveal",
      "Recover the Navigator’s Secret",
      "The erased harbor returns",
      "Follow the northern light. The rubbed-away mark returns: Haven of the Returning Tide. Morrow’s secret was a refuge, not a fortune. Every lamp in the harbor is lit for a ship that once believed it would never return.",
    ],
    [
      "ending",
      "taleComplete",
      "The Promise Kept",
      "A light left burning",
      "You hang Morrow’s chart beside the harbor bell. Its final line appears as the tide turns: ‘No one is lost while someone keeps a light.’\n\nBeyond the reef, a sail answers the lighthouse. The bell rings twice. The navigator’s promise is yours now.\n\nYour completed Journal preserves this edition of the voyage. Return whenever you wish; the light will still be burning.",
    ],
  ];
  return [
    {
      id: `${taleId}:chapter`,
      title: "The Returning Tide",
      subtitle: "A promise beyond the last marked island",
      blocks: beats.map(([key, blockType, title, heading, body], index) => ({
        id: `${taleId}:${key}`,
        blockType,
        title,
        isEnabled: true,
        configuration: {
          ...registeredDefaults(blockType),
          ...(blockType === "taleComplete" ? { finaleHeading: heading, finaleContent: body } : { heading, body }),
          ...(["livingChart", "locationReveal"].includes(blockType) ? { worldspaceId: "isles" } : {}),
          ...(blockType === "locationReveal" ? { targetType: "WAYPOINT", targetId: "pilot-haven" } : {}),
        },
        presentation: { transitionIn: "fade", transitionOut: "fade" },
        completion: { mode: "playerConfirmation" },
        connections:
          index < beats.length - 1
            ? [{ targetBlockId: `${taleId}:${beats[index + 1][0]}`, connectionType: "DEFAULT" }]
            : [],
      })),
    },
  ];
}
