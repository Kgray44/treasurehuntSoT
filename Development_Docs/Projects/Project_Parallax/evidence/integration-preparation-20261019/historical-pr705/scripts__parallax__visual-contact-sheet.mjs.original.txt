import sharp from "sharp";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Evidence presentation only: retain every original rendered screenshot unchanged.
const root = path.resolve("Experience_Images/Spatial_Studio_20261011");
const manifest = JSON.parse(await readFile(path.join(root, "captures.json"), "utf8"));
const selected = [
  "02-guided-desktop.png",
  "03-detailed-desktop.png",
  "04-engineering-desktop.png",
  "05-scene-preview.png",
  "10-tablet.png",
  "11-phone.png",
  "12-reusable-library.png",
  "13-restricted.png",
].map((file) => manifest.captures.find((c) => c.file === file));
const width = 1000,
  height = 1550;
const composites = [];
for (const [index, capture] of selected.entries()) {
  const original = sharp(path.join(root, capture.file));
  const dimensions = await original.metadata();
  const responsive = ["10-tablet.png", "11-phone.png"].includes(capture.file);
  const thumb = await (
    responsive
      ? original.extract({ left: 0, top: 0, width: dimensions.width, height: Math.min(dimensions.height, 1600) })
      : original
  )
    .resize({ width: width - 32, height: height - 120, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
  const metadata = await sharp(thumb).metadata();
  const title = capture.title.split(":")[0].slice(0, 76).replaceAll("&", "&amp;");
  const label = Buffer.from(
    `<svg width="1000" height="95"><rect width="1000" height="95" fill="#152c36"/><text x="20" y="32" fill="#dfbd7c" font-family="sans-serif" font-size="23">${title}</text><text x="20" y="65" fill="#cedcd6" font-family="sans-serif" font-size="18">${capture.file} · ${responsive ? "top excerpt; full original in review index" : "original linked in review index"}</text></svg>`,
  );
  const left = (index % 2) * width,
    top = Math.floor(index / 2) * height + 90;
  composites.push(
    { input: label, left, top },
    { input: thumb, left: left + Math.floor((width - metadata.width) / 2), top: top + 105 },
  );
}
const heading = Buffer.from(
  `<svg width="2000" height="90"><rect width="2000" height="90" fill="#0b1c26"/><text x="24" y="36" fill="#e8efe8" font-family="sans-serif" font-size="28">Actual Spatial Studio · Owner review baseline · 11 October 2026</text><text x="24" y="65" fill="#dfbd7c" font-family="sans-serif" font-size="20">Source ${manifest.sourceSha} · synthetic persisted authoring · owner acceptance pending</text></svg>`,
);
await sharp({ create: { width: 2000, height: height * 4 + 90, channels: 4, background: "#0b1c26" } })
  .composite([{ input: heading, left: 0, top: 0 }, ...composites])
  .png()
  .toFile(path.join(root, "contact-sheet.png"));
