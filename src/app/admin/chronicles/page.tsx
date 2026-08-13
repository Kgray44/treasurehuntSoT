import { admiraltyPageOperator } from "@/admiralty/page-authorization";
import { searchChronicles } from "@/admiralty/ports/one-voyage-admin-read";
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

export default async function ChroniclesPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const operator = await admiraltyPageOperator("CHRONICLE_OBSERVE");
  const query = boundedQuery((await searchParams).q);
  const result = query ? await searchChronicles(operator, query) : null;
  return (
    <ChartroomPage
      eyebrow="One Voyage read port"
      title="Chronicles"
      description="Inspect Chronicle definitions, immutable editions, release relationships, and safe integrity evidence."
    >
      <SearchForm value={query} placeholder="Chronicle ID, slug, title, or creator" />
      {!query ? (
        <EmptyState title="Search for a Chronicle" detail="Use a known title, slug, creator, or exact Chronicle ID." />
      ) : result?.data?.results.length ? (
        <>
          <div className="chartroom-cards">
            {result.data.results.map((chronicle) => (
              <article key={chronicle.id}>
                <header>
                  <StatusBadge state={chronicle.status} />
                  <span>{chronicle.visibility}</span>
                </header>
                <TextLink href={`/admin/chronicles/${chronicle.id}`}>
                  <h2>{chronicle.title}</h2>
                </TextLink>
                <p>
                  {chronicle.creatorDisplayName}
                  {chronicle.creatorHandle ? ` · @${chronicle.creatorHandle}` : ""}
                </p>
                <Identifier value={chronicle.id} label="Chronicle ID" />
                <dl>
                  <div>
                    <dt>Editions</dt>
                    <dd>{chronicle._count.versions}</dd>
                  </div>
                  <div>
                    <dt>Voyages</dt>
                    <dd>{chronicle._count.sessions}</dd>
                  </div>
                  <div>
                    <dt>Players</dt>
                    <dd>
                      {chronicle.playerCountMin}–{chronicle.playerCountMax}
                    </dd>
                  </div>
                  <div>
                    <dt>Updated</dt>
                    <dd>{dateTime(chronicle.updatedAt)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
          <EvidenceStrip evidence={result.evidence} />
        </>
      ) : (
        <EmptyState title="No matching Chronicle" />
      )}
    </ChartroomPage>
  );
}
