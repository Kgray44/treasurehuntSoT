import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { git } from "./plan.mjs";

export function classifyFormatting(findings, changed, blobs, baseline, version) {
  const config = Object.fromEntries(
    [...blobs].filter(([file]) =>
      /(?:^|\/)(?:\.editorconfig|\.prettierignore|\.prettierrc[^/]*|prettier\.config\.[^/]+)$/.test(file),
    ),
  );
  const configMatches =
    version === baseline.prettier &&
    Object.keys(config).length === Object.keys(baseline.config).length &&
    Object.entries(config).every(([path, blob]) => baseline.config[path] === blob);
  const debt = [];
  const violations = [];
  for (const file of findings) {
    const blob = blobs.get(file);
    const unchanged =
      !changed.has(file) && blob && Object.hasOwn(baseline.files, file) && baseline.files[file] === blob;
    (configMatches && unchanged ? debt : violations).push(file);
  }
  return { debt, violations };
}

export function checkFormatting({ tree, entries, full, paths }) {
  const prettier = "node_modules/prettier/bin/prettier.cjs";
  const execute = (args) => execFileSync(process.execPath, [prettier, ...args], { encoding: "utf8" });
  const findings = new Set();
  for (const part of paths) {
    try {
      execute(["--list-different", "--ignore-unknown", ...part]);
    } catch (error) {
      // Prettier reserves 1 for style differences and 2 for execution errors.
      if (error.status !== 1 || !error.stdout?.trim()) throw error;
      for (const path of error.stdout.trim().split(/\r?\n/)) findings.add(path.replaceAll("\\", "/"));
    }
  }
  let debt = [];
  let violations = [...findings];
  if (full) {
    const baseline = JSON.parse(readFileSync(new URL("./format-baseline.json", import.meta.url), "utf8"));
    const blobs = new Map(
      git(["ls-tree", "-rz", tree])
        .split("\0")
        .filter(Boolean)
        .map((row) => {
          const tab = row.indexOf("\t");
          return [row.slice(tab + 1), row.slice(0, tab).split(" ")[2]];
        }),
    );
    ({ debt, violations } = classifyFormatting(
      [...findings].filter((file) => blobs.has(file)),
      new Set(entries.map(({ file }) => file)),
      blobs,
      baseline,
      execute(["--version"]).trim(),
    ));
    console.log(
      "Unchanged formatting baseline findings (%d of %d recorded)",
      debt.length,
      Object.keys(baseline.files).length,
    );
    for (const file of debt) console.log("  " + file);
  }
  if (violations.length) throw new Error("Formatting violations:\n" + violations.join("\n"));
}
