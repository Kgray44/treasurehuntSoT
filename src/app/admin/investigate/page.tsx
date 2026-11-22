import { investigate } from "@/admiralty/investigation";
import { admiraltyPageOperator } from "@/admiralty/page-authorization";
import { boundedQuery } from "@/admiralty/read-models";
import {
  ChartroomPage,
  EvidenceStrip,
  Identifier,
  StatusBadge,
  TextLink,
} from "@/components/admiralty/AdminPrimitives";
import {
  ProjectionSearchEmpty,
  ProjectionSearchForm,
  projectionSearchResultsId,
} from "@/components/admiralty/ProjectionSearchForm";

export default async function InvestigatePage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const operator = await admiraltyPageOperator("PLATFORM_OBSERVE");
  const query = boundedQuery((await searchParams).q);
  const result = query ? await investigate(operator, query) : null;
  const grouped = Object.groupBy(result?.data?.results ?? [], (item) => item.domain);
  return (
    <ChartroomPage
      eyebrow="Federated owner read ports"
      title="Investigate"
      description="Start with a person, Chronicle, Voyage, case, release, or time-linked activity. Exact IDs remain an advanced option."
    >
      <ProjectionSearchForm
        value={query}
        label="What are you investigating?"
        placeholder="Account, Chronicle, Voyage, Community case, release, or known identifier"
      />
      <aside className="chartroom-callout">
        <strong>Use exact IDs only when they are your starting clue.</strong>
        <p>Admiralty sends the bounded query only to owner projections available to your current role.</p>
      </aside>
      {!query ? (
        <ProjectionSearchEmpty
          title="Start with one clue"
          detail="Admiralty fans the bounded query only to owner projections authorized for this operator."
        />
      ) : result?.data?.results.length ? (
        <>
          <div className="chartroom-investigation" id={projectionSearchResultsId} tabIndex={-1}>
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
        <ProjectionSearchEmpty
          title="No authorized match"
          detail="No owner projection returned a matching result for this role."
        />
      )}
    </ChartroomPage>
  );
}
