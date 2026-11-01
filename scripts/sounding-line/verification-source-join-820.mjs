// Complete-tree equivalence for one original candidate plus accepted main.
// These observations grant no review credit, reuse, or release authority.
import { createHash } from "node:crypto";

export const HOMEPORT_820_REVIEW = "Development_Docs/Testing/Product_Experience/candidate-review.json";
export const HOMEPORT_820_PUBLICATION = "Development_Docs/Testing/Product_Experience/evidence/sc00a-20261031/";
export const SOURCE_JOIN_TREE_BYTES = 8 * 1024 * 1024;
const need = (condition, code) => {
  if (!condition) throw Error(`SOUNDING_LINE_VERIFICATION_SOURCE_JOIN_${code}`);
};
export function parseSourceJoinTree(bytes) {
  need(Buffer.isBuffer(bytes) && bytes.length <= SOURCE_JOIN_TREE_BYTES, "METADATA_BOUND");
  need(!bytes.length || bytes[bytes.length - 1] === 0, "METADATA_FRAME");
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    need(false, "METADATA_ENCODING");
  }
  const rows = text ? text.slice(0, -1).split("\0") : [];
  need(rows.length <= 100000, "PATH_BOUND");
  const entries = new Map();
  for (const row of rows) {
    const tab = row.indexOf("\t"),
      metadata = row.slice(0, tab),
      file = row.slice(tab + 1);
    const match = /^(100644|100755|120000) blob ([a-f0-9]{40})$/u.exec(metadata);
    need(tab > 0 && match && file && !entries.has(file), "METADATA_ENTRY");
    entries.set(file, [match[1], match[2]]);
  }
  return entries;
}
const same = (a, b) => a === b || Boolean(a && b && a[0] === b[0] && a[1] === b[1]);
const regular = (entry) => entry?.[0] === "100644";
export function verifySourceJoin820({ originalBase, originalCandidate, currentBase, candidate }) {
  const inputs = [originalBase, originalCandidate, currentBase, candidate];
  const [A, O, B, C] = inputs.map(parseSourceJoinTree);
  const paths = [...new Set([...A.keys(), ...O.keys(), ...B.keys(), ...C.keys()])];
  need(paths.length <= 100000, "PATH_BOUND");
  paths.sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
  const counts = { base: 0, original: 0, reviewReport: 0, newEvidence: 0 };
  const hash = createHash("sha256");
  let serializedBytes = 2;
  hash.update("[");
  for (let index = 0; index < paths.length; index++) {
    const file = paths[index],
      [a, o, b, c] = [A, O, B, C].map((m) => m.get(file));
    let rule;
    if (file === HOMEPORT_820_REVIEW) {
      need(regular(c), "REVIEW_MODE");
      rule = "reviewReport";
    } else if (file.startsWith(HOMEPORT_820_PUBLICATION) && !a && !o && !b) {
      const tail = file.slice(HOMEPORT_820_PUBLICATION.length);
      need(
        tail &&
          tail.length <= 1024 &&
          /^[A-Za-z0-9_./-]+$/u.test(tail) &&
          !tail.split("/").some((part) => !part || part === "." || part === ".."),
        "PUBLICATION_PATH",
      );
      need(regular(c), "EVIDENCE_MODE");
      rule = "newEvidence";
    } else if (same(a, o)) {
      need(same(c, b), "PROTECTED_BASE_DRIFT");
      rule = "base";
    } else {
      need(same(b, a) || same(b, o), "OVERLAP");
      need(same(c, o), "ORIGINAL_DRIFT");
      rule = "original";
    }
    counts[rule]++;
    const row = JSON.stringify([file, a ?? null, o ?? null, b ?? null, c ?? null, rule]);
    serializedBytes += Buffer.byteLength(row) + (index ? 1 : 0);
    need(serializedBytes <= 64 * 1024 * 1024, "TRANSCRIPT_BOUND");
    if (index) hash.update(",");
    hash.update(row);
  }
  hash.update("]");
  return Object.freeze({
    version: 1,
    digest: hash.digest("hex"),
    comparedPaths: paths.length,
    counts: Object.freeze(counts),
    qualification: false,
  });
}
