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
  BRIDGEWATCH_TELEMETRY_TOKEN?: string;
  BRIDGEWATCH_TELEMETRY_STALE_MS: number;
  BRIDGEWATCH_TELEMETRY_MAX_BODY_BYTES: number;
  BRIDGEWATCH_SOUNDING_LINE_PROJECTION_PATH?: string;
  BRIDGEWATCH_DASHBOARD_USERNAME?: string;
  BRIDGEWATCH_DASHBOARD_PASSWORD?: string;
}

const integer = (value: string | undefined, fallback: number) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error("Invalid positive integer Bridgewatch configuration");
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
    BRIDGEWATCH_REQUEST_TIMEOUT_MS: integer(input.BRIDGEWATCH_REQUEST_TIMEOUT_MS, 8000),
    BRIDGEWATCH_TELEMETRY_TOKEN: input.BRIDGEWATCH_TELEMETRY_TOKEN,
    BRIDGEWATCH_TELEMETRY_STALE_MS: integer(input.BRIDGEWATCH_TELEMETRY_STALE_MS, 90_000),
    BRIDGEWATCH_TELEMETRY_MAX_BODY_BYTES: integer(input.BRIDGEWATCH_TELEMETRY_MAX_BODY_BYTES, 4096),
    BRIDGEWATCH_SOUNDING_LINE_PROJECTION_PATH: input.BRIDGEWATCH_SOUNDING_LINE_PROJECTION_PATH,
    BRIDGEWATCH_DASHBOARD_USERNAME: dashboardUsername,
    BRIDGEWATCH_DASHBOARD_PASSWORD: dashboardPassword,
  };
}
