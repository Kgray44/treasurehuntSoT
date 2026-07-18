"use client";

import { useRef } from "react";

type Role = "CREATOR" | "PLAYER" | "CAPTAIN";

const content: Record<Role, { title: string; introduction: string; steps: string[]; privacy: string }> = {
  CREATOR: {
    title: "Creator Vision orientation",
    introduction:
      "Vision Waypoints bind a story step to a versioned visual place check. Exact Landmark, Area Arrival, and Viewpoint remain experimental until real pilot certification passes.",
    steps: [
      "Record varied target views, then define where and how a Player may stand.",
      "Record similar wrong places as hard negatives; they protect the story from false accepts.",
      "Use stable regions for useful surroundings and ignored regions for moving or unreliable detail.",
      "Treat reliability grades as test evidence, not artistic quality or a guarantee.",
      "Publish an immutable version only after positive, negative, and locked tests; use shadow mode first.",
    ],
    privacy:
      "Creator recordings are retained authoring assets. Studio shows their storage and dependencies; runtime Player frames remain memory-only by default.",
  },
  PLAYER: {
    title: "Player Vision orientation",
    introduction:
      "A Vision step samples only the selected Sea of Thieves window after you start the scan. It does not inject into the game, read game memory, or automate input.",
    steps: [
      "Open Companion health and explicitly select the Sea of Thieves application window.",
      "Hold the governed scan control only when the story asks.",
      "The Vision Active status means local frames are being sampled for this attempt.",
      "Use Pause or Stop at any time. An incomplete scan cannot verify a waypoint.",
      "Follow framing or lighting guidance; if the package is offline or unavailable, ask the Captain.",
    ],
    privacy:
      "Runtime frames stay in memory and are cleared after inference. Metadata-only diagnostics are the default; frame retention requires a separate unmistakable consent.",
  },
  CAPTAIN: {
    title: "Captain Vision orientation",
    introduction:
      "Captain controls are the governed recovery path. Engine recommendations never remove the Captain’s responsibility to confirm the real story situation.",
    steps: [
      "Monitor the exact waypoint version, package hash, engine recommendation, and failed gates.",
      "Approve only when the Player’s real situation is known; reject wrong or unsafe evidence.",
      "Apply a truth label when saving a case for improvement.",
      "Shadow mode records outcomes without automatic story progression.",
      "Manual recovery advances at most once and remains in immutable audit history.",
    ],
    privacy: "Retain only the minimum diagnostic evidence required. Ordinary summaries exclude raw frames and secrets.",
  },
};

export function VisionOnboarding({ role }: { role: Role }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const guide = content[role];

  return (
    <div className="vision-onboarding-control">
      <button type="button" onClick={() => dialog.current?.showModal()}>
        Vision help
      </button>
      <dialog ref={dialog} className="vision-onboarding-dialog" aria-labelledby={`vision-${role}-onboarding-title`}>
        <form method="dialog">
          <p className="eyebrow">Revisitable onboarding</p>
          <h2 id={`vision-${role}-onboarding-title`}>{guide.title}</h2>
          <p>{guide.introduction}</p>
          <ol>
            {guide.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <h3>Privacy boundary</h3>
          <p>{guide.privacy}</p>
          <div className="vision-onboarding-actions">
            <button type="submit">Close for now</button>
            <button type="submit">Skip this guide</button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
