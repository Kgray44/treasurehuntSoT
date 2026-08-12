import { admiraltyPageOperator } from "@/admiralty/page-authorization";
import { searchVoyages } from "@/admiralty/ports/one-voyage-admin-read";
import { boundedQuery } from "@/admiralty/read-models";
import {
  ChartroomPage,
  EmptyState,
  EvidenceStrip,
  Identifier,
  SearchForm,
  StatusBadge,
  TextLink,
  dateTime,
} from "@/components/admiralty/AdminPrimitives";

export default async function VoyagesPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const operator = await admiraltyPageOperator("VOYAGE_OBSERVE");
  const query = boundedQuery((await searchParams).q);
  const result = query ? await searchVoyages(operator, query) : null;
  return (
    <ChartroomPage
      eyebrow="One Voyage read port"
      title="Voyages"
      description="Inspect runtime state, crew membership, pending verification, heartbeat, and a safe event sequence without raw payloads."
    >
      <SearchForm value={query} placeholder="Voyage ID, Chronicle, captain, or player" />
      {!query ? (
        <EmptyState title="Search for a Voyage" detail="Use a Voyage ID, Chronicle title, captain, or crew member." />
      ) : result?.data?.results.length ? (
        <>
          <div className="chartroom-table-wrap" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th>Voyage</th>
                  <th>Chronicle</th>
                  <th>Captain</th>
                  <th>State</th>
                  <th>Crew & events</th>
                  <th>Heartbeat</th>
                </tr>
              </thead>
              <tbody>
                {result.data.results.map((voyage) => (
                  <tr key={voyage.id}>
                    <td>
                      <TextLink href={`/admin/voyages/${voyage.id}`}>
                        <strong>{voyage.voyageName ?? voyage.ownerLabel ?? "Unnamed Voyage"}</strong>
                      </TextLink>
                      <Identifier value={voyage.id} label="Voyage ID" />
                    </td>
                    <td>
                      {voyage.tale.title}
                      <small>{voyage.tale.slug}</small>
                    </td>
                    <td>
                      {voyage.captainAccount?.profile?.displayName ?? "Not available"}
                      <small>
                        {voyage.captainAccount?.profile?.handle ? `@${voyage.captainAccount.profile.handle}` : ""}
                      </small>
                    </td>
                    <td>
                      <StatusBadge state={voyage.previewMode ? "NOT_LIVE_VALIDATED" : voyage.status} />
                    </td>
                    <td>
                      {voyage._count.memberships} crew · {voyage._count.events} events
                      <small>{voyage._count.verificationRequests} verification requests</small>
                    </td>
                    <td>
                      {dateTime(voyage.lastHeartbeatAt)}
                      <small>Updated {dateTime(voyage.updatedAt)}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <EvidenceStrip evidence={result.evidence} />
        </>
      ) : (
        <EmptyState title="No matching Voyage" />
      )}
    </ChartroomPage>
  );
}
