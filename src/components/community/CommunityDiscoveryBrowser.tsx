"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

const sortOptions = [
  ["FEATURED", "Featured"],
  ["NEWEST", "Newest"],
  ["RECENTLY_UPDATED", "Recently updated"],
  ["TRENDING", "Trending"],
  ["MOST_INSTALLED", "Most installed"],
  ["HIGHEST_RATED", "Highest rated"],
  ["MOST_COMPLETED", "Most completed"],
  ["MOST_SAVED", "Most saved"],
] as const;
const itemTypeOptions = ["CHRONICLE", "ARTIFACT", "TEMPLATE", "MAP", "AUDIO"] as const;
const difficultyOptions = ["EASY", "MODERATE", "CHALLENGING", "EXPERT"] as const;

type DiscoveryFilters = {
  itemTypes?: string[];
  difficulties?: string[];
  freeOnly?: boolean;
  remixable?: boolean;
};

type DiscoveryItem = {
  id: string;
  slug?: string;
  itemType: string;
  title: string;
  safeSummary: string | null;
  creatorHandle: string;
  publishedAt: string | null;
};
type DiscoveryResponse = { items: DiscoveryItem[]; nextCursor?: string };

export function CommunityDiscoveryBrowser() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const sortParameter = searchParams.get("sort");
  const sort = isSort(sortParameter) ? sortParameter : "FEATURED";
  const rawFilters = searchParams.get("filters");
  const filters = useMemo(() => readFilters(rawFilters), [rawFilters]);
  const [draftQuery, setDraftQuery] = useState(query);
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [items, setItems] = useState<DiscoveryItem[]>([]);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => setDraftQuery(query), [query]);

  useEffect(() => {
    const controller = new AbortController();
    const parameters = new URLSearchParams();
    if (query) parameters.set("q", query);
    parameters.set("sort", sort);
    if (Object.keys(filters).length) parameters.set("filters", JSON.stringify(filters));
    setState("loading");
    setError("");
    fetch(`/api/community/discover?${parameters.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { message?: string } | null;
          throw new Error(body?.message || "Community discovery is unavailable.");
        }
        return response.json() as Promise<DiscoveryResponse>;
      })
      .then((result) => {
        if (controller.signal.aborted) return;
        setItems(Array.isArray(result.items) ? result.items : []);
        setState(result.items.length ? "ready" : "empty");
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setItems([]);
        setError(reason instanceof Error ? reason.message : "Community discovery is unavailable.");
        setState("error");
      });
    return () => controller.abort();
  }, [filters, query, retryKey, sort]);

  const updateUrl = useCallback(
    (next: { q?: string; sort?: string; filters?: DiscoveryFilters; clear?: boolean }) => {
      const parameters = new URLSearchParams(searchParams.toString());
      if (next.clear) {
        parameters.delete("q");
        parameters.delete("filters");
        parameters.delete("cursor");
      }
      if (next.q !== undefined) {
        if (next.q.trim()) parameters.set("q", next.q.trim());
        else parameters.delete("q");
        parameters.delete("cursor");
      }
      if (next.sort !== undefined) {
        parameters.set("sort", next.sort);
        parameters.delete("cursor");
      }
      if (next.filters !== undefined) {
        if (Object.keys(next.filters).length) parameters.set("filters", JSON.stringify(next.filters));
        else parameters.delete("filters");
        parameters.delete("cursor");
      }
      const suffix = parameters.toString();
      router.replace(suffix ? `/community?${suffix}` : "/community", { scroll: false });
    },
    [router, searchParams],
  );

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateUrl({ q: draftQuery });
  }

  function toggleFilter(field: "itemTypes" | "difficulties", value: string) {
    const current = filters[field] ?? [];
    const values = current.includes(value) ? current.filter((candidate) => candidate !== value) : [...current, value];
    updateUrl({ filters: { ...filters, [field]: values } });
  }

  return (
    <section aria-labelledby="community-discovery-title">
      <h2 id="community-discovery-title">Find a public chart</h2>
      <form onSubmit={submitSearch} role="search">
        <label htmlFor="community-search-query">Search public Community Harbor</label>
        <input
          id="community-search-query"
          name="q"
          type="search"
          value={draftQuery}
          onChange={(event) => setDraftQuery(event.target.value)}
          maxLength={160}
          autoComplete="off"
        />
        <button type="submit">Search</button>
        <label htmlFor="community-search-sort">Sort results</label>
        <select
          id="community-search-sort"
          name="sort"
          value={sort}
          onChange={(event) => updateUrl({ sort: event.target.value })}
        >
          {sortOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => updateUrl({ clear: true, q: "", sort: "FEATURED" })}>
          Clear search and filters
        </button>
        <fieldset>
          <legend>Content type</legend>
          {itemTypeOptions.map((itemType) => (
            <label key={itemType}>
              <input
                type="checkbox"
                checked={filters.itemTypes?.includes(itemType) ?? false}
                onChange={() => toggleFilter("itemTypes", itemType)}
              />
              {itemType.toLocaleLowerCase().replace(/(^|_)([a-z])/g, (_, gap, letter) => `${gap} ${letter.toUpperCase()}`).trim()}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Difficulty</legend>
          {difficultyOptions.map((difficulty) => (
            <label key={difficulty}>
              <input
                type="checkbox"
                checked={filters.difficulties?.includes(difficulty) ?? false}
                onChange={() => toggleFilter("difficulties", difficulty)}
              />
              {difficulty.toLocaleLowerCase().replace(/^./, (letter) => letter.toUpperCase())}
            </label>
          ))}
        </fieldset>
        <label>
          <input
            type="checkbox"
            checked={filters.freeOnly ?? false}
            onChange={(event) => updateUrl({ filters: { ...filters, freeOnly: event.target.checked || undefined } })}
          />
          Free content only
        </label>
        <label>
          <input
            type="checkbox"
            checked={filters.remixable ?? false}
            onChange={(event) => updateUrl({ filters: { ...filters, remixable: event.target.checked || undefined } })}
          />
          Remixable content only
        </label>
      </form>

      {state === "loading" ? (
        <p role="status" aria-live="polite">
          Loading public Community Harbor results.
        </p>
      ) : null}
      {state === "error" ? (
        <section role="alert" aria-live="assertive">
          <h3>Community discovery is unavailable</h3>
          <p>{error}</p>
          <button type="button" onClick={() => setRetryKey((value) => value + 1)}>
            Retry discovery
          </button>
        </section>
      ) : null}
      {state === "empty" ? (
        <section aria-live="polite">
          <h3>No public charts matched this search</h3>
          <p>Try a shorter search or use Clear search and filters above.</p>
        </section>
      ) : null}
      {state === "ready" ? (
        <>
          <p aria-live="polite">
            {items.length} public {items.length === 1 ? "result" : "results"}.
          </p>
          <ul aria-label="Public Community Harbor results">
            {items.map((item) => (
              <li key={item.id}>
                <article>
                  <p>{item.itemType}</p>
                  <h3>{item.slug ? <Link href={`/community/${encodeURIComponent(item.slug)}`}>{item.title}</Link> : item.title}</h3>
                  {item.safeSummary ? <p>{item.safeSummary}</p> : null}
                  <p>By {item.creatorHandle}</p>
                </article>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

function isSort(value: string | null): value is (typeof sortOptions)[number][0] {
  return sortOptions.some(([sort]) => sort === value);
}

function readFilters(value: string | null): DiscoveryFilters {
  if (!value || value.length > 2048) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const candidate = parsed as Record<string, unknown>;
    const strings = (key: "itemTypes" | "difficulties") =>
      Array.isArray(candidate[key]) ? candidate[key].filter((item): item is string => typeof item === "string").slice(0, 12) : undefined;
    return {
      ...(strings("itemTypes")?.length ? { itemTypes: strings("itemTypes") } : {}),
      ...(strings("difficulties")?.length ? { difficulties: strings("difficulties") } : {}),
      ...(candidate.freeOnly === true ? { freeOnly: true } : {}),
      ...(candidate.remixable === true ? { remixable: true } : {}),
    };
  } catch {
    return {};
  }
}
