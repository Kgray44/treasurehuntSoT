"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useMotionMode } from "@/animation/motion/useMotionMode";
import type { HomeportCommunityCard } from "@/community/homeport";
import { CommunityCardGrid } from "./CommunityCardGrid";
import { LoadingState } from "@/components/ui/AsyncState";

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
const itemTypeOptions = [
  ["CHRONICLE", "Chronicles"],
  ["ARTIFACT", "Artifacts"],
  ["TEMPLATE", "Templates"],
  ["MAP", "Maps"],
  ["AUDIO", "Audio and reveals"],
] as const;
const difficultyOptions = [
  ["EASY", "Easy"],
  ["MODERATE", "Moderate"],
  ["CHALLENGING", "Challenging"],
  ["EXPERT", "Expert"],
] as const;
const environmentOptions = [
  ["INDOOR", "Indoor"],
  ["OUTDOOR", "Outdoor"],
  ["MIXED", "Mixed"],
] as const;
const accessibilityOptions = [
  ["CAPTIONS", "Captions"],
  ["TRANSCRIPT", "Transcript"],
  ["NON_3D_FALLBACK", "Non-3D fallback"],
  ["REDUCED_MOTION", "Reduced motion"],
  ["KEYBOARD_ONLY", "Keyboard only"],
  ["SCREEN_READER_SUMMARY", "Screen-reader summary"],
  ["NO_AUDIO_REQUIRED", "No audio required"],
  ["NO_TRAVEL_REQUIRED", "No travel required"],
] as const;
const durationOptions = [
  ["", "Any length"],
  ["UNDER_60", "Under 1 hour"],
  ["ONE_TO_TWO_HOURS", "1 to 2 hours"],
  ["OVER_TWO_HOURS", "Over 2 hours"],
] as const;
const playerOptions = [
  ["", "Any Crew size"],
  ["SOLO", "Solo"],
  ["TWO_TO_FOUR", "2 to 4 Players"],
  ["FIVE_PLUS", "5 or more Players"],
] as const;
const discoveryKeys = [
  "q",
  "sort",
  "type",
  "duration",
  "difficulty",
  "players",
  "theme",
  "environment",
  "accessibility",
  "free",
  "remixable",
] as const;

type DiscoveryResponse = { items: HomeportCommunityCard[]; nextCursor?: string };
type AdvancedDraft = {
  difficulties: string[];
  players: string;
  theme: string;
  environments: string[];
  accessibility: string[];
  free: boolean;
  remixable: boolean;
};
type DiscoveryLoad =
  | { requestKey: string; state: "ready" | "empty"; items: HomeportCommunityCard[]; error: "" }
  | { requestKey: string; state: "error"; items: []; error: string };

