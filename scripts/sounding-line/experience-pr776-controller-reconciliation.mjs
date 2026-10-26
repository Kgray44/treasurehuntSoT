import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

// Eleven finite protected controller merges preserve one spent review; none grants another pass.
export const PR776_CONTROLLER = Object.freeze({
  kind: "PR776_CONTROLLER_BASE_RECONCILIATION_1",
  id: "pr776-attestation-buffer-reconciliation-20261025",
  oldBase: "819c992fb15ef0b87299ddaaed143427bd00a13d",
  ancestor: "7036562034b19a70d10bd0d87ea66d208af11d64",
  sourceDigest: "9f4af409dd681c5b984bef3a1c97b221db0e413a0bf386eb86bed79298617fb5",
  contractDigest: "7dc2911fb58ef2d1794bb7d2e28d7dd175a34fa82f89b0ff7e715ec55ddf8da3",
  captureArtifactId: 12585174268,
  captureRunId: 40155440070,
  captureDigest: "sha256:1a76a62659b1a0dab9d97925daaf97c88105a651c81ce6016a3ebfcb18af8216",
  canonicalSha256: "cc081df079b0e8a646eec071ef263f5c2261d14ea776b9185a39e5ffe4baadcb",
  reviewSha256: "2a689c7f2c3f404e22cb3e69418fbad41c062284a4917496b62ee2566a0e38df",
  planSha256: "bd0fd9565d87c050224a8c38b9f936d811884d305115f686609da0fddfa56850",
  inventorySha256: "215152c2e05fc3d06d950d13a0212737ff50f271a6cc826dd1ca42d455e0ee34",
});
export const PR776_TRANSPORT_PREDECESSOR = Object.freeze({
  base: "cbc3e643cc11c172983fb8f6f43036abda590182",
  baseParents: Object.freeze(["819c992fb15ef0b87299ddaaed143427bd00a13d", "b86fe3abd41daf21e62a7dc876653982fa42bbe4"]),
  baseTree: "2ae61a4350de4b530fb2668974f8a7b1e65511aa",
  candidate: "cfb1c0ef80f9244b73653c7b41dc063732262e2d",
  candidateParents: Object.freeze([
    "7036562034b19a70d10bd0d87ea66d208af11d64",
    "cbc3e643cc11c172983fb8f6f43036abda590182",
  ]),
  candidateTree: "e36b5d79f5067680d7376a83d9b41104d497796b",
  sourceDigest: "36cd7941da620b2fe417dcc99d74f6c13719dde9d6dea500777a75737f677c6f",
});
export const PR776_OBSERVABILITY_PREDECESSOR = Object.freeze({
  base: "e60d7db3b95c48c32306dd7682d4a132f3e54b3d",
  baseParents: Object.freeze(["cbc3e643cc11c172983fb8f6f43036abda590182", "8762a4fe31e78d00d3b09d8f4c411c81203cf379"]),
  baseTree: "e8870c4279956e63cf95608de077f1a368ac7e2b",
  candidate: "5669b2484ba44f38d0a96ce3895f98bb61fb9d1d",
  candidateParents: Object.freeze(["094331fc2defc8dabf4c0b4ba21ef0df7625b0e3"]),
  candidateTree: "cdfe106d91d6a7b8e12ad17f6b3b89f3f523a528",
  sourceDigest: "4f3baf77bb7a1d1b425da372f645527248b2f757adad9844c82c0e02d2465bda",
  canonicalSha256: "46e3f544db3f8472986b00d229f2662e901b7f6faf72ec38414c26847b4b80b0",
  canonicalBytes: 1451427,
  canonicalBlob: "14ad1d87c0b03064470896ff9a9d2b4ba90d4d2f",
  reviewArtifactId: 12593074243,
});
export const PR776_INTAKE_PREDECESSOR = Object.freeze({
  base: "dfc5887b42058acc396ab291a2cd5dca430b0d80",
  baseParents: Object.freeze(["e60d7db3b95c48c32306dd7682d4a132f3e54b3d", "1098dd6ce7d66f56fd2170e149ffdf7315a4a227"]),
  baseTree: "a6aaaf5678795dafac30bb355ee7fae2642ee03b",
  candidate: "5acc5b41aed5a59339cc17d82e118e5e38626048",
  candidateParents: Object.freeze(["14503876329bb0bfc82b77174c6cf86dab39d997"]),
  candidateTree: "59df5d8f49333919b6a58413be8d9ff9534244e8",
  sourceDigest: "46d5fddc6c6f9eab0b08267e619c4ad8d95314ac35c6fc3b812686ed19eb8483",
  canonicalSha256: "284d8266c66f27f2ac7202c97dbf1519d2c472ad71ce54edfb75d696479ac11e",
  canonicalBytes: 1451427,
  canonicalBlob: "2d07e6d486f36eaa6d3552e0db0da881b25806d7",
  reviewArtifactId: 12596534629,
});
export const PR776_PATH_CHECK_PREDECESSOR = Object.freeze({
  base: "c99ba71580b7950f64e9b7cb3a4a5ea4005c165c",
  baseParents: Object.freeze(["dfc5887b42058acc396ab291a2cd5dca430b0d80", "3b1a6d727a957d2e535a8757a8173e237772f368"]),
  baseTree: "515768341a62aceffdd3f8a2528745e4c6922b8f",
  candidate: "f91e7b8dfd2e62d7e511be49e7980e6d6e674b60",
  candidateParents: Object.freeze(["1ea929a86d5a6af852a2bad16afbaf0daa39b4ab"]),
  candidateTree: "2b6391e7dd8c0080be128b6049bdb9b39919186f",
  sourceDigest: "3d7e6a64a56a560f3a9b1bd8f376da0bde01381d4d984bb32129615152b5c3a1",
  canonicalSha256: "76d5923178e17dd509521945d5498c89c299d28e879773b698a8fdeeb4e01e1f",
  canonicalBytes: 1451427,
  canonicalBlob: "8c93b89036d697145f183b815749cc49b8ef060f",
  reviewArtifactId: 12601724319,
});
export const PR776_SQLITE_PREDECESSOR = Object.freeze({
  base: "696ecec0fd89293074b271ab33d9256709158700",
  baseParents: Object.freeze(["c99ba71580b7950f64e9b7cb3a4a5ea4005c165c", "148d9e4064706ad52c52ee3c9b218fe6af87f122"]),
  baseTree: "5a1c6a629969753d736ca9d23bbf900b53bdd85f",
  candidate: "e321c2465b9b0c166cbdbc6e9a88f57c89c7ff1a",
  candidateParents: Object.freeze(["44c62f08bc801f480dfa6765701aeb4106155649"]),
  candidateTree: "75352e35df8f1c3b516ac33a0d729a62a3ea5097",
  sourceDigest: "c96093f63889b4c0a33c6d7580d895e8f00b6c1de7a15d6dc6036dacc5b504ad",
  canonicalSha256: "1015945c5520605fe3271a03f2e4e03b557ba30795b540d82a8d1372f7310d9b",
  canonicalBytes: 1451427,
  canonicalBlob: "b705d68d183335dbf5f8e7d2292eb900a14e3e10",
  reviewArtifactId: 12606664876,
});
export const PR776_READER_PREDECESSOR = Object.freeze({
  base: "85815909abb922c13cdf2a729f21a30e5b58ee9b",
  baseParents: Object.freeze(["696ecec0fd89293074b271ab33d9256709158700", "fcbbe534f7dd4c914f3c01a10d77d9c64c497d8d"]),
  baseTree: "3917c7d7ec26a27bd3f65e2611f4df94519ff577",
  candidate: "1bf8dbda68161d743f305db9de6d44c6b925eb93",
  candidateParents: Object.freeze(["d2bbae32523fb464587ad46c55a234df82dba1d6"]),
  candidateTree: "6d3a4c2f6651eddd5befbf6499d3b26f4b1412c8",
  sourceDigest: "790e837d9522c14f0cc88929267a35e9fd440e1580733b8fdb90294444827fa2",
  canonicalSha256: "a9c6f938d52e46e7980f50035751b5249b70458e9f11d3442a4979eada7a34eb",
  canonicalBytes: 1451427,
  canonicalBlob: "3d09aa5ce1340742d9486ec0a7df925ad4ae888e",
  reviewArtifactId: 12611315114,
});
export const PR776_FINAL_BUDGET_PREDECESSOR = Object.freeze({
  base: "1229d4c549160ed72d159c0b708a11352e2f0599",
  baseParents: Object.freeze(["85815909abb922c13cdf2a729f21a30e5b58ee9b", "ab178e3aa844afdfa9f782d446aaebc08a6eaabd"]),
  baseTree: "183d5193ea3d649cb2d1c53be09b3d4fbe5b4d81",
  candidate: "1faf8e5586fec56c6c7073768ba7cc5132776b93",
  candidateParents: Object.freeze(["aae3f42868829a7637bbf3fedc342964e0f21a08"]),
  candidateTree: "d4b0db03d8109aa71e6c5ceeb93862d9ab90e1d3",
  sourceDigest: "72471cfc3b11bd8c27894c0169d237465658ad7c90212b8907ffb3b00e7449c1",
  canonicalSha256: "c1d3b5dde0983a8e74dd2f0bb70aac8ecf8e51063bcf6563f99cecb77c946479",
  canonicalBytes: 1451427,
  canonicalBlob: "e3ec035e84b7512ab7f54bc791a356105e428524",
  reviewArtifactId: 12614235180,
});
export const PR776_GENERIC_BUDGET_PREDECESSOR = Object.freeze({
  base: "e42ee150b8aec488eaa4c0521f55b2d9d092e983",
  baseParents: Object.freeze(["1229d4c549160ed72d159c0b708a11352e2f0599", "e062f73eaf96831e0a08fbf18e81764503261f28"]),
  baseTree: "39a38f63394a5e5104c1b5b349970153ccae5f66",
  candidate: "097745ac200d6c5f3f8075e86d6ace397693ddbc",
  candidateParents: Object.freeze(["ae5ec15c5b28d66d73865dc441620798f56db79d"]),
  candidateTree: "36c4cc68d1d944e8eab6542584e3d2bc90d2329d",
  sourceDigest: "6ea8e8dadbe9dfab7f50140bbf967cdeb34f0715312994c17587d3706720e956",
  canonicalSha256: "b2f1f313d270f8e8ea26e5cfd54b34d2336529fa4e0a60b6b54a898a7f937fb2",
  canonicalBytes: 1451427,
  canonicalBlob: "cf3c9c5968fcd364c4d49b7718c113e81a731165",
  reviewArtifactId: 12617234771,
});
export const PR776_FIXTURE_SCOPE_PREDECESSOR = Object.freeze({
  base: "03fbcb52bdd3f28f7ce7c029355a07fac6e2f3ce",
  baseParents: ["e42ee150b8aec488eaa4c0521f55b2d9d092e983", "59d947be442768c0436d961f4ca40783c070dd25"],
  baseTree: "0c104fe936fe7f776d17c9a4aae38b1895bac2ff",
  candidate: "bb7572b21ad43b0c5b4d47b52b182f4e2fa46b33",
  candidateParents: ["d86ac5063ef22664e476bfff332e83dba59e34d0"],
  candidateTree: "1c67e1a6531a7bbd80bc5db692508a708d9bdbd4",
  sourceDigest: "3c84696521d4d5215b513495b3d665149307e1d6c09573f3f7da2a851a899f2c",
  canonicalSha256: "75715b94e8a220ba2df6df900a77a21d46d9e8a3bc8e5d1eaf425f33192718ed",
  canonicalBytes: 1451427,
  canonicalBlob: "2b361086a7d5a96bef1002c3d196153fd130fdfc",
  reviewArtifactId: 12626102983,
});
export const PR776_AUTH_REUSE_PREDECESSOR = Object.freeze({
  base: "2a5afb348ed35dd55a96a8f38c098be70bada149",
  baseParents: ["03fbcb52bdd3f28f7ce7c029355a07fac6e2f3ce", "d12ca27a2909a6a276b3fc08e387dd1feed7e9bb"],
  baseTree: "6e88a9956d03256ea404dbdd37408eb292a99a8f",
  candidate: "c7eb5872a76d3704aa80fdd49fb98ac02f802ab9",
  candidateParents: ["31edda9d24ab0631924edd3b6f23869f873b6297"],
  candidateTree: "e2d64cfa1c0ee08a80d40fb614c3b1c1ac595465",
  sourceDigest: "556d8da1bc9e7a1468c803ddeebe2f7e1bb69fc535401ef59c5191f6557e5eb6",
  canonicalSha256: "5c4ebfa6976da56470be5f87dd797877b113a8be910b1e7406ef1116c6515134",
  canonicalBytes: 1451427,
  canonicalBlob: "abbb6e9321dbb9ff17803c53bf8d784eeebc51b1",
  reviewArtifactId: 12656314378,
});
export const PR776_FIXTURE_SCOPE_PATHS = Object.freeze([
  "tests/e2e/parallax-environment-creation.spec.ts",
  "tests/e2e/parallax-photo-feedback.spec.ts",
  "tests/e2e/parallax-room-photo.spec.ts",
  "tests/e2e/parallax-owner-room-photo.spec.ts",
  "tests/e2e/parallax-groups.spec.ts",
  "tests/e2e/parallax-tracking-recovery.spec.ts",
  "tests/e2e/parallax-workstation.spec.ts",
  "tests/e2e/parallax-asset-quality.spec.ts",
  "tests/e2e/parallax-sc02-experience.spec.ts",
]);
const E = "Development_Docs/Testing/Product_Experience/Engineering/pr776-controller-reconciliation-20261025";
const C = "Development_Docs/Testing/Product_Experience/candidate-review.json";
const INDEX = "Development_Docs/document-index.json";
const MATRIX = "Development_Docs/Programs/Other/Ledgerlight/Project_Ledgerlight_Documentation_Migration_Matrix.csv";
const originals = [
  "accepted-canonical.original.json",
  "independent-review.original.json",
  "captured-plan.original.json",
  "public-files-941.original.json",
].map((name) => `${E}/${name}`);
export const PR776_RECORD_PATH = `${E}/controller-reconciliation.json`;
export const PR776_CONTROLLER_PATHS = Object.freeze([
  "tests/e2e/spatial-chronicle-pilot.spec.ts",
  "scripts/sounding-line/browser-authority.mjs",
  ".prettierignore",
  "scripts/sounding-line/experience-pr776-controller-reconciliation.mjs",
  "scripts/sounding-line/experience-reviewed-adoption.mjs",
  "scripts/sounding-line/product-experience.mjs",
  "scripts/sounding-line/experience-prepare.mjs",
  "scripts/sounding-line/experience-attestation.mjs",
  "tests/sounding-line/experience-pr776-controller-reconciliation.test.mjs",
  "tests/sounding-line/experience-attestation.test.mjs",
  "tests/sounding-line/experience-paired.test.mjs",
  "scripts/sounding-line/experience-selected-checkout.mjs",
  "scripts/sounding-line/experience-checkout-hydration.mjs",
  "scripts/sounding-line/experience-pr776-checkout-profile.mjs",
  ".github/workflows/sounding-line-ordinary.yml",
  "tests/sounding-line/experience-pr776-checkout.test.mjs",
  "scripts/sounding-line/ordinary.mjs",
  "scripts/sounding-line/verification-diagnostics.mjs",
  "tests/sounding-line/browser-diagnostics.test.mjs",
  "tests/sounding-line/experience-r25.test.mjs",
  "tests/sounding-line/experience-r26.test.mjs",
  "scripts/sounding-line/authenticated-completed-evidence.mjs",
  "tests/sounding-line/authenticated-completed-evidence.test.mjs",
  "tests/sounding-line/ordinary.test.mjs",
  "scripts/sounding-line/sqlite-bootstrap.mjs",
  ...originals,
  PR776_RECORD_PATH,
  INDEX,
  MATRIX,
]);
export const PR776_TRANSPORT_REPAIR_PATHS = Object.freeze([
  "scripts/sounding-line/experience-pr776-controller-reconciliation.mjs",
  "tests/sounding-line/experience-pr776-controller-reconciliation.test.mjs",
  PR776_RECORD_PATH,
  "scripts/sounding-line/experience-selected-checkout.mjs",
  "scripts/sounding-line/experience-checkout-hydration.mjs",
  "scripts/sounding-line/experience-pr776-checkout-profile.mjs",
  ".github/workflows/sounding-line-ordinary.yml",
  "tests/sounding-line/experience-pr776-checkout.test.mjs",
]);
export const PR776_OBSERVABILITY_ADDED_PATHS = Object.freeze([
  "scripts/sounding-line/ordinary.mjs",
  "scripts/sounding-line/verification-diagnostics.mjs",
  "tests/sounding-line/browser-diagnostics.test.mjs",
  "tests/sounding-line/experience-r25.test.mjs",
  "tests/sounding-line/experience-r26.test.mjs",
]);
export const PR776_OBSERVABILITY_REPAIR_PATHS = Object.freeze([
  "scripts/sounding-line/experience-pr776-controller-reconciliation.mjs",
  "tests/sounding-line/experience-pr776-controller-reconciliation.test.mjs",
  "Development_Docs/Testing/Product_Experience/Engineering/pr776-controller-reconciliation-20261025/controller-reconciliation.json",
  "scripts/sounding-line/ordinary.mjs",
  "scripts/sounding-line/verification-diagnostics.mjs",
  "scripts/sounding-line/experience-attestation.mjs",
  "tests/sounding-line/browser-diagnostics.test.mjs",
  "tests/sounding-line/experience-r25.test.mjs",
  "tests/sounding-line/experience-r26.test.mjs",
]);
export const PR776_INTAKE_ADDED_PATHS = Object.freeze([
  "scripts/sounding-line/authenticated-completed-evidence.mjs",
  "tests/sounding-line/authenticated-completed-evidence.test.mjs",
]);
export const PR776_INTAKE_REPAIR_PATHS = Object.freeze([
  "scripts/sounding-line/experience-pr776-controller-reconciliation.mjs",
  "tests/sounding-line/experience-pr776-controller-reconciliation.test.mjs",
  "Development_Docs/Testing/Product_Experience/Engineering/pr776-controller-reconciliation-20261025/controller-reconciliation.json",
  "scripts/sounding-line/ordinary.mjs",
  "scripts/sounding-line/authenticated-completed-evidence.mjs",
  "scripts/sounding-line/verification-diagnostics.mjs",
  "tests/sounding-line/authenticated-completed-evidence.test.mjs",
]);
export const PR776_PATH_CHECK_ADDED_PATHS = Object.freeze(["tests/sounding-line/ordinary.test.mjs"]);
export const PR776_PATH_CHECK_REPAIR_PATHS = Object.freeze([
  "scripts/sounding-line/experience-pr776-controller-reconciliation.mjs",
  "tests/sounding-line/experience-pr776-controller-reconciliation.test.mjs",
  "Development_Docs/Testing/Product_Experience/Engineering/pr776-controller-reconciliation-20261025/controller-reconciliation.json",
  "scripts/sounding-line/ordinary.mjs",
  "tests/sounding-line/ordinary.test.mjs",
]);
export const PR776_SQLITE_ADDED_PATHS = Object.freeze(["scripts/sounding-line/sqlite-bootstrap.mjs"]);
export const PR776_SQLITE_REPAIR_PATHS = Object.freeze([
  "scripts/sounding-line/experience-pr776-controller-reconciliation.mjs",
  "tests/sounding-line/experience-pr776-controller-reconciliation.test.mjs",
  PR776_RECORD_PATH,
  "scripts/sounding-line/sqlite-bootstrap.mjs",
  "tests/sounding-line/ordinary.test.mjs",
]);
export const PR776_READER_REPAIR_PATHS = Object.freeze([
  "scripts/sounding-line/experience-pr776-controller-reconciliation.mjs",
  "tests/sounding-line/experience-pr776-controller-reconciliation.test.mjs",
  PR776_RECORD_PATH,
  "scripts/sounding-line/experience-pr776-checkout-profile.mjs",
  "tests/sounding-line/experience-pr776-checkout.test.mjs",
]);
export const PR776_FINAL_BUDGET_REPAIR_PATHS = Object.freeze([
  "tests/sounding-line/experience-r25.test.mjs",
  "tests/sounding-line/experience-r26.test.mjs",
  "scripts/sounding-line/experience-pr776-controller-reconciliation.mjs",
  "tests/sounding-line/experience-pr776-controller-reconciliation.test.mjs",
  PR776_RECORD_PATH,
  ".github/workflows/sounding-line-ordinary.yml",
  "tests/sounding-line/experience-pr776-checkout.test.mjs",
]);
export const PR776_GENERIC_BUDGET_ADDED_PATHS = Object.freeze([
  "scripts/sounding-line/browser-authority.mjs",
  "tests/e2e/spatial-chronicle-pilot.spec.ts",
]);
export const PR776_GENERIC_BUDGET_REPAIR_PATHS = Object.freeze([
  "tests/e2e/spatial-chronicle-pilot.spec.ts",
  "scripts/sounding-line/experience-pr776-controller-reconciliation.mjs",
  "tests/sounding-line/experience-pr776-controller-reconciliation.test.mjs",
  PR776_RECORD_PATH,
  "scripts/sounding-line/browser-authority.mjs",
  "tests/sounding-line/ordinary.test.mjs",
]);
export const PR776_FIXTURE_SCOPE_REPAIR_PATHS = Object.freeze([
  "scripts/sounding-line/experience-pr776-controller-reconciliation.mjs",
  "tests/sounding-line/experience-pr776-controller-reconciliation.test.mjs",
  PR776_RECORD_PATH,
]);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const stable = (value) =>
  JSON.stringify(value, (_, item) =>
    item && !Array.isArray(item) && typeof item === "object"
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );
const same = (a, b) => stable(a) === stable(b);
const need = (value, code) => {
  if (!value) throw new Error(`PRODUCT_EXPERIENCE_PR776_CONTROLLER_RECONCILIATION_${code}`);
};
const git = (root, args) =>
  execFileSync("git", ["--no-replace-objects", "--no-optional-locks", "-C", root, ...args], {
    maxBuffer: 16 * 1024 * 1024,
    timeout: 30000,
  });
