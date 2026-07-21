import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { PRIVATE_SENTINEL } from "./core";

const forbiddenPath = [
  /\.ftprivate$/i,
  /\.ftkey$/i,
  /(^|[\\/])(?:private-content|private-exports|decrypted-private-content)([\\/]|$)/i,
];
const forbiddenContent = [/aws_secret_access_key\s*=\s*\S+/i, new RegExp(PRIVATE_SENTINEL)];
const pemPrivateKey =
  /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----\s*(?:[A-Za-z0-9+/]{20,}={0,2}\s*)+-----END (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/m;
async function walk(root: string, files: string[] = []): Promise<string[]> {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if ([".git", "node_modules", ".next"].includes(entry.name) || entry.name.startsWith(".sealed-build")) continue;
    const candidate = path.join(root, entry.name);
    if (entry.isDirectory()) await walk(candidate, files);
    else files.push(candidate);
  }
  return files;
}
export async function scanPrivateContent(root = process.cwd()) {
  const hits: Array<{ path: string; rule: string }> = [];
  for (const file of await walk(root)) {
    const relative = path.relative(root, file);
    const implementationFile = /^(src|scripts|tests)[\\/].*private-content[\\/]/.test(relative);
    const nameRule = implementationFile ? undefined : forbiddenPath.find((rule) => rule.test(relative));
    if (nameRule) {
      hits.push({ path: relative, rule: "forbidden-path" });
      continue;
    }
    if (/\.(?:ts|tsx|js|json|md|env|txt)$/i.test(file)) {
      const text = await readFile(file, "utf8");
      const sentinelAllowed =
        /^(src|scripts|tests)[\\/].*private-content[\\/]|^Development_Docs[\\/]Private_Content_Test_Plan\.md$/.test(
          relative,
        );
      if (pemPrivateKey.test(text) || (!sentinelAllowed && forbiddenContent.some((rule) => rule.test(text))))
        hits.push({ path: relative, rule: "sensitive-content" });
    }
  }
  return hits;
}
export async function scanBuildOutput(
  root = process.env.NEXT_DIST_DIR
    ? path.resolve(process.cwd(), process.env.NEXT_DIST_DIR, "static")
    : path.join(process.cwd(), ".next", "static"),
) {
  try {
    const hits: Array<{ path: string; rule: string }> = [];
    for (const file of await walk(root)) {
      if (!/\.(?:js|map|html|json)$/i.test(file)) continue;
      const text = await readFile(file, "utf8");
      if (text.includes(PRIVATE_SENTINEL) || pemPrivateKey.test(text))
        hits.push({ path: path.relative(root, file), rule: "public-build-leak" });
    }
    return hits;
  } catch {
    return [];
  }
}
