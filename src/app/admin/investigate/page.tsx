import { investigate } from "@/admiralty/investigation";
import { admiraltyPageOperator } from "@/admiralty/page-authorization";
import { boundedQuery } from "@/admiralty/read-models";
import {
  ChartroomPage,
  EmptyState,
  EvidenceStrip,
  Identifier,
  SearchForm,
  StatusBadge,
  TextLink,
} from "@/components/admiralty/AdminPrimitives";

export default async function InvestigatePage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const operator = await admiraltyPageOperator("PLATFORM_OBSERVE");
  const query = boundedQuery((await searchParams).q);
  const result = query ? await investigate(operator, query) : null;
  const grouped = Object.groupBy(result?.data?.results ?? [], (item) => item.domain);
  return (
    <ChartroomPage
      eyebrow="Federated owner read ports"
      title="Investigate"
      description="Follow a person, Chronicle, Voyage, listing, audit event, or correlation ID across only the domains your role can observe."
    >
      <SearchForm value={query} placeholder="Account, Chronicle, Voyage, listing, audit, or correlation ID" />
      {!query ? (
        <EmptyState
          title="Start with one clue"
          detail="Admiralty fans the bounded query only to owner projections authorized for this operator."
        />
      ) : result?.data?.results.length ? (
        <>
          <div className="chartroom-investigation">
            {Object.entries(grouped).map(([domain, items]) => (
              <section key={domain}>
                <header>
                  <StatusBadge state="HEALTHY" />
                  <h2>{domain}</h2>
                  <span>{items?.length ?? 0} results</span>
                </header>
                <div>
                  {items?.map((item) => (
                    <article key={`${item.domain}-${item.id}`}>
                      <TextLink href={item.href}>
                        <strong>{item.label}</strong>
                      </TextLink>
                      <p>{item.description}</p>
                      <Identifier value={item.id} label={`${item.domain} ID`} />
                      {item.correlationId ? <Identifier value={item.correlationId} label="correlation ID" /> : null}
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <EvidenceStrip evidence={result.evidence} />
        </>
      ) : (
        <EmptyState
          title="No authorized match"
          detail="No owner projection returned a matching result for this role."
        />
      )}
    </ChartroomPage>
  );
}
