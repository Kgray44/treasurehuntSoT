import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const root = ".runtime/embarkation/audit-repair";
const sha = async (p) =>
  createHash("sha256")
    .update(await fs.readFile(p))
    .digest("hex");
const paths = (await fs.readdir("src/animation/embarkation"))
  .filter((n) => /\.(ts|tsx|css)$/.test(n))
  .map((n) => `src/animation/embarkation/${n}`);
const sourceSha256 = Object.fromEntries(await Promise.all(paths.map(async (p) => [p, await sha(p)])));
const seal = `${root}/event-audio-source-20260929.json`;
let old;
try {
  old = JSON.parse(await fs.readFile(seal, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (old && JSON.stringify(old.sourceSha256) !== JSON.stringify(sourceSha256))
  throw new Error("Audio/film evidence predates current runtime; do not relabel it.");
if (!old) await fs.writeFile(seal, JSON.stringify({ sourceSha256 }, null, 2) + "\n");
const filmPath = `${root}/embarkation-event-audio-film-20260929.json`,
  nativePath = `${root}/embarkation-event-audio-native-20260929.json`;
const film = JSON.parse(await fs.readFile(filmPath, "utf8")),
  native = JSON.parse(await fs.readFile(nativePath, "utf8"));
const player = filmPath.replace(".json", ".html"),
  webm = `${root}/embarkation-event-audio-full-20260929.webm`,
  wav = webm.replace(".webm", ".wav");
execFileSync(process.execPath, ["scripts/refit/native-capture-player.mjs", filmPath, player, "0", webm, nativePath]);
const record = {
  classification: "engineering-evidence",
  status: "PARTIAL - auditory review and broader lifecycle matrix remain pending",
  auditIds: ["EMB-AUD-15", "EMB-AUD-19"],
  recordedAt: new Date().toISOString(),
  baseHead: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  sourceState: "Uncommitted owned candidate, no publication or owner acceptance.",
  sourceSha256,
  repairs: [
    "Retain continuous air/harbor beds; replace time-literal pass/collision loops with seeded procedural material transients. No third-party foley assets were needed.",
    "Outgoing cues follow the source anchor's zero-hold time and deformed anchor position. Snag contact uses measured collision time/velocity; strain spans actual hold; peel follows the released constraint. Pass position comes from the projected hero trajectory. Lens cues share LENS_IMPACTS; incoming catches read ArrivalPath capture times/velocities/positions.",
    "The film-time cursor schedules into AudioContext with bounded lookahead. Pause, mute, seek, replay and playback-rate changes cancel old voices and resume only unexpired tails. Transient retirement fades over 12 ms; final disposal disconnects nodes and closes the context.",
    "Global volume/mute still govern the master. The ambient handoff retains the same continuous sources and settled ocean/wood gain targets; reduced motion and return use only the calm bed.",
  ],
  recording: {
    film: {
      path: filmPath,
      sha256: await sha(filmPath),
      player,
      frames: film.frames.length,
      start: film.start,
      end: film.end,
      seconds: film.frames.at(-1).metadata.timestamp - film.frames[0].metadata.timestamp,
    },
    audio: {
      webm,
      webmSha256: await sha(webm),
      wav,
      wavSha256: await sha(wav),
      method:
        "Direct compressor output connected to MediaStreamAudioDestinationNode, recorded as Opus. Browser decode produced the archival WAV and signal measurements; no microphone/device loopback capture.",
      duration: native.duration,
      sampleRate: native.sampleRate,
      channels: native.channels,
      peak: native.peak,
      peakDbFS: 20 * Math.log10(native.peak),
      clippedSamples: native.clippedSamples,
    },
    native: {
      path: nativePath,
      sha256: await sha(nativePath),
      cues: native.cues.length,
      fired: native.fired.length,
      uniqueFired: new Set(native.fired.map((e) => e.id)).size,
      maximumCatchupOffset: Math.max(...native.fired.map((e) => e.offset)),
      seconds: native.seconds,
    },
  },
  validation: [
    "Full focused suite: 26 files / 103 tests passed; typecheck passed.",
    "Native 35.8 s film completed with 440 captured frames and roughly 43 s of video; 75.78 s direct audio includes about 40 s of living room ambience.",
    "All 91 event identities fired once in the uninterrupted run; no event required more than 50 ms of catch-up offset.",
    "Audio test enabled only ephemeral DOM preferences in the isolated 3148 fixture and restored their prior values; no persisted owner settings, crew/data or role mutations.",
  ],
  limitations: [
    "These are signal, timing and native execution measurements. No listening review or auditory quality acceptance is claimed.",
    "The evidence player aligns browser epoch clocks; MediaRecorder/codec/output latency is bounded but not measured sample-exact synchronization.",
    "Pause/mute/seek/rate/dispose and ambient gain continuity have focused transport/WebAudio-mock proof; complete native interruption, replay and preference-change matrix remains pending.",
    "Incoming capture velocities come from current physics. Later physical contact changes must regenerate cues/evidence, not retain duplicated old timestamps.",
    "Same-candidate production performance, responsive/input/renderer-fallback screening and remaining audit findings are still open.",
  ],
};
await fs.writeFile(
  "Development_Docs/Projects/Voyagewright_Refit_V1/embarkation/audit-event-audio.json",
  JSON.stringify(record, null, 2) + "\n",
);
console.log(`Recorded ${native.fired.length} unique-cue executions and ${native.duration}s of native audio.`);
