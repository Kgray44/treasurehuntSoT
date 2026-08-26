import { resolve } from "node:path";

export interface Config {
  BRIDGEWATCH_HOST: string;
  BRIDGEWATCH_PORT: number;
  BRIDGEWATCH_REPOSITORY: string;
  BRIDGEWATCH_DEFAULT_BRANCH: string;
  BRIDGEWATCH_DB_PATH: string;
  dbPath: string;
  BRIDGEWATCH_GITHUB_API: string;
  BRIDGEWATCH_GITHUB_TOKEN?: string;
  BRIDGEWATCH_REQUEST_TIMEOUT_MS: number;
  BRIDGEWATCH_SNAPSHOT_INTERVAL_MS: number;
  BRIDGEWATCH_SOUNDING_LINE_POLL_INTERVAL_MS: number;
  BRIDGEWATCH_EVENT_RETENTION_DAYS: number;
  BRIDGEWATCH_ROLLUP_RETENTION_DAYS: number;
  BRIDGEWATCH_HISTORY_PAGE_SIZE: number;
  BRIDGEWATCH_HISTORY_MAX_RANGE_HOURS: number;
  BRIDGEWATCH_BRANCH_STALE_MS: number;
  BRIDGEWATCH_REVIEW_BRANCH_STALE_MS: number;
  BRIDGEWATCH_BRANCH_BEHIND_THRESHOLD: number;
  BRIDGEWATCH_GITHUB_MAX_BRANCHES: number;
  BRIDGEWATCH_TELEMETRY_TOKEN?: string;
  BRIDGEWATCH_TELEMETRY_STALE_MS: number;
  BRIDGEWATCH_TELEMETRY_MAX_BODY_BYTES: number;
  BRIDGEWATCH_SOUNDING_LINE_PROJECTION_PATH?: string;
  BRIDGEWATCH_NIGHTWATCH_DB_PATH: string;
  BRIDGEWATCH_NIGHTWATCH_REPOSITORY_ROOT: string;
  BRIDGEWATCH_DASHBOARD_USERNAME?: string;
  BRIDGEWATCH_DASHBOARD_PASSWORD?: string;
}

const integer = (value: string | undefined, fallback: number) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error("Invalid positive integer Bridgewatch configuration");
  return parsed;
};

const boundedInteger = (value: string | undefined, fallback: number, minimum: number, maximum: number) => {
  const parsed = integer(value, fallback);
  if (parsed < minimum || parsed > maximum) throw new Error("Bridgewatch configuration is outside its governed bounds");
  return parsed;
};

