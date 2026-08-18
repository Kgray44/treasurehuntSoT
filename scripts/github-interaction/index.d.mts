export interface CredentialPool {
  id: string;
  kind: string;
  repository: string;
  principalFingerprint: string;
}

export function redact(value: unknown): string;
export function fingerprint(value: unknown): string;
export function credentialPoolId(value: {
  kind: string;
  repository: string;
  principalFingerprint: string;
  installationId?: string | number | null;
}): string;
export function rateMode(
  record: { limit?: number | null; remaining?: number | null; resetAt?: string | null } | null,
  thresholds?: { conservation?: number; critical?: number },
): "NORMAL" | "CONSERVATION" | "CRITICAL" | "EXHAUSTED" | "UNKNOWN";
export function nextPollInterval(options: {
  mode?: "NORMAL" | "CONSERVATION" | "CRITICAL" | "EXHAUSTED" | "UNKNOWN";
  minimumMs?: number;
  serverPollIntervalMs?: number;
  retryAfterMs?: number;
  resetAt?: string | null;
}): number;
export function jitteredPollInterval(intervalMs: number, jitterRatio?: number, random?: () => number): number;
export function retryAfterRemainingMs(record: { retryAfterUntil?: string | null } | null, now?: number): number;
export function isRateObservationStale(
  record: { observedAt?: string | null; resetAt?: string | null } | null,
  now?: number,
  maximumAgeMs?: number,
): boolean;
export function secondaryBackoffMs(options?: {
  previous?: { secondaryFailureCount?: number | null } | null;
  retryAfterMs?: number;
}): number;
export function isTerminalWatchState(state: unknown): boolean;
export function shouldReportWatchState(previous: unknown, current: unknown): boolean;

export class SharedRuntimeState {
  constructor(repository: string, directory?: string);
  readonly directory: string;
  load(): Promise<unknown>;
  status(): Promise<unknown>;
}

export class SharedCache {
  constructor(runtime: SharedRuntimeState);
  key(scope: unknown): string;
  file(scope: unknown): string;
  get(scope: unknown, freshness?: "IMMUTABLE" | "LONG" | "MEDIUM" | "SHORT" | "LIVE"): Promise<unknown>;
  put(scope: unknown, entry: unknown): Promise<unknown>;
}

export function withFileLock<T>(
  directory: string,
  name: string,
  work: () => Promise<T>,
  options?: { waitMs?: number; staleMs?: number },
): Promise<T>;

export class GitHubInteractionClient {
  constructor(options: {
    repository: string;
    apiBase?: string;
    pool: CredentialPool;
    runtime?: SharedRuntimeState;
    tokenProvider?: (() => Promise<string | null>) | null;
    fetchImpl?: typeof fetch;
    requestTimeoutMs?: number;
    thresholds?: { conservation?: number; critical?: number };
  });
  request<T = unknown>(options: {
    method?: string;
    path: string;
    body?: unknown;
    freshness?: "IMMUTABLE" | "LONG" | "MEDIUM" | "SHORT" | "LIVE";
    mutation?: boolean;
    cacheKey?: unknown;
  }): Promise<{ body: T; cached: boolean; deferred?: boolean; notModified?: boolean; headers: Record<string, string> }>;
  graphql<T = unknown>(
    query: string,
    variables?: unknown,
    options?: Record<string, unknown>,
  ): Promise<{ body: T; cached: boolean; headers: Record<string, string> }>;
}

export class GitTransport {
  constructor(root?: string, runtime?: SharedRuntimeState | null);
  ref(ref?: string): Promise<string>;
  remoteRef(remote?: string, ref?: string): Promise<string>;
  ancestry(ancestor: string, descendant: string): Promise<boolean>;
  tree(ref: string): Promise<string>;
  changed(base: string, head: string): Promise<string[]>;
}

export class GitHubAppAuth {
  constructor(options: {
    appId?: string;
    installationId?: string;
    privateKeyPath?: string;
    apiBase?: string;
    repository: string;
  });
  configured(): boolean;
  token(fetchImpl?: typeof fetch): Promise<{ token: string; expiresAt: string; permissions: Record<string, string> }>;
  validateInstallation(fetchImpl?: typeof fetch): Promise<{
    configured: boolean;
    active: boolean;
    repositoryInstalled: boolean;
    permissions: Record<string, string>;
    missingPermissions: string[];
    error: string | null;
  }>;
  health(): { configured: boolean; active: boolean; installationId: string | null; tokenExpiresAt: string | null };
}

export function requestReadWithFallback<T = unknown>(options: {
  primary: GitHubInteractionClient;
  alternatives?: GitHubInteractionClient[];
  request: Parameters<GitHubInteractionClient["request"]>[0];
}): Promise<{ body: T; cached: boolean; headers: Record<string, string>; fallbackPoolId: string | null }>;

export function appCredentialPool(app: GitHubAppAuth, repository: string): CredentialPool;
