import { describe, expect, it } from "vitest";
import {
  PLAYER_EVENT_DEDUPE_WINDOW_SIZE,
  PLAYER_EVENT_HEARTBEAT_MS,
  PLAYER_EVENT_HISTORY_PAGE_SIZE,
  PLAYER_EVENT_LIVE_BUFFER_LIMIT,
  PLAYER_EVENT_STREAM_HIGH_WATER_MARK,
} from "./player-event-stream";

describe("player event stream limits", () => {
  it("uses positive bounded operational limits", () => {
    for (const limit of [
      PLAYER_EVENT_HEARTBEAT_MS,
      PLAYER_EVENT_HISTORY_PAGE_SIZE,
      PLAYER_EVENT_DEDUPE_WINDOW_SIZE,
      PLAYER_EVENT_LIVE_BUFFER_LIMIT,
      PLAYER_EVENT_STREAM_HIGH_WATER_MARK,
    ]) {
      expect(Number.isSafeInteger(limit)).toBe(true);
      expect(limit).toBeGreaterThan(0);
    }
    expect(PLAYER_EVENT_STREAM_HIGH_WATER_MARK).toBeLessThanOrEqual(PLAYER_EVENT_LIVE_BUFFER_LIMIT);
  });
});
