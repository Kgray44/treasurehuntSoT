import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildPacket, packetMarkdown } from "./core.mjs";

const args = process.argv.slice(2);
const value = (name, fallback = null) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const input = JSON.parse(await readFile(value("--input"), "utf8"));
const output = value("--out-dir", ".agent-context");
const packet = buildPacket(process.cwd(), input);
await mkdir(output, { recursive: true });
const stem = (packet.task.id || "task").replace(/[^a-z0-9._-]/gi, "-");
await writeFile(path.join(output, `${stem}.packet.json`), `${JSON.stringify(packet, null, 2)}\n`);
await writeFile(path.join(output, `${stem}.packet.md`), packetMarkdown(packet));
await writeFile(path.join(output, `${stem}.ledger.json`), `${JSON.stringify(packet.ledgerTemplate, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      packet: path.join(output, `${stem}.packet.json`),
      markdown: path.join(output, `${stem}.packet.md`),
      ledger: path.join(output, `${stem}.ledger.json`),
      confidence: packet.confidence,
      pointerCount: packet.generator.pointerCount,
    },
    null,
    2,
  ),
);
