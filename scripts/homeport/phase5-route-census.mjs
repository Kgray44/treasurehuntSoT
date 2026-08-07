import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const sourceKinds = new Map([
  ["page.tsx", "page"],
  ["page.ts", "page"],
  ["route.ts", "route"],
  ["route.tsx", "route"],
  ["layout.tsx", "layout"],
  ["layout.ts", "layout"],
  ["not-found.tsx", "not-found"],
  ["not-found.ts", "not-found"],
  ["error.tsx", "error"],
  ["error.ts", "error"],
]);

function normalizeSourcePath(value) {
  return value.replaceAll("\\", "/");
}

function walk(directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute, files);
    else if (sourceKinds.has(entry.name)) files.push(absolute);
  }
  return files;
}

function segmentMetadata(segment) {
  if (/^\[\[\.\.\..+\]\]$/u.test(segment)) return { name: segment.slice(5, -2), kind: "optional-catch-all" };
  if (/^\[\.\.\..+\]$/u.test(segment)) return { name: segment.slice(4, -1), kind: "catch-all" };
  if (/^\[[^\]]+\]$/u.test(segment)) return { name: segment.slice(1, -1), kind: "dynamic" };
  return null;
}

function routeSegments(sourceFile) {
  const relative = normalizeSourcePath(sourceFile).replace(/^src\/app\/?/u, "");
  const directory = relative.split("/").slice(0, -1);
  return directory.filter((segment) => !/^\(.+\)$/u.test(segment) && !/^@/u.test(segment));
}

export function routePatternForSource(sourceFile) {
  const segments = routeSegments(sourceFile);
  return segments.length ? `/${segments.join("/")}` : "/";
}

export function discoverAppRouteSources(root = moduleRoot) {
  const appRoot = path.join(root, "src", "app");
  return walk(appRoot)
    .map((absolute) => {
      const sourceFile = normalizeSourcePath(path.relative(root, absolute));
      const basename = path.basename(absolute);
      const kind = sourceKinds.get(basename);
      const segments = routeSegments(sourceFile);
      return {
        sourceFile,
        kind,
        pathPattern: segments.length ? `/${segments.join("/")}` : "/",
        dynamicParameters: segments.map(segmentMetadata).filter(Boolean),
      };
    })
    .sort(
      (left, right) =>
        left.pathPattern.localeCompare(right.pathPattern) ||
        left.kind.localeCompare(right.kind) ||
        left.sourceFile.localeCompare(right.sourceFile),
    );
}

export function routeIdForSource(source) {
  const suffix = source.sourceFile
    .replace(/^src\/app\/?/u, "")
    .replace(/\/(?:page|route)\.tsx?$/u, "")
    .replace(/^(?:page|route)\.tsx?$/u, "root")
    .replace(/[^a-zA-Z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .toLowerCase();
  return `route-${source.kind}-${suffix || "root"}`;
}

export function censusSummary(sources) {
  const counts = Object.fromEntries([...sourceKinds.values()].map((kind) => [kind, 0]));
  for (const source of sources) counts[source.kind] += 1;
  return {
    sourceCount: sources.length,
    counts,
    humanRouteCount: counts.page,
    serviceRouteCount: counts.route,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sources = discoverAppRouteSources(process.cwd());
  process.stdout.write(`${JSON.stringify({ ...censusSummary(sources), sources }, null, 2)}\n`);
}