export function CommunityDiscoveryBrowser({
  basePath = "/community",
  lockedType,
  heading = "Search the Harbor",
  compactLanding = false,
}: {
  basePath?: string;
  lockedType?: (typeof itemTypeOptions)[number][0];
  heading?: string;
  compactLanding?: boolean;
}) {
  const { mode } = useMotionMode();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawParameters = searchParams.toString();
  const current = useMemo(() => new URLSearchParams(rawParameters), [rawParameters]);
  const [retryKey, setRetryKey] = useState(0);
  const [load, setLoad] = useState<DiscoveryLoad | null>(null);
  const [queryState, setQueryState] = useState(() => ({ source: rawParameters, value: current.get("q") ?? "" }));
  const queryDraft = queryState.source === rawParameters ? queryState.value : (current.get("q") ?? "");
  const [advancedState, setAdvancedState] = useState<{ source: string; value: AdvancedDraft }>(() => ({
    source: rawParameters,
    value: advancedDraftFrom(current),
  }));
  const advancedDraft = advancedState.source === rawParameters ? advancedState.value : advancedDraftFrom(current);
  const requestGeneration = useRef(0);
  const retryFocusPending = useRef(false);
  const outcome = useRef<HTMLElement>(null);
  const advancedSummary = useRef<HTMLElement>(null);
  const active = discoveryKeys.some((key) => current.has(key));
  const [fullSearchOpen, setFullSearchOpen] = useState(active || !compactLanding);
  const fullSearchPanel = useRef<HTMLDivElement>(null);
  const apiParameters = useMemo(() => {
    const value = new URLSearchParams();
    for (const key of discoveryKeys) for (const entry of current.getAll(key)) value.append(key, entry);
    if (lockedType) value.set("type", lockedType);
    return value;
  }, [current, lockedType]);
  const requestKey = `${apiParameters.toString()}::${retryKey}`;
  const state = !active ? "idle" : load?.requestKey === requestKey ? load.state : "loading";
  const items = load?.requestKey === requestKey ? load.items : [];
  const error = load?.requestKey === requestKey ? load.error : "";

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const generation = ++requestGeneration.current;
    fetch(`/api/community/discover?${apiParameters.toString()}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as (DiscoveryResponse & { message?: string }) | null;
        if (!response.ok) throw new Error(body?.message || "Community discovery is unavailable.");
        return body ?? { items: [] };
      })
      .then((result) => {
        if (controller.signal.aborted || generation !== requestGeneration.current) return;
        const safeItems = Array.isArray(result.items) ? result.items : [];
        setLoad({ requestKey, state: safeItems.length ? "ready" : "empty", items: safeItems, error: "" });
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted || generation !== requestGeneration.current) return;
        setLoad({
          requestKey,
          state: "error",
          items: [],
          error: reason instanceof Error ? reason.message : "Community discovery is unavailable.",
        });
      });
    return () => controller.abort();
  }, [active, apiParameters, requestKey]);

  useLayoutEffect(() => {
    if (!retryFocusPending.current || !["ready", "empty", "error"].includes(state)) return;
    retryFocusPending.current = false;
    // Commit focus with the rendered retry outcome so a quick response cannot
    // leave keyboard users on a detached error control.
    outcome.current?.focus();
  }, [state]);

  function navigate(parameters: URLSearchParams) {
    parameters.delete("cursor");
    const suffix = parameters.toString();
    router.push(suffix ? `${basePath}?${suffix}` : basePath, { scroll: false });
  }

  function setSingle(name: string, value: string) {
    const next = new URLSearchParams(current);
    if (value) next.set(name, value);
    else next.delete(name);
    navigate(next);
  }

  function toggle(name: string, value: string) {
    const next = new URLSearchParams(current);
    const values = next.getAll(name);
    next.delete(name);
    for (const entry of values.filter((entry) => entry !== value)) next.append(name, entry);
    if (!values.includes(value)) next.append(name, value);
    navigate(next);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSingle("q", queryDraft.trim());
  }

  function clear() {
    const next = new URLSearchParams(current);
    for (const key of [...discoveryKeys, "cursor"]) next.delete(key);
    navigate(next);
  }

  function toggleAdvanced(name: "difficulties" | "environments" | "accessibility", value: string) {
    setAdvancedDraft((draft) => ({
      ...draft,
      [name]: draft[name].includes(value) ? draft[name].filter((entry) => entry !== value) : [...draft[name], value],
    }));
  }

  function setAdvancedDraft(update: AdvancedDraft | ((draft: AdvancedDraft) => AdvancedDraft)) {
    const value = typeof update === "function" ? update(advancedDraft) : update;
    setAdvancedState({ source: rawParameters, value });
  }

  function applyAdvanced() {
    const next = new URLSearchParams(current);
    for (const key of ["difficulty", "players", "theme", "environment", "accessibility", "free", "remixable"])
      next.delete(key);
    for (const value of advancedDraft.difficulties) next.append("difficulty", value);
    if (advancedDraft.players) next.set("players", advancedDraft.players);
    if (advancedDraft.theme.trim()) next.set("theme", advancedDraft.theme.trim());
    for (const value of advancedDraft.environments) next.append("environment", value);
    for (const value of advancedDraft.accessibility) next.append("accessibility", value);
    if (advancedDraft.free) next.set("free", "1");
    if (advancedDraft.remixable) next.set("remixable", "1");
    navigate(next);
  }

  function resetAdvanced() {
    setAdvancedDraft(emptyAdvancedDraft());
    const next = new URLSearchParams(current);
    for (const key of ["difficulty", "players", "theme", "environment", "accessibility", "free", "remixable"])
      next.delete(key);
    navigate(next);
    advancedSummary.current?.focus();
  }

  const chips = activeFilterChips(current, lockedType);
  const advancedActive = ["difficulty", "players", "theme", "environment", "accessibility", "free", "remixable"].some(
    (key) => current.has(key),
  );

  useEffect(() => {
    if (!fullSearchOpen || !compactLanding) return;
    const frame = requestAnimationFrame(() =>
      fullSearchPanel.current?.querySelector<HTMLElement>("select, input")?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [compactLanding, fullSearchOpen]);

  return (
    <section
      className={`community-discovery ${compactLanding ? "community-discovery--landing" : ""}`}
      aria-labelledby="community-discovery-title"
    >
      <div className="community-section-heading">
        <div>
          <p className="community-eyebrow">Discovery chart</p>
          <h2 id="community-discovery-title">{heading}</h2>
          <p>Search public titles and summaries, then narrow only by metadata Creators have supplied.</p>
        </div>
      </div>
      <form className="community-discovery__form" onSubmit={submitSearch} role="search">
        <div className="community-discovery__compact">
          <div className="community-search-field">
            <label htmlFor="community-search-query">Search public Community Harbor</label>
            <span className="community-search-field__input">
              <input
                id="community-search-query"
                name="q"
                type="search"
                value={queryDraft}
                maxLength={160}
                autoComplete="off"
                placeholder="Title, theme, or Creator"
                onChange={(event) => setQueryState({ source: rawParameters, value: event.target.value })}
              />
              <button
                className="community-button community-button--primary community-search-submit"
                type="submit"
                aria-label="Search Community Harbor"
              >
                <span aria-hidden="true">⌕</span>
                <span className="sr-only">Search Community Harbor</span>
              </button>
            </span>
          </div>
          {compactLanding ? (
            <button
              className="community-button community-button--quiet community-full-search-toggle"
              type="button"
              aria-expanded={fullSearchOpen}
              aria-controls="community-full-search"
              onClick={() => setFullSearchOpen((open) => !open)}
            >
              {fullSearchOpen ? "Close Full Search" : "Full Search"}
            </button>
          ) : null}
        </div>
        <AnimatePresence initial={false}>
          {fullSearchOpen ? (
            <motion.div
              ref={fullSearchPanel}
              id="community-full-search"
              className="community-discovery__full"
              initial={compactLanding && mode !== "reduced" ? { opacity: 0, height: 0 } : false}
              animate={{ opacity: 1, height: "auto" }}
              exit={mode === "reduced" ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={{ duration: mode === "reduced" ? 0.01 : 0.2 }}
            >
              <div className="community-discovery__quick-filters">
                <label>
                  <span>Sort</span>
                  <select
                    value={current.get("sort") ?? "FEATURED"}
                    onChange={(event) => setSingle("sort", event.target.value)}
                  >
                    {sortOptions.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Duration</span>
                  <select
                    value={current.get("duration") ?? ""}
                    onChange={(event) => setSingle("duration", event.target.value)}
                  >
                    {durationOptions.map(([value, label]) => (
                      <option key={value || "any"} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {!lockedType ? (
                <fieldset className="community-chip-fieldset">
                  <legend>Content type</legend>
                  <div>
                    {itemTypeOptions.map(([value, label]) => (
                      <label key={value} className="community-filter-chip">
                        <input
                          type="checkbox"
                          checked={current.getAll("type").includes(value)}
                          onChange={() => toggle("type", value)}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}
              <details className="community-advanced-filters" open={advancedActive || undefined}>
                <summary ref={advancedSummary}>
                  Advanced filters <span>{advancedActive ? "Active" : "Optional"}</span>
                </summary>
                <div className="community-advanced-filters__grid">
                  <fieldset className="community-chip-fieldset">
                    <legend>Difficulty</legend>
                    <div>
                      {difficultyOptions.map(([value, label]) => (
                        <label key={value} className="community-filter-chip">
                          <input
                            type="checkbox"
                            checked={advancedDraft.difficulties.includes(value)}
                            onChange={() => toggleAdvanced("difficulties", value)}
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <label>
                    <span>Crew size</span>
                    <select
                      value={advancedDraft.players}
                      onChange={(event) => setAdvancedDraft((draft) => ({ ...draft, players: event.target.value }))}
                    >
                      {playerOptions.map(([value, label]) => (
                        <option key={value || "any"} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Theme</span>
                    <input
                      type="text"
                      value={advancedDraft.theme}
                      maxLength={48}
                      placeholder="For example: mystery"
                      onChange={(event) => setAdvancedDraft((draft) => ({ ...draft, theme: event.target.value }))}
                    />
                  </label>
                  <fieldset className="community-chip-fieldset">
                    <legend>Environment</legend>
                    <div>
                      {environmentOptions.map(([value, label]) => (
                        <label key={value} className="community-filter-chip">
                          <input
                            type="checkbox"
                            checked={advancedDraft.environments.includes(value)}
                            onChange={() => toggleAdvanced("environments", value)}
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset className="community-chip-fieldset community-chip-fieldset--wide">
                    <legend>Accessibility</legend>
                    <div>
                      {accessibilityOptions.map(([value, label]) => (
                        <label key={value} className="community-filter-chip">
                          <input
                            type="checkbox"
                            checked={advancedDraft.accessibility.includes(value)}
                            onChange={() => toggleAdvanced("accessibility", value)}
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <label className="community-switch">
                    <input
                      type="checkbox"
                      checked={advancedDraft.free}
                      onChange={(event) => setAdvancedDraft((draft) => ({ ...draft, free: event.target.checked }))}
                    />
                    <span>Free content only</span>
                  </label>
                  <label className="community-switch">
                    <input
                      type="checkbox"
                      checked={advancedDraft.remixable}
                      onChange={(event) => setAdvancedDraft((draft) => ({ ...draft, remixable: event.target.checked }))}
                    />
                    <span>Remixable content only</span>
                  </label>
                  <div className="community-advanced-filters__actions">
                    <button
                      className="community-button community-button--primary"
                      type="button"
                      onClick={applyAdvanced}
                    >
                      Apply advanced filters
                    </button>
                    <button className="community-button community-button--quiet" type="button" onClick={resetAdvanced}>
                      Reset advanced filters
                    </button>
                  </div>
                </div>
              </details>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </form>

      {chips.length ? (
        <div className="community-active-filters" aria-label="Active search and filters">
          <p>
            <strong>{chips.length}</strong> active {chips.length === 1 ? "criterion" : "criteria"}
          </p>
          <ul>
            {chips.map((chip) => (
              <li key={`${chip.key}:${chip.value}`}>
                <button
                  type="button"
                  onClick={() => (chip.repeatable ? toggle(chip.key, chip.value) : setSingle(chip.key, ""))}
                >
                  {chip.label} <span aria-hidden="true">×</span>
                  <span className="sr-only">Remove filter</span>
                </button>
              </li>
            ))}
          </ul>
          <button className="community-button community-button--quiet" type="button" onClick={clear}>
            Clear search and filters
          </button>
        </div>
      ) : null}

      {state === "idle" ? (
        <p className="community-discovery__idle">The Harbor shelves below are ready to browse without a search.</p>
      ) : null}
      {state === "loading" ? (
        <LoadingState
          title="Charting public results"
          detail="Your current Harbor criteria are being applied."
          compact
        />
      ) : null}
      {state === "error" ? (
        <section
          ref={outcome}
          className="community-state community-state--error"
          role="alert"
          aria-live="assertive"
          tabIndex={-1}
        >
          <p className="community-eyebrow">Discovery unavailable</p>
          <h3>Community results could not be opened</h3>
          <p>{error} Your search has not changed.</p>
          <button
            className="community-button community-button--primary"
            type="button"
            onClick={() => {
              retryFocusPending.current = true;
              setRetryKey((value) => value + 1);
            }}
          >
            Try again
          </button>
        </section>
      ) : null}
      {state === "empty" ? (
        <section ref={outcome} className="community-state community-state--empty" aria-live="polite" tabIndex={-1}>
          <p className="community-eyebrow">No matches</p>
          <h3>No public charts match these criteria</h3>
          <p>Clear one or more filters, or try a shorter search. Default Harbor shelves remain available above.</p>
          <button className="community-button community-button--primary" type="button" onClick={clear}>
            Clear search and filters
          </button>
        </section>
      ) : null}
      {state === "ready" ? (
        <section ref={outcome} className="community-results" aria-labelledby="community-results-title" tabIndex={-1}>
          <div className="community-section-heading">
            <div>
              <p className="community-eyebrow">Public results</p>
              <h3 id="community-results-title">
                {items.length} {items.length === 1 ? "chart" : "charts"} found
              </h3>
            </div>
          </div>
          <CommunityCardGrid cards={items} label="Public Community Harbor results" />
        </section>
      ) : null}
    </section>
  );
}

function activeFilterChips(parameters: URLSearchParams, lockedType?: string) {
  const labelFor = (options: readonly (readonly [string, string])[], value: string) =>
    options.find(([candidate]) => candidate === value)?.[1] ?? value;
  const chips: Array<{ key: string; value: string; label: string; repeatable: boolean }> = [];
  const query = parameters.get("q");
  if (query) chips.push({ key: "q", value: query, label: `Search: ${query}`, repeatable: false });
  if (parameters.has("sort"))
    chips.push({
      key: "sort",
      value: parameters.get("sort") ?? "FEATURED",
      label: `Sort: ${labelFor(sortOptions, parameters.get("sort") ?? "FEATURED")}`,
      repeatable: false,
    });
  if (!lockedType)
    for (const value of parameters.getAll("type"))
      chips.push({ key: "type", value, label: labelFor(itemTypeOptions, value), repeatable: true });
  const duration = parameters.get("duration");
  if (duration)
    chips.push({ key: "duration", value: duration, label: labelFor(durationOptions, duration), repeatable: false });
  for (const value of parameters.getAll("difficulty"))
    chips.push({ key: "difficulty", value, label: labelFor(difficultyOptions, value), repeatable: true });
  const players = parameters.get("players");
  if (players)
    chips.push({ key: "players", value: players, label: labelFor(playerOptions, players), repeatable: false });
  for (const value of parameters.getAll("environment"))
    chips.push({ key: "environment", value, label: labelFor(environmentOptions, value), repeatable: true });
  for (const value of parameters.getAll("accessibility"))
    chips.push({ key: "accessibility", value, label: labelFor(accessibilityOptions, value), repeatable: true });
  if (parameters.get("free") === "1") chips.push({ key: "free", value: "1", label: "Free only", repeatable: false });
  if (parameters.get("remixable") === "1")
    chips.push({ key: "remixable", value: "1", label: "Remixable only", repeatable: false });
  return chips;
}

function advancedDraftFrom(parameters: URLSearchParams): AdvancedDraft {
  return {
    difficulties: parameters.getAll("difficulty"),
    players: parameters.get("players") ?? "",
    theme: parameters.get("theme") ?? "",
    environments: parameters.getAll("environment"),
    accessibility: parameters.getAll("accessibility"),
    free: parameters.get("free") === "1",
    remixable: parameters.get("remixable") === "1",
  };
}

function emptyAdvancedDraft(): AdvancedDraft {
  return {
    difficulties: [],
    players: "",
    theme: "",
    environments: [],
    accessibility: [],
    free: false,
    remixable: false,
  };
}