export function loadConfig(input: Record<string, string | undefined> = process.env): Config {
  const repository = input.BRIDGEWATCH_REPOSITORY;
  if (!repository || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository))
    throw new Error("BRIDGEWATCH_REPOSITORY must be owner/repository");
  const api = (input.BRIDGEWATCH_GITHUB_API ?? "https://api.github.com").replace(/\/$/, "");
  let apiUrl: URL;
  try {
    apiUrl = new URL(api);
  } catch {
    throw new Error("BRIDGEWATCH_GITHUB_API must be an HTTPS URL");
  }
  if (apiUrl.protocol !== "https:") throw new Error("BRIDGEWATCH_GITHUB_API must be an HTTPS URL");
  const path = input.BRIDGEWATCH_DB_PATH ?? "./var/bridgewatch.sqlite";
  const host = input.BRIDGEWATCH_HOST ?? "127.0.0.1";
  const dashboardUsername = input.BRIDGEWATCH_DASHBOARD_USERNAME;
  const dashboardPassword = input.BRIDGEWATCH_DASHBOARD_PASSWORD;
  const isLoopback = ["127.0.0.1", "::1", "localhost"].includes(host.toLowerCase());
  if (Boolean(dashboardUsername) !== Boolean(dashboardPassword))
    throw new Error("Bridgewatch dashboard authentication requires both username and password");
  if (!isLoopback && input.BRIDGEWATCH_ALLOW_EXTERNAL !== "true")
    throw new Error("Non-loopback Bridgewatch hosting requires BRIDGEWATCH_ALLOW_EXTERNAL=true");
  if (!isLoopback && (!dashboardUsername || !dashboardPassword))
    throw new Error("Non-loopback Bridgewatch hosting requires dashboard authentication");
  return {
    BRIDGEWATCH_HOST: host,
    BRIDGEWATCH_PORT: integer(input.BRIDGEWATCH_PORT, 4318),
    BRIDGEWATCH_REPOSITORY: repository,
    BRIDGEWATCH_DEFAULT_BRANCH: input.BRIDGEWATCH_DEFAULT_BRANCH ?? "main",
    BRIDGEWATCH_DB_PATH: path,
    dbPath: resolve(path),
    BRIDGEWATCH_GITHUB_API: api,
    BRIDGEWATCH_GITHUB_TOKEN: input.BRIDGEWATCH_GITHUB_TOKEN,
    // Repository metadata can be on an available network share. Thirty seconds
    // remains bounded and avoids reporting a healthy read-only source as down.
    BRIDGEWATCH_REQUEST_TIMEOUT_MS: integer(input.BRIDGEWATCH_REQUEST_TIMEOUT_MS, 30_000),
    BRIDGEWATCH_SNAPSHOT_INTERVAL_MS: boundedInteger(input.BRIDGEWATCH_SNAPSHOT_INTERVAL_MS, 60_000, 10_000, 3_600_000),
    BRIDGEWATCH_SOUNDING_LINE_POLL_INTERVAL_MS: boundedInteger(
      input.BRIDGEWATCH_SOUNDING_LINE_POLL_INTERVAL_MS,
      10_000,
      5_000,
      60_000,
    ),
    BRIDGEWATCH_EVENT_RETENTION_DAYS: boundedInteger(input.BRIDGEWATCH_EVENT_RETENTION_DAYS, 30, 1, 3_650),
    BRIDGEWATCH_ROLLUP_RETENTION_DAYS: boundedInteger(input.BRIDGEWATCH_ROLLUP_RETENTION_DAYS, 90, 1, 3_650),
    BRIDGEWATCH_HISTORY_PAGE_SIZE: boundedInteger(input.BRIDGEWATCH_HISTORY_PAGE_SIZE, 100, 1, 250),
    BRIDGEWATCH_HISTORY_MAX_RANGE_HOURS: boundedInteger(input.BRIDGEWATCH_HISTORY_MAX_RANGE_HOURS, 720, 1, 8_760),
    BRIDGEWATCH_BRANCH_STALE_MS: boundedInteger(input.BRIDGEWATCH_BRANCH_STALE_MS, 604_800_000, 60_000, 31_536_000_000),
    BRIDGEWATCH_REVIEW_BRANCH_STALE_MS: boundedInteger(
      input.BRIDGEWATCH_REVIEW_BRANCH_STALE_MS,
      259_200_000,
      60_000,
      31_536_000_000,
    ),
    BRIDGEWATCH_BRANCH_BEHIND_THRESHOLD: boundedInteger(input.BRIDGEWATCH_BRANCH_BEHIND_THRESHOLD, 5, 1, 10_000),
    BRIDGEWATCH_GITHUB_MAX_BRANCHES: boundedInteger(input.BRIDGEWATCH_GITHUB_MAX_BRANCHES, 30, 1, 100),
    BRIDGEWATCH_TELEMETRY_TOKEN: input.BRIDGEWATCH_TELEMETRY_TOKEN,
    BRIDGEWATCH_TELEMETRY_STALE_MS: integer(input.BRIDGEWATCH_TELEMETRY_STALE_MS, 90_000),
    BRIDGEWATCH_TELEMETRY_MAX_BODY_BYTES: integer(input.BRIDGEWATCH_TELEMETRY_MAX_BODY_BYTES, 4096),
    BRIDGEWATCH_SOUNDING_LINE_PROJECTION_PATH: input.BRIDGEWATCH_SOUNDING_LINE_PROJECTION_PATH,
    BRIDGEWATCH_NIGHTWATCH_DB_PATH: resolve(input.BRIDGEWATCH_NIGHTWATCH_DB_PATH ?? "../.nightwatch/nightwatch.sqlite"),
    BRIDGEWATCH_NIGHTWATCH_REPOSITORY_ROOT: resolve(input.BRIDGEWATCH_NIGHTWATCH_REPOSITORY_ROOT ?? ".."),
    BRIDGEWATCH_DASHBOARD_USERNAME: dashboardUsername,
    BRIDGEWATCH_DASHBOARD_PASSWORD: dashboardPassword,
  };
}
