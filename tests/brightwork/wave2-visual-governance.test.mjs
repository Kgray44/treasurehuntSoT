import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const projectPath = (...segments) => path.join(root, ...segments);
const docsRoot = projectPath("Development_Docs", "Projects", "Voyagewright_Brightwork");
const registryPath = path.join(docsRoot, "Brightwork_Stage_8_Wave_2_Visual_Family_Registry.json");
const themePath = path.join(docsRoot, "Brightwork_Stage_8_Wave_2_Theme_Applicability.json");
const requiredFamilies = [
  "Gateway / public entry",
  "Authentication",
  "Player",
  "Journal",
  "Chronicle Passport",
  "Personal Harbor",
  "Captain",
  "Creator Studio",
  "Community Harbor",
  "Admiralty",
  "Invitation / ceremony",
  "Public Chronicle",
];
const requiredProperties = [
  "baseSurface",
  "elevatedSurface",
  "borderTreatment",
  "shadowTreatment",
  "radiusFamily",
  "foregroundHierarchy",
  "accentHierarchy",
  "controlTreatment",
  "compositionClass",
  "spacingRhythm",
  "stateComposition",
  "mobileStrategy",
  "themeApplicability",
];

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

test("Brightwork Wave 2 keeps each major visual family source-bound and semantically described", async () => {
  const registry = await readJson(registryPath);
  assert.equal(registry.protectedBaseSha, "969a9bfe222ecf65df132e7ee8af7d2cbb7ecf76");
  assert.deepEqual(registry.requiredProperties, requiredProperties);
  assert.deepEqual(
    registry.families.map((family) => family.family),
    requiredFamilies,
  );
  for (const family of registry.families) {
    for (const property of requiredProperties) assert.ok(family[property], `${family.family} is missing ${property}`);
    for (const source of family.referenceSources) await stat(projectPath(source));
  }
});

test("Brightwork Wave 2 has no unexplained theme state and matches the visual-family registry", async () => {
  const [registry, theme] = await Promise.all([readJson(registryPath), readJson(themePath)]);
  assert.deepEqual(Object.keys(theme.states), ["LIGHT_AND_DARK", "THEME_LOCKED_IMMERSIVE"]);
  assert.deepEqual(
    theme.families.map((family) => family.family),
    requiredFamilies,
  );
  for (const family of theme.families) {
    assert.ok(theme.states[family.applicability], `${family.family} has an unknown applicability state`);
    await stat(projectPath(family.source));
    assert.equal(
      registry.families.find((entry) => entry.family === family.family)?.themeApplicability,
      family.applicability,
    );
  }
});

test("Brightwork Wave 2 freezes shared semantic tokens and responsive hierarchy primitives", async () => {
  const [tokens, navigation, details, media, responsive] = await Promise.all([
    readFile(projectPath("src", "styles", "tokens.css"), "utf8"),
    readFile(projectPath("src", "navigation", "semantic-levels.ts"), "utf8"),
    readFile(projectPath("src", "components", "ui", "TechnicalDetails.tsx"), "utf8"),
    readFile(projectPath("src", "components", "ui", "ResilientImage.tsx"), "utf8"),
    readFile(projectPath("src", "brightwork", "responsive-recomposition.ts"), "utf8"),
  ]);
  for (const token of [
    "surface",
    "surface-elevated",
    "surface-inset",
    "border",
    "shadow",
    "foreground-primary",
    "foreground-muted",
    "accent",
    "accent-strong",
    "control-surface",
    "focus",
    "content-width",
  ]) {
    assert.match(tokens, new RegExp(`--semantic-${token}:`));
  }
  for (const level of ["GLOBAL", "PRODUCT", "SECTION", "CONTEXTUAL", "LONG_PAGE"]) {
    assert.match(navigation, new RegExp(`"${level}"`));
  }
  assert.match(details, /data-information-level="technical"/);
  assert.match(details, /data-responsive-recomposition/);
  assert.match(media, /"loading" \| "slow" \| "ready" \| "failed" \| "missing"/);
  assert.match(responsive, /"TABLE_TO_RECORD"/);
});
