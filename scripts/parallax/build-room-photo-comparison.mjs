// Gallery of original application captures; it never draws replacement room geometry.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
const root = path.resolve(process.argv[2] ?? "");
const allowed = path.resolve("artifacts/parallax-a1/browser") + path.sep;
if (!root.startsWith(allowed)) throw new Error("Use an ignored task-owned browser artifact folder");
const read = (file) =>
  existsSync(path.join(root, file)) ? JSON.parse(readFileSync(path.join(root, file), "utf8")) : null;
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
  );
const records = [];
for (const model of ["gpt-6.1-sol", "gpt-6-astra"]) {
  const folder = `owner-photo-${model}`;
  const run = read(`${folder}-run.json`);
  if (!run || run.sourceBinding !== "VALID") throw new Error(`Missing valid completed capture: ${model}`);
  const ledger = read(`${folder}/safe-ledger.json`) ?? [];
  const dispatch = readFileSync(path.join(root, `${folder}-dispatch.jsonl`), "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  for (const mode of ["single", "two"]) {
    const result = read(`${folder}/${mode}-inference-result.json`);
    const room = result?.proposal?.room;
    const call = mode === "single" ? 1 : 2;
    const response = dispatch.find((entry) => entry.event === "RESPONSE" && entry.call === call);
    const reserved = dispatch.find((entry) => entry.event === "DISPATCH_RESERVED" && entry.call === call);
    const matching = ledger.filter(
      (entry) =>
        entry.inputTokens === response?.usage?.input_tokens && entry.outputTokens === response?.usage?.output_tokens,
    );
    const usage =
      ledger.find((entry) => entry.requestId === result?.proposal?.requestId) ??
      (matching.length === 1 ? matching[0] : null);
    const photo = `${folder}/${mode}-proposal-room-perspective.png`;
    const captured = existsSync(path.join(root, photo));
    records.push({
      model,
      photos: mode === "single" ? 1 : 2,
      candidate: run.candidate,
      result: result?.status ?? result?.code ?? "NO_RESULT",
      message: result?.message ?? result?.error ?? "",
      capture: captured ? photo : null,
      settledUsd: usage?.settledCostNano ? Number(usage.settledCostNano) / 1e9 : null,
      elapsedSeconds: response && reserved ? (Date.parse(response.utc) - Date.parse(reserved.utc)) / 1000 : null,
      dimensions: room ? [room.width, room.height, room.depth] : null,
      tables:
        room?.features
          .filter((feature) => ["TABLE", "DESK"].includes(feature.classification))
          .map((feature) => ({
            name: feature.name,
            position: feature.position,
            yawDegrees: feature.yawDegrees,
            dimensions: feature.dimensions,
            confidence: feature.provenance.confidence,
          })) ?? [],
    });
  }
}
const cards = records
  .map(
    (record) => `<article><h2>${escape(record.model)} · ${record.photos} photo${record.photos === 1 ? "" : "s"}</h2>
<p>${escape(record.result)}${record.settledUsd === null ? " · billing unresolved or unavailable" : ` · $${record.settledUsd.toFixed(5)} settled`}</p>
${record.capture ? `<a href="${escape(record.capture)}"><img src="${escape(record.capture)}" alt="Original ${escape(record.model)} ${record.photos}-photo application capture"></a>` : `<p>${escape(record.message || "No room capture was produced.")}</p>`}
<details><summary>Observed table transforms</summary><pre>${escape(JSON.stringify(record.tables, null, 2))}</pre></details></article>`,
  )
  .join("\n");
writeFileSync(
  path.join(root, "room-photo-model-comparison.json"),
  JSON.stringify(
    {
      records,
      limits:
        "One sample per model/photo count. Layout quality requires review against source photographs; geometric admission and browser success are not reconstruction accuracy or physical AR qualification.",
    },
    null,
    2,
  ),
);
writeFileSync(
  path.join(root, "room-photo-model-comparison.html"),
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sol / Astra room reconstruction comparison</title>
<style>body{font:16px system-ui;background:#0c1422;color:#e9efff;margin:24px}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}article{background:#172337;border:1px solid #405675;border-radius:16px;padding:16px}img{width:100%;height:auto}h2{font-size:20px}pre{white-space:pre-wrap;overflow-wrap:anywhere}a{color:#91bdff}@media(max-width:700px){main{grid-template-columns:1fr}}</style>
<h1>One photo vs two photos · Sol vs Astra</h1><p>Original authenticated Studio captures. All four cases use the same source, instructions and reconstruction checks. No manual room corrections.</p><p>Source: ${escape(records[0].candidate)}. One sample per case; a model winner across other rooms has not been established.</p><main>${cards}</main><p><a href="room-photo-model-comparison.json">Comparison data and limitations</a></p></html>`,
);
process.stdout.write("Comparison gallery saved in the task-owned browser artifact folder.\n");
