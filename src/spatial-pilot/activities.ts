export const activityStates = [
  "Not started",
  "In progress",
  "Passed",
  "Failed",
  "Not supported",
  "Not tested",
  "Requires owner judgment",
] as const;
export const pilotActivities = [
  {
    id: "opening",
    title: "The navigator’s invitation",
    detail: "Open the adventure. Read the bottle’s message and continue to the Living Chart.",
    destination: "journal",
  },
  {
    id: "chart",
    title: "Explore the Lantern Isles",
    detail:
      "Inspect the three released marks. Find the loft and the current objective using desktop and phone controls.",
    destination: "journal",
  },
  {
    id: "lens",
    title: "Read the parchment in space",
    detail:
      "At The desk that waited, open Chronicle Lens, inspect the navigator’s parchment, then use Guided View. Record which provider was actually available.",
    destination: "journal",
  },
  {
    id: "pair",
    title: "Bring a phone aboard",
    detail:
      "Sign into the same synthetic navigator account on your phone. On desktop open Voyage devices, name the desktop, Use this device, then Connect another device. Use the pairing link or code on the phone. Do not create another Player.",
    destination: "devices",
  },
  {
    id: "transfer",
    title: "Pass the chart",
    detail:
      "During Carry the course to the lighthouse, open Chart then close the drawer. Open Send to…, choose the phone and Continue there, then Send view. Choose Receive on the phone. Confirm its chart opens before calling the transfer successful.",
    destination: "journal",
  },
  {
    id: "compass",
    title: "Read the northern light",
    detail:
      "At The northern light open Morrow’s compass in the Journal ribbon. Consent to optional heading only if desired. Compare live heading and its stated reference with the screen compass rose. The screen path always remains available.",
    destination: "journal",
  },
  {
    id: "recover",
    title: "Weather a separation",
    detail:
      "Optional: leave the phone Journal. Wait for disconnected presence (allow about 45 seconds), Recover view here on desktop, then reopen the phone Journal. Verify the recovered chart and unchanged story progress.",
    destination: "journal",
  },
  {
    id: "ending",
    title: "Keep the promise",
    detail:
      "Continue to the harbor reveal and ending. Leave and return. Check completion and this exact published edition remain preserved.",
    destination: "journal",
  },
  {
    id: "studio",
    title: "Inspect the authored scene",
    detail:
      "Explore Guided, Detailed, and Engineering modes, Spatial Library, selected parchment inspector, hierarchy, behaviors, canvas and phone/remote previews. Do not overwrite the published edition.",
    destination: "studio",
  },
  {
    id: "reach",
    title: "Find the hand",
    detail:
      "Open Reach. Check permission and webcam, hand visibility, nine-target training, then independent held-out targets. Test accuracy, jitter, different hand positions and distances, lighting and background, loss/reacquisition, interruption and manual controls. Reach estimates pointing; it does not select Chronicle objects.",
    destination: "reach",
  },
  {
    id: "timing",
    title: "Qualify physical timing",
    detail:
      "Targets: ≤3% display-diagonal pointing error, ≤1% jitter, ≤120 ms p95 exposure-to-visible latency. Reach’s inference/observation timing is software timing. Exposure-to-visible requires independently measured camera exposure and display timing; leave Not tested unless actually measured. Keep raw imagery out of the report.",
    destination: "reach",
  },
  {
    id: "feedback",
    title: "One final experience judgment",
    detail:
      "Record whether the story, chart, spatial clue, transfer, recovery and calibration were understandable, responsive, polished and immersive. Export one report. Physical Reach and real-device acceptance remain pending until you actually test them.",
    destination: "none",
  },
] as const;