const text = (read, root, args) => read(root, args).toString().trim();
const readRevision = (read, root, revision, file) => read(root, ["show", `${revision}:${file}`]);
const tree = (read, root, revision) =>
  new Map(
    read(root, ["ls-tree", "-rz", revision])
      .toString()
      .split("\0")
      .filter(Boolean)
      .map((row) => {
        const [meta, file] = row.split("\t");
        return [file, meta];
      }),
  );
const paths = (read, root, before, after) =>
  text(read, root, ["diff", "--name-only", "--no-renames", before, after]).split("\n").filter(Boolean).sort();
const exactPaths = (a, b) => same([...a].sort(), [...b].sort());
export const isPR776ControllerReconciliation = (plan) =>
  plan?.pr776ControllerReconciliation?.kind === PR776_CONTROLLER.kind;

function inspect({ root, plan, readGit = git }) {
  const p = PR776_CONTROLLER,
    read = readGit;
  need(plan.baseSha !== p.oldBase && plan.contractDigest === p.contractDigest, "SOURCE_IDENTITY");
  const parents = text(read, root, ["show", "-s", "--format=%P", plan.baseSha]).split(" ");
  const predecessor = PR776_TRANSPORT_PREDECESSOR,
    observed = PR776_OBSERVABILITY_PREDECESSOR,
    intake = PR776_INTAKE_PREDECESSOR,
    checked = PR776_PATH_CHECK_PREDECESSOR,
    sqlite = PR776_SQLITE_PREDECESSOR,
    reader = PR776_READER_PREDECESSOR,
    budget = PR776_FINAL_BUDGET_PREDECESSOR,
    genericBudget = PR776_GENERIC_BUDGET_PREDECESSOR,
    fixtureScope = PR776_FIXTURE_SCOPE_PREDECESSOR,
    authReuse = PR776_AUTH_REUSE_PREDECESSOR;
  const priorControllerPaths = PR776_CONTROLLER_PATHS.filter(
    (file) => !PR776_GENERIC_BUDGET_ADDED_PATHS.includes(file),
  );
  need(parents.length === 2 && parents[0] === authReuse.base, "ONE_NEXT_NORMAL_AUTH_SESSION_MERGE_REQUIRED");
  need(
    same(text(read, root, ["show", "-s", "--format=%P", predecessor.base]).split(" "), predecessor.baseParents) &&
      text(read, root, ["rev-parse", predecessor.base + "^{tree}"]) === predecessor.baseTree &&
      text(read, root, ["rev-parse", predecessor.baseParents[1] + "^{tree}"]) === predecessor.baseTree,
    "FROZEN_CONTROLLER_PREDECESSOR_CHANGED",
  );
  need(
    same(
      text(read, root, ["show", "-s", "--format=%P", predecessor.candidate]).split(" "),
      predecessor.candidateParents,
    ) && text(read, root, ["rev-parse", predecessor.candidate + "^{tree}"]) === predecessor.candidateTree,
    "FROZEN_CANDIDATE_PREDECESSOR_CHANGED",
  );

  need(
    same(text(read, root, ["show", "-s", "--format=%P", observed.base]).split(" "), observed.baseParents) &&
      text(read, root, ["rev-parse", observed.base + "^{tree}"]) === observed.baseTree &&
      text(read, root, ["rev-parse", observed.baseParents[1] + "^{tree}"]) === observed.baseTree &&
      exactPaths(paths(read, root, predecessor.base, observed.base), PR776_TRANSPORT_REPAIR_PATHS) &&
      exactPaths(
        paths(read, root, p.oldBase, observed.base),
        priorControllerPaths.filter(
          (file) =>
            !PR776_OBSERVABILITY_ADDED_PATHS.includes(file) &&
            !PR776_INTAKE_ADDED_PATHS.includes(file) &&
            !PR776_PATH_CHECK_ADDED_PATHS.includes(file) &&
            !PR776_SQLITE_ADDED_PATHS.includes(file),
        ),
      ),
    "FROZEN_TRANSPORT_PREDECESSOR_CHANGED",
  );
  need(
    same(text(read, root, ["show", "-s", "--format=%P", observed.candidate]).split(" "), observed.candidateParents) &&
      text(read, root, ["rev-parse", observed.candidate + "^{tree}"]) === observed.candidateTree,
    "FROZEN_OBSERVABILITY_CANDIDATE_CHANGED",
  );
  need(
    same(text(read, root, ["show", "-s", "--format=%P", intake.base]).split(" "), intake.baseParents) &&
      text(read, root, ["rev-parse", intake.base + "^{tree}"]) === intake.baseTree &&
      text(read, root, ["rev-parse", intake.baseParents[1] + "^{tree}"]) === intake.baseTree &&
      exactPaths(paths(read, root, observed.base, intake.base), PR776_OBSERVABILITY_REPAIR_PATHS) &&
      exactPaths(
        paths(read, root, p.oldBase, intake.base),
        priorControllerPaths.filter(
          (file) =>
            !PR776_INTAKE_ADDED_PATHS.includes(file) &&
            !PR776_PATH_CHECK_ADDED_PATHS.includes(file) &&
            !PR776_SQLITE_ADDED_PATHS.includes(file),
        ),
      ),
    "FROZEN_OBSERVABILITY_PREDECESSOR_CHANGED",
  );
  need(
    same(text(read, root, ["show", "-s", "--format=%P", intake.candidate]).split(" "), intake.candidateParents) &&
      text(read, root, ["rev-parse", intake.candidate + "^{tree}"]) === intake.candidateTree,
    "FROZEN_INTAKE_CANDIDATE_CHANGED",
  );
  need(
    same(text(read, root, ["show", "-s", "--format=%P", checked.base]).split(" "), checked.baseParents) &&
      text(read, root, ["rev-parse", checked.base + "^{tree}"]) === checked.baseTree &&
      text(read, root, ["rev-parse", checked.baseParents[1] + "^{tree}"]) === checked.baseTree &&
      exactPaths(paths(read, root, intake.base, checked.base), PR776_INTAKE_REPAIR_PATHS) &&
      exactPaths(
        paths(read, root, p.oldBase, checked.base),
        priorControllerPaths.filter(
          (file) => !PR776_PATH_CHECK_ADDED_PATHS.includes(file) && !PR776_SQLITE_ADDED_PATHS.includes(file),
        ),
      ),
    "FROZEN_INTAKE_PREDECESSOR_CHANGED",
  );
  need(
    same(text(read, root, ["show", "-s", "--format=%P", checked.candidate]).split(" "), checked.candidateParents) &&
      text(read, root, ["rev-parse", checked.candidate + "^{tree}"]) === checked.candidateTree,
    "FROZEN_PATH_CHECK_CANDIDATE_CHANGED",
  );
  need(
    same(text(read, root, ["show", "-s", "--format=%P", sqlite.base]).split(" "), sqlite.baseParents) &&
      text(read, root, ["rev-parse", sqlite.base + "^{tree}"]) === sqlite.baseTree &&
      text(read, root, ["rev-parse", sqlite.baseParents[1] + "^{tree}"]) === sqlite.baseTree &&
      exactPaths(paths(read, root, checked.base, sqlite.base), PR776_PATH_CHECK_REPAIR_PATHS) &&
      exactPaths(
        paths(read, root, p.oldBase, sqlite.base),
        priorControllerPaths.filter((file) => !PR776_SQLITE_ADDED_PATHS.includes(file)),
      ),
    "FROZEN_PATH_CHECK_PREDECESSOR_CHANGED",
  );
  need(
    same(text(read, root, ["show", "-s", "--format=%P", sqlite.candidate]).split(" "), sqlite.candidateParents) &&
      text(read, root, ["rev-parse", sqlite.candidate + "^{tree}"]) === sqlite.candidateTree,
    "FROZEN_SQLITE_CANDIDATE_CHANGED",
  );
  need(
    same(text(read, root, ["show", "-s", "--format=%P", reader.base]).split(" "), reader.baseParents) &&
      text(read, root, ["rev-parse", reader.base + "^{tree}"]) === reader.baseTree &&
      text(read, root, ["rev-parse", reader.baseParents[1] + "^{tree}"]) === reader.baseTree &&
      exactPaths(paths(read, root, sqlite.base, reader.base), PR776_SQLITE_REPAIR_PATHS) &&
      exactPaths(paths(read, root, p.oldBase, reader.base), priorControllerPaths),
    "FROZEN_SQLITE_PREDECESSOR_CHANGED",
  );
  need(
    same(text(read, root, ["show", "-s", "--format=%P", reader.candidate]).split(" "), reader.candidateParents) &&
      text(read, root, ["rev-parse", reader.candidate + "^{tree}"]) === reader.candidateTree,
    "FROZEN_READER_CANDIDATE_CHANGED",
  );
  need(
    same(text(read, root, ["show", "-s", "--format=%P", budget.base]).split(" "), budget.baseParents) &&
      text(read, root, ["rev-parse", budget.base + "^{tree}"]) === budget.baseTree &&
      text(read, root, ["rev-parse", budget.baseParents[1] + "^{tree}"]) === budget.baseTree &&
      exactPaths(paths(read, root, reader.base, budget.base), PR776_READER_REPAIR_PATHS) &&
      exactPaths(paths(read, root, p.oldBase, budget.base), priorControllerPaths),
    "FROZEN_READER_PREDECESSOR_CHANGED",
  );
  need(
    same(text(read, root, ["show", "-s", "--format=%P", budget.candidate]).split(" "), budget.candidateParents) &&
      text(read, root, ["rev-parse", budget.candidate + "^{tree}"]) === budget.candidateTree,
    "FROZEN_FINAL_BUDGET_CANDIDATE_CHANGED",
  );
  need(
    same(text(read, root, ["show", "-s", "--format=%P", genericBudget.base]).split(" "), genericBudget.baseParents) &&
      text(read, root, ["rev-parse", genericBudget.base + "^{tree}"]) === genericBudget.baseTree &&
      text(read, root, ["rev-parse", genericBudget.baseParents[1] + "^{tree}"]) === genericBudget.baseTree &&
      exactPaths(paths(read, root, p.oldBase, genericBudget.base), priorControllerPaths),
    "FROZEN_FINAL_BUDGET_PREDECESSOR_CHANGED",
  );
  need(
    exactPaths(paths(read, root, budget.base, genericBudget.base), PR776_FINAL_BUDGET_REPAIR_PATHS),
    "FINAL_BUDGET_REPAIR_CHANGED_PATHS",
  );
  need(
    same(
      text(read, root, ["show", "-s", "--format=%P", genericBudget.candidate]).split(" "),
      genericBudget.candidateParents,
    ) && text(read, root, ["rev-parse", genericBudget.candidate + "^{tree}"]) === genericBudget.candidateTree,
    "FROZEN_GENERIC_BUDGET_CANDIDATE_CHANGED",
  );
  need(
    same(text(read, root, ["show", "-s", "--format=%P", fixtureScope.base]).split(" "), fixtureScope.baseParents) &&
      text(read, root, ["rev-parse", fixtureScope.base + "^{tree}"]) === fixtureScope.baseTree &&
      text(read, root, ["rev-parse", fixtureScope.baseParents[1] + "^{tree}"]) === fixtureScope.baseTree &&
      exactPaths(paths(read, root, p.oldBase, fixtureScope.base), PR776_CONTROLLER_PATHS),
    "FROZEN_GENERIC_BUDGET_PREDECESSOR_CHANGED",
  );
  need(
    same(
      text(read, root, ["show", "-s", "--format=%P", fixtureScope.candidate]).split(" "),
      fixtureScope.candidateParents,
    ) && text(read, root, ["rev-parse", fixtureScope.candidate + "^{tree}"]) === fixtureScope.candidateTree,
    "FROZEN_FIXTURE_SCOPE_CANDIDATE_CHANGED",
  );
  need(
    same(text(read, root, ["show", "-s", "--format=%P", authReuse.base]).split(" "), authReuse.baseParents) &&
      text(read, root, ["rev-parse", authReuse.base + "^{tree}"]) === authReuse.baseTree &&
      text(read, root, ["rev-parse", authReuse.baseParents[1] + "^{tree}"]) === authReuse.baseTree &&
      exactPaths(paths(read, root, fixtureScope.base, authReuse.base), PR776_FIXTURE_SCOPE_REPAIR_PATHS),
    "FROZEN_AUTH_REUSE_PREDECESSOR_CHANGED",
  );
  need(
    same(text(read, root, ["show", "-s", "--format=%P", authReuse.candidate]).split(" "), authReuse.candidateParents) &&
      text(read, root, ["rev-parse", authReuse.candidate + "^{tree}"]) === authReuse.candidateTree,
    "FROZEN_AUTH_REUSE_CANDIDATE_CHANGED",
  );
  need(
    text(read, root, ["rev-parse", `${plan.baseSha}^{tree}`]) ===
      text(read, root, ["rev-parse", `${parents[1]}^{tree}`]),
    "QUALIFIED_HEAD_TREE_REQUIRED",
  );
  read(root, ["merge-base", "--is-ancestor", p.ancestor, plan.candidateSha]);
  read(root, ["merge-base", "--is-ancestor", predecessor.candidate, plan.candidateSha]);
  read(root, ["merge-base", "--is-ancestor", observed.candidate, plan.candidateSha]);
  read(root, ["merge-base", "--is-ancestor", intake.candidate, plan.candidateSha]);
  read(root, ["merge-base", "--is-ancestor", checked.candidate, plan.candidateSha]);
  read(root, ["merge-base", "--is-ancestor", sqlite.candidate, plan.candidateSha]);
  read(root, ["merge-base", "--is-ancestor", reader.candidate, plan.candidateSha]);
  read(root, ["merge-base", "--is-ancestor", budget.candidate, plan.candidateSha]);
  read(root, ["merge-base", "--is-ancestor", genericBudget.candidate, plan.candidateSha]);
  read(root, ["merge-base", "--is-ancestor", fixtureScope.candidate, plan.candidateSha]);
  read(root, ["merge-base", "--is-ancestor", authReuse.candidate, plan.candidateSha]);
  read(root, ["merge-base", "--is-ancestor", plan.baseSha, plan.candidateSha]);
  need(exactPaths(paths(read, root, p.oldBase, plan.baseSha), PR776_CONTROLLER_PATHS), "CONTROLLER_CHANGED_PATHS");
  need(
    exactPaths(paths(read, root, genericBudget.base, fixtureScope.base), PR776_GENERIC_BUDGET_REPAIR_PATHS),
    "GENERIC_BUDGET_REPAIR_CHANGED_PATHS",
  );
  need(
    exactPaths(paths(read, root, fixtureScope.base, plan.baseSha), PR776_FIXTURE_SCOPE_REPAIR_PATHS),
    "FIXTURE_SCOPE_REPAIR_CHANGED_PATHS",
  );
  need(
    exactPaths(paths(read, root, authReuse.base, plan.baseSha), PR776_FIXTURE_SCOPE_REPAIR_PATHS),
    "AUTH_REUSE_REPAIR_CHANGED_PATHS",
  );
  const recordBytes = readRevision(read, root, plan.baseSha, PR776_RECORD_PATH),
    record = JSON.parse(recordBytes);
  need(
    record.status === "ACTIVE" &&
      record.kind === p.kind &&
      record.id === p.id &&
      record.prNumber === 776 &&
      record.additionalIndependentPasses === 0 &&
      same(record.originalIdentity, p) &&
      same(record.transportPredecessor, predecessor) &&
      same(record.observabilityPredecessor, observed) &&
      same(record.intakePredecessor, intake) &&
      same(record.pathCheckPredecessor, checked) &&
      same(record.sqliteBootstrapPredecessor, sqlite) &&
      same(record.checkoutReaderPredecessor, reader) &&
      same(record.finalBudgetPredecessor, budget) &&
      same(record.genericBudgetPredecessor, genericBudget) &&
      same(record.fixtureScopePredecessor, fixtureScope) &&
      same(record.authReusePredecessor, authReuse),
    "FINITE_PROTECTED_RECORD",
  );
  need(
    exactPaths(
      Object.keys(record.requiredRepairBlobs ?? {}),
      PR776_CONTROLLER_PATHS.filter((file) => ![PR776_RECORD_PATH, INDEX, MATRIX].includes(file)),
    ),
    "REQUIRED_REPAIR_BLOBS",
  );
  need(
    /^[a-f0-9]{64}$/u.test(record.expectedCurrentSourceDigest ?? "") &&
      record.expectedCurrentSourceDigest !== p.sourceDigest &&
      plan.sourceDigest === record.expectedCurrentSourceDigest,
    "CURRENT_SOURCE_IDENTITY",
  );
  const baseTree = tree(read, root, plan.baseSha),
    candidateTree = tree(read, root, plan.candidateSha),
    oldTree = tree(read, root, p.ancestor);
  for (const [file, oid] of Object.entries(record.requiredRepairBlobs))
    need(
      /^[a-f0-9]{40}$/u.test(oid) &&
        baseTree.get(file) === `100644 blob ${oid}` &&
        candidateTree.get(file) === baseTree.get(file),
      "REPAIR_BLOB_CHANGED",
    );
  need(
    exactPaths(Object.keys(record.candidateFixtureBlobs ?? {}), PR776_FIXTURE_SCOPE_PATHS),
    "FIXTURE_SCOPE_EXACT_PATHS",
  );
  for (const [file, oid] of Object.entries(record.candidateFixtureBlobs))
    need(/^[a-f0-9]{40}$/u.test(oid) && candidateTree.get(file) === `100644 blob ${oid}`, "FIXTURE_SCOPE_BLOB_CHANGED");
  need(readRevision(read, root, plan.candidateSha, PR776_RECORD_PATH).equals(recordBytes), "RECORD_CHANGED");
  need(
    paths(read, root, p.ancestor, plan.candidateSha).every(
      (file) => PR776_CONTROLLER_PATHS.includes(file) || PR776_FIXTURE_SCOPE_PATHS.includes(file) || file === C,
    ),
    "UNRELATED_CANDIDATE_CHANGE",
  );
  const readOriginal = (index, digest) => {
    const bytes = readRevision(read, root, plan.baseSha, originals[index]);
    need(sha256(bytes) === digest, "ENGINEERING_ORIGINAL_CHANGED");
    return JSON.parse(bytes);
  };
  const canonical = readOriginal(0, p.canonicalSha256),
    review = readOriginal(1, p.reviewSha256),
    capturedPlan = readOriginal(2, p.planSha256),
    inventory = readOriginal(3, p.inventorySha256);
  need(
    capturedPlan.baseSha === p.oldBase &&
      capturedPlan.sourceDigest === p.sourceDigest &&
      capturedPlan.contractDigest === p.contractDigest &&
      same(plan.contracts, capturedPlan.contracts) &&
      same(plan.paired, capturedPlan.paired) &&
      same(plan.browserTests, capturedPlan.browserTests) &&
      plan.contextCount === 118 &&
      plan.genericContextCount === 112 &&
      plan.contracts.length === 32 &&
      !plan.debt.length &&
      !plan.uncertainty.length,
    "CAPTURED_OBLIGATIONS_CHANGED",
  );
  need(
    review.status === "ACCEPTED" &&
      canonical.reviews.length === 32 &&
      same(canonical.reviews, review.reviews) &&
      canonical.reviews.every((row) => row.status === "ACCEPTED") &&
      same(canonical.reviews.map((row) => row.iterations).sort(), [...Array(23).fill(2), ...Array(9).fill(4)]),
    "SPENT_REVIEW_CHANGED",
  );
  need(inventory.length === 941 && new Set(inventory.map((row) => row.path)).size === 941, "PUBLIC_941_INVENTORY");
  for (const row of inventory) {
    need(oldTree.get(row.path) === `100644 blob ${row.blob}`, "ORIGINAL_941_CHANGED");
    if (![C, INDEX, MATRIX].includes(row.path))
      need(candidateTree.get(row.path) === oldTree.get(row.path), "IMMUTABLE_EVIDENCE_CHANGED");
  }
  const addedPaths = [...originals, PR776_RECORD_PATH];
  const oldIndex = JSON.parse(readRevision(read, root, p.ancestor, INDEX)),
    baseIndex = JSON.parse(readRevision(read, root, plan.baseSha, INDEX)),
    currentIndex = JSON.parse(readRevision(read, root, plan.candidateSha, INDEX)),
    indexByPath = new Map(currentIndex.records.map((row) => [row.path, row])),
    oldIndexPaths = new Set(oldIndex.records.map((row) => row.path));
  need(
    oldIndex.records.every((row) => same(indexByPath.get(row.path), row)) &&
      currentIndex.records.length === oldIndex.records.length + addedPaths.length &&
      exactPaths(
        currentIndex.records.filter((row) => !oldIndexPaths.has(row.path)).map((row) => row.path),
        addedPaths,
      ) &&
      addedPaths.every((file) =>
        same(
          indexByPath.get(file),
          baseIndex.records.find((row) => row.path === file),
        ),
      ),
    "INDEX_ADDITIONS_ONLY",
  );
  const lines = (revision) => readRevision(read, root, revision, MATRIX).toString().trimEnd().split(/\r?\n/u),
    oldLines = lines(p.ancestor),
    currentLines = lines(plan.candidateSha),
    oldSet = new Set(oldLines),
    currentSet = new Set(currentLines),
    additions = currentLines.filter((line) => !oldSet.has(line));
  need(
    currentLines.length === currentSet.size &&
      oldLines.every((line) => currentSet.has(line)) &&
      additions.length === addedPaths.length &&
      exactPaths(
        additions.map((line) => /^"([^"]+)"/u.exec(line)?.[1]),
        addedPaths,
      ),
    "MATRIX_ADDITIONS_ONLY",
  );

  const predecessorCanonicalBytes = Buffer.from(
    JSON.stringify({ ...canonical, reviewArtifactId: observed.reviewArtifactId }, null, 2) + "\n",
  );
  need(
    tree(read, root, observed.candidate).get(C) === `100644 blob ${observed.canonicalBlob}` &&
      predecessorCanonicalBytes.length === observed.canonicalBytes &&
      sha256(predecessorCanonicalBytes) === observed.canonicalSha256,
    "FROZEN_PUBLISHED_CANONICAL_CHANGED",
  );
  const predecessorCanonical = JSON.parse(predecessorCanonicalBytes);
  need(predecessorCanonical.reviewArtifactId === observed.reviewArtifactId, "FROZEN_PUBLISHED_REVIEW_ID_CHANGED");
  delete predecessorCanonical.reviewArtifactId;
  need(same(predecessorCanonical, canonical), "FROZEN_PUBLISHED_CANONICAL_DATA_CHANGED");
  const intakeCanonicalBytes = Buffer.from(
    JSON.stringify({ ...canonical, reviewArtifactId: intake.reviewArtifactId }, null, 2) + "\n",
  );
  need(
    tree(read, root, intake.candidate).get(C) === `100644 blob ${intake.canonicalBlob}` &&
      intakeCanonicalBytes.length === intake.canonicalBytes &&
      sha256(intakeCanonicalBytes) === intake.canonicalSha256,
    "FROZEN_INTAKE_CANONICAL_CHANGED",
  );
  const intakeCanonical = JSON.parse(intakeCanonicalBytes);
  need(intakeCanonical.reviewArtifactId === intake.reviewArtifactId, "FROZEN_INTAKE_REVIEW_ID_CHANGED");
  delete intakeCanonical.reviewArtifactId;
  need(same(intakeCanonical, canonical), "FROZEN_INTAKE_CANONICAL_DATA_CHANGED");
  const checkedCanonicalBytes = Buffer.from(
    JSON.stringify({ ...canonical, reviewArtifactId: checked.reviewArtifactId }, null, 2) + "\n",
  );
  need(
    tree(read, root, checked.candidate).get(C) === `100644 blob ${checked.canonicalBlob}` &&
      checkedCanonicalBytes.length === checked.canonicalBytes &&
      sha256(checkedCanonicalBytes) === checked.canonicalSha256,
    "FROZEN_PATH_CHECK_CANONICAL_CHANGED",
  );
  const checkedCanonical = JSON.parse(checkedCanonicalBytes);
  need(checkedCanonical.reviewArtifactId === checked.reviewArtifactId, "FROZEN_PATH_CHECK_REVIEW_ID_CHANGED");
  delete checkedCanonical.reviewArtifactId;
  need(same(checkedCanonical, canonical), "FROZEN_PATH_CHECK_CANONICAL_DATA_CHANGED");
  const sqliteCanonicalBytes = Buffer.from(
    JSON.stringify({ ...canonical, reviewArtifactId: sqlite.reviewArtifactId }, null, 2) + "\n",
  );
  need(
    tree(read, root, sqlite.candidate).get(C) === `100644 blob ${sqlite.canonicalBlob}` &&
      sqliteCanonicalBytes.length === sqlite.canonicalBytes &&
      sha256(sqliteCanonicalBytes) === sqlite.canonicalSha256,
    "FROZEN_SQLITE_CANONICAL_CHANGED",
  );
  const sqliteCanonical = JSON.parse(sqliteCanonicalBytes);
  need(sqliteCanonical.reviewArtifactId === sqlite.reviewArtifactId, "FROZEN_SQLITE_REVIEW_ID_CHANGED");
  delete sqliteCanonical.reviewArtifactId;
  need(same(sqliteCanonical, canonical), "FROZEN_SQLITE_CANONICAL_DATA_CHANGED");
  const readerCanonicalBytes = Buffer.from(
    JSON.stringify({ ...canonical, reviewArtifactId: reader.reviewArtifactId }, null, 2) + "\n",
  );
  need(
    tree(read, root, reader.candidate).get(C) === `100644 blob ${reader.canonicalBlob}` &&
      readerCanonicalBytes.length === reader.canonicalBytes &&
      sha256(readerCanonicalBytes) === reader.canonicalSha256,
    "FROZEN_READER_CANONICAL_CHANGED",
  );
  const readerCanonical = JSON.parse(readerCanonicalBytes);
  need(readerCanonical.reviewArtifactId === reader.reviewArtifactId, "FROZEN_READER_REVIEW_ID_CHANGED");
  delete readerCanonical.reviewArtifactId;
  need(same(readerCanonical, canonical), "FROZEN_READER_CANONICAL_DATA_CHANGED");
  const budgetCanonicalBytes = Buffer.from(
    JSON.stringify({ ...canonical, reviewArtifactId: budget.reviewArtifactId }, null, 2) + "\n",
  );
  need(
    tree(read, root, budget.candidate).get(C) === `100644 blob ${budget.canonicalBlob}` &&
      budgetCanonicalBytes.length === budget.canonicalBytes &&
      sha256(budgetCanonicalBytes) === budget.canonicalSha256,
    "FROZEN_FINAL_BUDGET_CANONICAL_CHANGED",
  );
  const budgetCanonical = JSON.parse(budgetCanonicalBytes);
  need(budgetCanonical.reviewArtifactId === budget.reviewArtifactId, "FROZEN_FINAL_BUDGET_REVIEW_ID_CHANGED");
  delete budgetCanonical.reviewArtifactId;
  need(same(budgetCanonical, canonical), "FROZEN_FINAL_BUDGET_CANONICAL_DATA_CHANGED");
  const genericBudgetCanonicalBytes = Buffer.from(
    JSON.stringify({ ...canonical, reviewArtifactId: genericBudget.reviewArtifactId }, null, 2) + "\n",
  );
  need(
    tree(read, root, genericBudget.candidate).get(C) === `100644 blob ${genericBudget.canonicalBlob}` &&
      genericBudgetCanonicalBytes.length === genericBudget.canonicalBytes &&
      sha256(genericBudgetCanonicalBytes) === genericBudget.canonicalSha256,
    "FROZEN_GENERIC_BUDGET_CANONICAL_CHANGED",
  );
  const genericBudgetCanonical = JSON.parse(genericBudgetCanonicalBytes);
  need(
    genericBudgetCanonical.reviewArtifactId === genericBudget.reviewArtifactId,
    "FROZEN_GENERIC_BUDGET_REVIEW_ID_CHANGED",
  );
  delete genericBudgetCanonical.reviewArtifactId;
  need(same(genericBudgetCanonical, canonical), "FROZEN_GENERIC_BUDGET_CANONICAL_DATA_CHANGED");
  const fixtureScopeCanonicalBytes = Buffer.from(
    JSON.stringify({ ...canonical, reviewArtifactId: fixtureScope.reviewArtifactId }, null, 2) + "\n",
  );
  need(
    tree(read, root, fixtureScope.candidate).get(C) === `100644 blob ${fixtureScope.canonicalBlob}` &&
      fixtureScopeCanonicalBytes.length === fixtureScope.canonicalBytes &&
      sha256(fixtureScopeCanonicalBytes) === fixtureScope.canonicalSha256,
    "FROZEN_FIXTURE_SCOPE_CANONICAL_CHANGED",
  );
  const authReuseCanonicalBytes = Buffer.from(
    JSON.stringify({ ...canonical, reviewArtifactId: authReuse.reviewArtifactId }, null, 2) + "\n",
  );
  need(
    tree(read, root, authReuse.candidate).get(C) === `100644 blob ${authReuse.canonicalBlob}` &&
      authReuseCanonicalBytes.length === authReuse.canonicalBytes &&
      sha256(authReuseCanonicalBytes) === authReuse.canonicalSha256,
    "FROZEN_AUTH_REUSE_CANONICAL_CHANGED",
  );
  const publishedCanonical = JSON.parse(readRevision(read, root, plan.candidateSha, C));
  const publishedReviewArtifactId = publishedCanonical.reviewArtifactId;
  need(
    publishedReviewArtifactId === undefined ||
      (Number.isSafeInteger(publishedReviewArtifactId) && publishedReviewArtifactId > 0),
    "PUBLISHED_REVIEW_ID_INVALID",
  );
  delete publishedCanonical.reviewArtifactId;
  need(same(publishedCanonical, canonical), "PUBLISHED_CANONICAL_CHANGED");
  return {
    canonical,
    capturedPlan,
    publishedReviewArtifactId,
    binding: {
      kind: p.kind,
      id: p.id,
      originalBaseSha: p.oldBase,
      currentBaseSha: plan.baseSha,
      originalSourceDigest: p.sourceDigest,
      currentSourceDigest: plan.sourceDigest,
      contractDigest: p.contractDigest,
      recordDigest: sha256(recordBytes),
      captureArtifactId: p.captureArtifactId,
      captureRunId: p.captureRunId,
      captureDigest: p.captureDigest,
      rawReviewSha256: p.reviewSha256,
      acceptedCanonicalSha256: p.canonicalSha256,
      additionalIndependentPasses: 0,
    },
  };
}
export function bindPR776ControllerReconciliation({ root, plan, prNumber, readGit }) {
  if (String(prNumber ?? "") !== "776" || !plan.applicable) return plan;
  const read = readGit ?? git;
  if (!read(root, ["ls-tree", "-z", plan.baseSha, "--", PR776_RECORD_PATH]).length) return plan;
  const result = inspect({ root, plan, readGit });
  return {
    ...plan,
    pr776ControllerReconciliation: {
      ...result.binding,
      originalCandidateSha: result.capturedPlan.candidateSha,
      originalCandidateTree: result.capturedPlan.candidateTree,
    },
  };
}
export function validatePR776ReviewedIdentity(plan, evidence, { root, readGit } = {}) {
  need(isPR776ControllerReconciliation(plan) && root, "BOUND_PLAN_REQUIRED");
  const result = inspect({ root, plan, readGit }),
    expected = {
      ...result.binding,
      originalCandidateSha: result.capturedPlan.candidateSha,
      originalCandidateTree: result.capturedPlan.candidateTree,
    };
  need(same(plan.pr776ControllerReconciliation, expected), "PLAN_BINDING_CHANGED");
  const { reviewArtifactId, ...original } = evidence;
  need(
    reviewArtifactId === undefined || (Number.isSafeInteger(reviewArtifactId) && reviewArtifactId > 0),
    "AUTHENTICATED_REVIEW_ID_REQUIRED",
  );
  need(same(original, result.canonical), "CANONICAL_DATA_CHANGED");
  need(
    result.publishedReviewArtifactId === undefined || result.publishedReviewArtifactId === reviewArtifactId,
    "PUBLISHED_REVIEW_ID_MISMATCH",
  );
  return true;
}
export function pr776HistoricalReviewedPlan(plan) {
  const { pr776ControllerReconciliation: binding, ...historical } = plan;
  need(binding?.kind === PR776_CONTROLLER.kind, "BOUND_PLAN_REQUIRED");
  return {
    ...historical,
    baseSha: PR776_CONTROLLER.oldBase,
    sourceDigest: PR776_CONTROLLER.sourceDigest,
    candidateSha: binding.originalCandidateSha,
    candidateTree: binding.originalCandidateTree,
  };
}
export function pr776ReviewedAdoption(plan) {
  return { pr776ControllerReconciliation: plan.pr776ControllerReconciliation, independentPassesAdded: 0 };
}
export function validatePR776TrustedCapture(plan, capture) {
  if (!isPR776ControllerReconciliation(plan)) return;
  const p = PR776_CONTROLLER,
    actual = capture.trustedArtifact;
  need(
    actual?.id === p.captureArtifactId &&
      actual.runId === p.captureRunId &&
      actual.runAttempt === 1 &&
      actual.digest === p.captureDigest &&
      capture.baseSha === p.oldBase &&
      capture.sourceDigest === p.sourceDigest &&
      capture.contractDigest === p.contractDigest,
    "TRUSTED_CAPTURE_CHANGED",
  );
}
export const pr776ReviewSubmissionBinding = (plan) =>
  isPR776ControllerReconciliation(plan) ? { pr776ControllerReconciliation: plan.pr776ControllerReconciliation } : {};
export function validatePR776ReviewSubmission(plan, review) {
  if (!isPR776ControllerReconciliation(plan)) return;
  need(
    same(review.pr776ControllerReconciliation, plan.pr776ControllerReconciliation),
    "NEW_REVIEW_CONTROLLER_BINDING_CHANGED",
  );
}
