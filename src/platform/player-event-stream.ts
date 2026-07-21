/**
 * Runtime limits for the player SSE stream.
 *
 * Kept outside the Next route module: App Router route modules may export only
 * route handlers and documented Next configuration values.
 */
export const PLAYER_EVENT_HEARTBEAT_MS = 15_000;
export const PLAYER_EVENT_HISTORY_PAGE_SIZE = 50;
export const PLAYER_EVENT_DEDUPE_WINDOW_SIZE = 256;
export const PLAYER_EVENT_LIVE_BUFFER_LIMIT = 128;
export const PLAYER_EVENT_STREAM_HIGH_WATER_MARK = 64;
