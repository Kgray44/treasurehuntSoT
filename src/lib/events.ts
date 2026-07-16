import { EventEmitter } from "node:events";
import type { ClientProgressEvent } from "@/domain/story";

const globalEvents = globalThis as unknown as { foreverEvents?: EventEmitter };
export const eventBus = globalEvents.foreverEvents ?? new EventEmitter();
eventBus.setMaxListeners(100);
if (!globalEvents.foreverEvents) globalEvents.foreverEvents = eventBus;

export function publishCampaignEvent(campaignId: string, event: ClientProgressEvent) {
  eventBus.emit(`campaign:${campaignId}`, event);
}
