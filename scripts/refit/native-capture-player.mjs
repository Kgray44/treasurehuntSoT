import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// Replays original CDP frames at their recorded cadence. This is an evidence
// player, not an animation reconstruction or a synthetic viewport qualification.
const [input, output, skip = "0", audioFile, audioMetadata] = process.argv.slice(2);
if (!input || !output)
  throw new Error(
    "Usage: node scripts/refit/native-capture-player.mjs capture.json output.html [leadingFramesToExclude] [audio.webm audio-record.json]",
  );
const capture = JSON.parse(await readFile(resolve(input), "utf8"));
capture.frames = capture.frames.slice(Number(skip));
if (!capture.frames.length) throw new Error("No captured frames");
const payload = JSON.stringify(capture).replaceAll("<", "\\u003c");
const sound = audioFile
  ? {
      url: `data:audio/webm;base64,${(await readFile(resolve(audioFile))).toString("base64")}`,
      // Both timestamps are captured from this browser's monotonic/epoch clocks.
      // Encoder/output latency is not represented as exact sample synchronization.
      offset:
        capture.frames[0].metadata.timestamp -
        JSON.parse(await readFile(resolve(audioMetadata), "utf8")).startedAt / 1000,
    }
  : null;
await writeFile(
  resolve(output),
  `<!doctype html><html lang="en"><meta charset="utf-8">
<title>Embarkation native-frame evidence</title>
<style>body{margin:0;background:#071317;color:#f5e5c3;font:15px system-ui}header{padding:12px;display:flex;gap:14px;align-items:center;flex-wrap:wrap}button,select{font:inherit;padding:6px;background:#1b383f;color:inherit;border:1px solid #9d8a57;border-radius:5px}canvas{display:block;max-width:100%;height:auto;margin:auto}input{width:40vw}small{opacity:.75}</style>
<header><button id="play">Play</button><select id="rate" aria-label="Playback rate"><option value="1">1×</option><option value=".5">0.5×</option><option value=".25">0.25×</option></select><input type="range" min="0" step=".001" value="0" id="seek" aria-label="Capture time"><span id="time"></span><small>Native browser capture · ${sound ? "recorded audio bus · clock-aligned, bounded codec latency" : "silent diagnostic · original timestamps"}</small></header>
<canvas id="screen"></canvas><script>
const capture=${payload};
const sound=${JSON.stringify(sound)};
const audio=sound?new Audio(sound.url):null;if(audio)audio.preservesPitch=false;
const frames=capture.frames, start=frames[0].metadata.timestamp;
const duration=frames.at(-1).metadata.timestamp-start;
const canvas=document.querySelector('#screen'), context=canvas.getContext('2d');
const play=document.querySelector('#play'), rate=document.querySelector('#rate'), seek=document.querySelector('#seek'), label=document.querySelector('#time');
seek.max=duration;let running=false, position=0, previous=0, drawn=-1;const cache=new Map();
function imageAt(index){if(!cache.has(index)){const image=new Image();image.src='data:image/jpeg;base64,'+frames[index].data;cache.set(index,image);}return cache.get(index);}
function paint(){let index=frames.findLastIndex(frame=>frame.metadata.timestamp-start<=position);index=Math.max(0,index);for(let i=index;i<Math.min(frames.length,index+8);i++)imageAt(i);for(const key of cache.keys())if(key<index-2||key>index+12)cache.delete(key);const image=imageAt(index);if(image.complete&&image.naturalWidth&&index!==drawn){if(canvas.width!==image.naturalWidth){canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;}context.drawImage(image,0,0);drawn=index;}label.textContent=position.toFixed(3)+' / '+duration.toFixed(3)+' s';seek.value=position;}
function syncAudio(){if(!audio)return;audio.playbackRate=Number(rate.value);audio.currentTime=Math.max(0,position+sound.offset);if(running)audio.play().catch(()=>{running=false;play.textContent='Play';});else audio.pause();}
function tick(now){if(running&&previous){position+=audio&&!audio.paused?0:(now-previous)/1000*Number(rate.value);if(audio&&!audio.paused)position=Math.max(0,audio.currentTime-sound.offset);if(position>=duration){position=duration;running=false;audio?.pause();play.textContent='Replay';}}previous=now;paint();requestAnimationFrame(tick);}
play.onclick=()=>{if(position>=duration)position=0;running=!running;play.textContent=running?'Pause':'Play';syncAudio();};
seek.oninput=()=>{position=Number(seek.value);syncAudio();paint();};rate.onchange=syncAudio;requestAnimationFrame(tick);
</script></html>`,
  "utf8",
);
console.log(
  JSON.stringify({
    output: resolve(output),
    frames: capture.frames.length,
    excludedLeadingFrames: Number(skip),
    duration: capture.frames.at(-1).metadata.timestamp - capture.frames[0].metadata.timestamp,
  }),
);
