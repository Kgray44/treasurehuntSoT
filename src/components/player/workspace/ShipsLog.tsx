"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { PublicSnapshot } from "@/domain/story";
import type { CompanionView } from "./types";

export function ShipsLog({
  snapshot,
  navigate,
}: {
  snapshot: PublicSnapshot;
  navigate: (view: CompanionView) => void;
}) {
  const [filter, setFilter] = useState("all");
  const groups = useMemo(() => {
    const entries = filter === "all" ? snapshot.log : snapshot.log.filter((entry) => entry.section === filter);
    return entries.reduce<Record<string, typeof entries>>((result, entry) => {
      const day = new Date(entry.timestamp).toLocaleDateString([], { dateStyle: "long" });
      (result[day] ??= []).push(entry);
      return result;
    }, {});
  }, [filter, snapshot.log]);
  return (
    <section
      className="physical-section ships-log-section"
      aria-labelledby="log-heading"
      data-section-heading
      tabIndex={-1}
    >
      <header className="section-masthead">
        <div>
          <p className="eyebrow">Chronicle of the voyage</p>
          <h2 id="log-heading">Ship&apos;s Log</h2>
        </div>
        <p>Dated entries, weather marks, moon phases, and routes back to the physical workspace.</p>
      </header>
      <label className="log-filter">
        Show{" "}
        <select value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="all">All entries</option>
          <option value="journal">Journal</option>
          <option value="chart">Chart</option>
          <option value="treasures">Treasures</option>
          <option value="quests">Quests</option>
          <option value="finale">Finale</option>
        </select>
      </label>
      {Object.keys(groups).length ? (
        <div className="captains-logbook">
          <AnimatePresence initial={false} mode="popLayout">
            {Object.entries(groups).map(([day, entries]) => (
              <motion.section layout key={day} className="log-day">
                <header>
                  <span className="moon-phase" aria-hidden="true">
                    ◐
                  </span>
                  <h3>{day}</h3>
                  <small>Weather: calm ink</small>
                </header>
                <ol>
                  {entries.map((entry, index) => (
                    <motion.li
                      layout
                      key={entry.key}
                      className={`${entry.importance} ${entry.unseen ? "unseen" : ""}`}
                      data-scene-part={index === entries.length - 1 ? "log-entry-new" : "log-entry"}
                      data-gsap-owned
                    >
                      <span
                        className="log-symbol"
                        data-scene-part={index === entries.length - 1 ? "log-symbol-new" : undefined}
                        data-gsap-owned
                        aria-hidden="true"
                      >
                        {entry.symbol}
                      </span>
                      <div>
                        <time>
                          {new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </time>
                        <h4>{entry.title}</h4>
                        <p>{entry.summary}</p>
                        {entry.section !== "log" && (
                          <button onClick={() => navigate(entry.section)}>Open {entry.section}</button>
                        )}
                      </div>
                    </motion.li>
                  ))}
                </ol>
              </motion.section>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="physical-empty">
          <span aria-hidden="true">◇</span>
          <h3>The log awaits its first line</h3>
          <p>Released voyage events will be recorded here without inventing private details.</p>
        </div>
      )}
    </section>
  );
}
