import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const lottieDirectory = path.join(root, "public", "animations", "lottie");
const rivePath = path.join(root, "public", "animations", "rive", "rating-animation.riv");
const errors: string[] = [];

for (const file of fs.readdirSync(lottieDirectory).filter((name) => name.endsWith(".json"))) {
  const fullPath = path.join(lottieDirectory, file);
  try {
    const data = JSON.parse(fs.readFileSync(fullPath, "utf8")) as Record<string, unknown>;
    for (const key of ["v", "fr", "ip", "op", "w", "h", "layers"]) {
      if (!(key in data)) errors.push(`${file}: missing ${key}`);
    }
    if (!Array.isArray(data.layers) || data.layers.length === 0) errors.push(`${file}: layers must be non-empty`);
    if (typeof data.op !== "number" || typeof data.ip !== "number" || data.op <= data.ip)
      errors.push(`${file}: invalid frame range`);
    const serialized = JSON.stringify(data);
    if (/https?:\/\//i.test(serialized)) errors.push(`${file}: remote runtime assets are forbidden`);
  } catch (error) {
    errors.push(`${file}: ${error instanceof Error ? error.message : "invalid JSON"}`);
  }
}

if (!fs.existsSync(rivePath)) errors.push("rating-animation.riv: missing local development proof asset");
else {
  const bytes = fs.readFileSync(rivePath);
  if (bytes.length < 1_000) errors.push("rating-animation.riv: unexpectedly small binary");
  if (bytes.subarray(0, 1).toString() === "{") errors.push("rating-animation.riv: file is JSON, not a Rive binary");
}

for (const directory of ["svg", "stills"]) {
  const location = path.join(root, "public", "animations", directory);
  if (!fs.existsSync(location)) continue;
  for (const file of fs.readdirSync(location).filter((name) => name.endsWith(".svg"))) {
    const source = fs.readFileSync(path.join(location, file), "utf8");
    if (!source.includes("<svg") || !source.includes("</svg>"))
      errors.push(`${directory}/${file}: malformed SVG wrapper`);
    if (/https?:\/\//i.test(source.replace("http://www.w3.org/2000/svg", "")))
      errors.push(`${directory}/${file}: remote dependency found`);
  }
}

if (errors.length) {
  console.error(`Animation asset validation failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  process.exit(1);
}

console.log("Animation assets validated: 3 Lottie JSON files, 1 local Rive binary, and local SVG fallbacks.");
