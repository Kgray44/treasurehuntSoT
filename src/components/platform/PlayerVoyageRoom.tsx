"use client";
import { MusterRoom } from "@/components/muster/MusterRoom";
export function PlayerVoyageRoom({
  playthroughId,
  onRouteHandoff,
}: {
  playthroughId: string;
  onRouteHandoff?: (destination: string) => void | Promise<void>;
}) {
  return <MusterRoom voyageId={playthroughId} playerRoute onRouteHandoff={onRouteHandoff} />;
}
