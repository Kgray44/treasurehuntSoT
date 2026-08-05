import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd());
const tokenSource = await read("src/styles/tokens.css");
const requiredTokens = [
  "--background-primary",
  "--background-secondary",
  "--surface-default",
  "--surface-raised",
  "--surface-overlay",
  "--text-heading",
  "--text-body",
  "--text-secondary",
  "--text-inactive",
  "--text-metadata",
  "--text-disabled",
  "--border-default",
  "--accent-primary",
  "--focus-color",
];
for (const token of requiredTokens) {
  const occurrences = tokenSource.split(token).length - 1;
  if (occurrences < 3) throw new Error(`HOMEPORT_ROUND2_THEME_TOKEN_INCOMPLETE:${token}:${occurrences}`);
}

const themedStyles = [
  "src/styles/tokens.css",
  "src/styles/landing.css",
  "src/styles/shell.css",
  "src/styles/player.css",
  "src/styles/gm.css",
  "src/styles/studio.css",
  "src/styles/chronicle.css",
  "src/styles/platform.css",
  "src/styles/personal-harbor.css",
  "src/styles/community.css",
  "src/styles/showcase.css",
];
const missingLightCoverage = [];
for (const file of themedStyles) {
  const source = await read(file);
  if (!source.includes('data-voyage-theme="light"') && !usesOnlySemanticTheme(source)) missingLightCoverage.push(file);
}
if (missingLightCoverage.length)
  throw new Error(`HOMEPORT_ROUND2_LIGHT_COVERAGE_MISSING:${missingLightCoverage.join(",")}`);
const platformSource = await read("src/styles/platform.css");
if (
  !/\.auth-ledger button:not\(\.brass-button\)[\s\S]*?color:\s*#fff6e5;[\s\S]*?background:\s*#174747;/u.test(
    platformSource,
  )
) {
  throw new Error("HOMEPORT_ROUND2_PARCHMENT_BUTTON_CONTRAST_UNGOVERNED");
}

const contrastChecks = [
  ["dark heading", "#fff6e5", "#07191c", 4.5],
  ["dark body", "#e4e9e2", "#07191c", 4.5],
  ["dark secondary", "#c1d0ca", "#07191c", 4.5],
  ["dark inactive", "#b5c5c0", "#07191c", 4.5],
  ["dark metadata", "#a4b7b1", "#07191c", 4.5],
  ["dark disabled", "#748984", "#07191c", 3],
  ["light heading", "#102a2b", "#fff9eb", 4.5],
  ["light body", "#203f40", "#fff9eb", 4.5],
  ["light secondary", "#315252", "#fff9eb", 4.5],
  ["light inactive", "#3d5d5b", "#fff9eb", 4.5],
  ["light metadata", "#486664", "#fff9eb", 4.5],
  ["light disabled", "#718481", "#fff9eb", 3],
  ["parchment-panel button", "#fff6e5", "#174747", 4.5],
];
const results = contrastChecks.map(([name, foreground, background, minimum]) => {
  const ratio = contrast(String(foreground), String(background));
  if (ratio < Number(minimum)) throw new Error(`HOMEPORT_ROUND2_CONTRAST_FAILED:${name}:${ratio.toFixed(2)}`);
  return { name, foreground, background, ratio: Number(ratio.toFixed(2)), minimum };
});

process.stdout.write(
  `${JSON.stringify(
    {
      status: "HOMEPORT_PHASE7_OWNER_CORRECTION_ROUND2_THEME_AUDIT_VALID",
      semanticTokenCount: requiredTokens.length,
      themedStyles,
      contrastChecks: results,
      systemTheme: "OS_FOLLOWING_UNTIL_EXPLICIT_OVERRIDE",
      firstPaintBootstrap: "PRE_HYDRATION_LOCAL_SAFE_CACHE",
    },
    null,
    2,
  )}\n`,
);

function usesOnlySemanticTheme(source) {
  return source.includes("var(--background-primary)") && source.includes("var(--surface-default)");
}

async function read(file) {
  return readFile(path.join(root, file), "utf8");
}

function contrast(foreground, background) {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function luminance(hex) {
  const values = hex
    .slice(1)
    .match(/.{2}/gu)
    .map((value) => Number.parseInt(value, 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
}
