import { notFound } from "next/navigation";
import { DURATION } from "@/animation/embarkation/program";
export const dynamic = "force-dynamic";
export default function EmbarkationScreening() {
  if (process.env.NODE_ENV === "production" || process.env.EMBARKATION_PREVIEW !== "1") notFound();
  const scenes = [
    ["Kato · first arrival", "role=captain&arrival=first&quality=CINEMATIC"],
    ["Sera · first arrival", "role=player&arrival=first&quality=CINEMATIC"],
    ["Guest invitation · welcome aboard", "role=guest&arrival=first&quality=CINEMATIC"],
    ["Balanced", "role=captain&arrival=first&quality=BALANCED"],
    ["Performance", "role=captain&arrival=first&quality=PERFORMANCE"],
    ["Reduced motion ceremony", "role=player&arrival=first&motion=reduced"],
    ["Optional artwork unavailable", "role=captain&arrival=first&missing=optional"],
    ["Compositor unavailable", "role=captain&arrival=first&failure=renderer"],
    ["Short return", "role=captain&arrival=return&quality=CINEMATIC"],
    ["Replay Arrival · enter, then use Replay Arrival", "role=captain&arrival=return&quality=CINEMATIC"],
    ["Kato · normal persistent entry", "role=captain"],
  ];
  return (
    <main style={{ maxWidth: 1060, margin: "70px auto", padding: "0 28px", color: "#f1dfbd" }}>
      <p style={{ letterSpacing: ".24em", fontSize: 11, color: "#c9ab6c" }}>
        DEVELOPMENT SCREENING · ISOLATED SYNTHETIC CREW
      </p>
      <h1 style={{ font: "52px Georgia,serif", margin: "20px 0" }}>Crossing the Threshold</h1>
      <p>Voyagewright Refit V1 · Embarkation · Owner Screening Delta 2 · {DURATION} seconds</p>
      <p style={{ color: "#91b3ad", maxWidth: 700, lineHeight: 1.7 }}>
        Each entry opens the real Muster with a task-owned Crew and database. Choose Join the Adventure when the neutral
        stage is ready. Hold Space or the small lower-left control for three seconds to skip. After arrival, stay in the
        room to see the candle flames, sheltered lanterns and quiet harbor reflections.
      </p>
      <div
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(270px,1fr))", gap: 14, marginTop: 35 }}
      >
        {scenes.map(([name, query]) => (
          <a
            key={name}
            href={`/dev/embarkation/enter?${query}`}
            style={{
              display: "block",
              border: "1px solid #927d4f66",
              borderRadius: 12,
              padding: 22,
              background: "#0a2b2f",
              color: "#efdab1",
              textDecoration: "none",
            }}
          >
            {name} <span aria-hidden="true">↗</span>
          </a>
        ))}
      </div>
      <p style={{ marginTop: 35 }}>
        <a href="/dev/embarkation/enter?role=captain&arrival=first&quality=CINEMATIC&inspector=1">
          Open the developer timeline inspector
        </a>
      </p>
      <p style={{ fontSize: 12, color: "#809e99" }}>
        Implementation screening. Owner acceptance and protected integration remain pending.
      </p>
    </main>
  );
}
