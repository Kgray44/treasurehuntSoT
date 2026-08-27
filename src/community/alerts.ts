export type CommunityOperationalAlert = Readonly<{
  code: "COMMUNITY_PROVIDER_DEGRADED" | "COMMUNITY_QUEUE_BACKLOG";
  severity: "WARNING" | "CRITICAL";
  observedAt: string;
  providerCount?: number;
  queueDepth?: number;
  deadLetterCount?: number;
}>;

type ProviderStatus = Readonly<{ healthy: boolean }>;
type OperationalStatus = Readonly<{ queueDepth: number; deadLetters: number }>;

/** Builds bounded operator alerts. The payload intentionally excludes URLs,
 * provider errors, identities, event bodies, and configuration values. */
export function communityOperationalAlerts(
  providers: readonly ProviderStatus[],
  operations: OperationalStatus,
  observedAt = new Date().toISOString(),
): CommunityOperationalAlert[] {
  const alerts: CommunityOperationalAlert[] = [];
  const unhealthy = providers.filter((provider) => !provider.healthy).length;
  if (unhealthy)
    alerts.push({
      code: "COMMUNITY_PROVIDER_DEGRADED",
      severity: "WARNING",
      observedAt,
      providerCount: unhealthy,
    });
  if (operations.deadLetters || operations.queueDepth >= 100)
    alerts.push({
      code: "COMMUNITY_QUEUE_BACKLOG",
      severity: operations.deadLetters ? "CRITICAL" : "WARNING",
      observedAt,
      queueDepth: operations.queueDepth,
      deadLetterCount: operations.deadLetters,
    });
  return alerts;
}

/** The initial delivery adapter is a sanitized local structured log. It is
 * deliberately explicit: a configured webhook is not treated as delivered
 * until a separately governed transport validates it. */
export function emitCommunityOperationalAlert(
  alert: CommunityOperationalAlert,
  emit: (entry: string) => void = (entry) => process.stderr.write(`${entry}\n`),
) {
  emit(JSON.stringify({ event: "community.operational-alert", ...alert }));
}
