import type { AdmiraltyCurrentOperator } from "./authorization";
import { writeAdministrativeAudit } from "./audit";
import { enforceAdmiraltyRateLimit } from "./http";
import { projection } from "./read-models";
import { searchAdministrativeAudit } from "./ports/audit-admin-read";
import { searchCommunity } from "./ports/harborlight-admin-read";
import { searchChronicles, searchVoyages } from "./ports/one-voyage-admin-read";
import { searchPeople } from "./ports/wayfarer-admin-read";

export type AdminInvestigationResult = Readonly<{
  domain: "People" | "Chronicles" | "Voyages" | "Community" | "Audit";
  id: string;
  label: string;
  description: string;
  href: string;
  correlationId?: string | null;
}>;

export async function investigate(operator: AdmiraltyCurrentOperator, query: string) {
  enforceAdmiraltyRateLimit(`investigation:${operator.accountId}`, 40, 5 * 60_000);
  const capabilities = new Set(operator.capabilities);
  const [people, chronicles, voyages, community, audit] = await Promise.all([
    capabilities.has("ACCOUNT_OBSERVE") ? searchPeople(operator, query).catch(() => null) : null,
    capabilities.has("CHRONICLE_OBSERVE") ? searchChronicles(operator, query).catch(() => null) : null,
    capabilities.has("VOYAGE_OBSERVE") ? searchVoyages(operator, query).catch(() => null) : null,
    capabilities.has("COMMUNITY_OBSERVE") ? searchCommunity(operator, query).catch(() => null) : null,
    capabilities.has("AUDIT_OBSERVE")
      ? searchAdministrativeAudit(operator, { query, page: 1 }).catch(() => null)
      : null,
  ]);
  const results: AdminInvestigationResult[] = [];
  for (const account of people?.data?.results ?? [])
    results.push({
      domain: "People",
      id: account.id,
      label: account.displayName,
      description: account.primaryEmail ?? account.status,
      href: `/admin/people/${account.id}`,
    });
  for (const chronicle of chronicles?.data?.results ?? [])
    results.push({
      domain: "Chronicles",
      id: chronicle.id,
      label: chronicle.title,
      description: `${chronicle.status} · ${chronicle.creatorDisplayName}`,
      href: `/admin/chronicles/${chronicle.id}`,
    });
  for (const voyage of voyages?.data?.results ?? [])
    results.push({
      domain: "Voyages",
      id: voyage.id,
      label: voyage.voyageName ?? voyage.tale.title,
      description: `${voyage.status} · ${voyage._count.memberships} crew`,
      href: `/admin/voyages/${voyage.id}`,
    });
  for (const listing of community?.data?.results ?? [])
    results.push({
      domain: "Community",
      id: listing.id,
      label: listing.title,
      description: `${listing.publicationStatus} · ${listing.owner.displayName}`,
      href: `/admin/community/${listing.id}`,
    });
  for (const event of audit?.data?.results ?? [])
    results.push({
      domain: "Audit",
      id: event.id,
      label: event.action,
      description: `${event.resourceType} · ${event.outcome}`,
      href: `/admin/audit?correlationId=${encodeURIComponent(event.correlationId)}`,
      correlationId: event.correlationId,
    });
  await writeAdministrativeAudit({
    actorAccountId: operator.accountId,
    actorRole: operator.roles[0] ?? "ADMINISTRATOR",
    capability: "PLATFORM_OBSERVE",
    action: "ADMIRALTY_INVESTIGATION_SEARCHED",
    targetType: "CrossDomainSearch",
    targetId: "bounded-query",
    reason: "Read-only cross-domain investigation",
    authorizationBasis: operator.authorizationBasis,
    accountSessionId: operator.accountSessionId,
    detail: {
      queryLength: query.length,
      resultCount: results.length,
      domains: [...new Set(results.map(({ domain }) => domain))],
    },
  });
  return projection("Admiralty federated owner read ports", { query, limitPerDomain: 50, results });
}
