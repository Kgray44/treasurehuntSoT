import { boundedQuery } from "@/admiralty/read-models";
import { admiraltyPageOperator } from "@/admiralty/page-authorization";
import { searchPeople } from "@/admiralty/ports/wayfarer-admin-read";
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

export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const operator = await admiraltyPageOperator("ACCOUNT_OBSERVE");
  const query = boundedQuery((await searchParams).q);
  const results = query ? await searchPeople(operator, query) : null;
  return (
    <ChartroomPage
      eyebrow="Wayfarer read port"
      title="People"
      description="Find one account by a known identifier, verified email, display name, handle, or linked provider subject."
    >
      <SearchForm value={query} placeholder="Email, name, handle, account ID, Google subject, or GitHub numeric ID" />
      {!query ? (
        <EmptyState
          title="Start with a known clue"
          detail="Admiralty does not enumerate the account directory. Enter at least two characters."
        />
      ) : results?.data?.results.length ? (
        <>
          <div className="chartroom-table-wrap" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Email</th>
                  <th>State</th>
                  <th>Roles & providers</th>
                  <th>Last seen</th>
                  <th>Support</th>
                </tr>
              </thead>
              <tbody>
                {results.data.results.map((account) => (
                  <tr key={account.id}>
                    <td>
                      <TextLink href={`/admin/people/${account.id}`}>
                        <strong>{account.displayName}</strong>
                      </TextLink>
                      <small>{account.handle ? `@${account.handle}` : "Handle not available"}</small>
                      <Identifier value={account.id} label="account ID" />
                    </td>
                    <td>
                      {account.primaryEmail ?? "Not available"}
                      <small>{account.emailVerified ? "Verified" : "Not verified"}</small>
                    </td>
                    <td>
                      <StatusBadge state={account.status} />
                    </td>
                    <td>
                      {account.roles.join(", ") || "No active role"}
                      <small>{account.providers.join(" · ") || "No linked provider"}</small>
                    </td>
                    <td>
                      {dateTime(account.lastSeenAt)}
                      <small>Created {dateTime(account.createdAt)}</small>
                    </td>
                    <td>
                      <StatusBadge state={account.supportAccessState} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <EvidenceStrip evidence={results.evidence} />
        </>
      ) : (
        <EmptyState
          title="No matching account"
          detail="Try an exact account or provider identifier, or a different verified email/name fragment."
        />
      )}
    </ChartroomPage>
  );
}
