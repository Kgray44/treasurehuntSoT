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
  return {
    BRIDGEWATCH_HOST: input.BRIDGEWATCH_HOST ?? "127.0.0.1",
    BRIDGEWATCH_PORT: integer(input.BRIDGEWATCH_PORT, 4318),
    BRIDGEWATCH_REPOSITORY: repository,
    BRIDGEWATCH_DEFAULT_BRANCH: input.BRIDGEWATCH_DEFAULT_BRANCH ?? "main",
    BRIDGEWATCH_DB_PATH: path,
    dbPath: resolve(path),
    BRIDGEWATCH_GITHUB_API: api,
    BRIDGEWATCH_GITHUB_TOKEN: input.BRIDGEWATCH_GITHUB_TOKEN,
    BRIDGEWATCH_REQUEST_TIMEOUT_MS: integer(input.BRIDGEWATCH_REQUEST_TIMEOUT_MS, 8000),
  };
}
