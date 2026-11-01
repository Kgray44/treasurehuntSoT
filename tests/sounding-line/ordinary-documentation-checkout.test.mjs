import assert from "node:assert/strict";
import test from "node:test";
import {
  DOCUMENTATION_CHECKOUT_MODE,
  documentationCheckoutProposal,
  ordinaryPrivatePathViolation,
} from "../../scripts/sounding-line/ordinary-documentation-checkout-profile.mjs";
const entry = (path, sha = "a".repeat(40), mode = "100644") => ({ path, sha, mode, type: "blob" });
const original = [
  entry("src/app/page.tsx"),
  entry("public/runtime.png"),
  entry("tests/fixture.zip"),
  entry("Development_Docs/source.json"),
  entry("Development_Docs/original.md"),
  entry("Development_Docs/capture/frame.png"),
  entry("Development_Docs/capture/trace.zip"),
  entry("Development_Docs/capture/recording.webm"),
  entry("Development_Docs/capture/unknown.data"),
  entry("Development_Docs/.next-history/keep.png"),
];
const proposed = () => [...structuredClone(original), entry("Development_Docs/incident.md", "b".repeat(40))];
const plan = (candidate = proposed(), base = original, anchor = original, prNumber = 819) =>
  documentationCheckoutProposal({ anchorEntries: anchor, baseEntries: base, candidateEntries: candidate, prNumber });

test("documentation names requiring migration validation retain the full route", () => {
  assert.equal(
    plan([...original, entry("Development_Docs/Migration.md", "b".repeat(40))]).reason,
    "MIGRATION_VALIDATION_REQUIRES_FULL",
  );
});

test("custody metadata proposals preserve exact JSON readers and attribute bodies only", () => {
  const base = [
    ...original,
    entry("testing/contracts.json"),
    entry("testing/product-experience-exceptions.json"),
    entry(".gitattributes"),
  ];
  const candidate = [...base, entry("Development_Docs/incident.md", "b".repeat(40))];
  const proposal = documentationCheckoutProposal({
    baseEntries: base,
    candidateEntries: candidate,
    anchorEntries: base,
    prNumber: 819,
    purpose: "campaign-custody",
  });
  assert.equal(proposal.profile, "DOCUMENTATION_CUSTODY_METADATA_V1");
  assert.deepEqual(proposal.metadataPaths, [
    ".gitattributes",
    "testing/contracts.json",
    "testing/product-experience-exceptions.json",
  ]);
  assert.equal(proposal.omissions.length, candidate.length - 3);
  assert(proposal.omissions.some((x) => x.path === "src/app/page.tsx"));
  assert.equal(proposal.qualification, false);
  assert.equal(
    documentationCheckoutProposal({
      baseEntries: original,
      candidateEntries: proposed(),
      anchorEntries: original,
      prNumber: 819,
      purpose: "campaign-custody",
    }).reason,
    "CUSTODY_READER_CHANGED_OR_MISSING",
  );
  assert.equal(
    documentationCheckoutProposal({
      baseEntries: base,
      candidateEntries: candidate,
      anchorEntries: base,
      prNumber: 819,
      purpose: "unknown",
    }).reason,
    "UNKNOWN_CHECKOUT_PURPOSE",
  );
});

test("reviewed documentation transport retains source-bound proposals without verification authority", () => {
  assert.equal(DOCUMENTATION_CHECKOUT_MODE, "ACTIVE");
  const result = plan();
  assert.equal(result.profile, "DOCUMENTATION_ONLY_SOURCE_BOUND_V1");
  assert.equal(result.qualification, false);
  assert.deepEqual(
    result.omissions.map((x) => x.path),
    [
      "Development_Docs/capture/frame.png",
      "Development_Docs/capture/recording.webm",
      "Development_Docs/capture/trace.zip",
    ],
  );
  assert.equal(result.unitSelection, "UNCHANGED_WIDENED_APPLICATION_SELECTION");
  assert.equal(plan([...proposed()].reverse()).retainedInventoryDigest, result.retainedInventoryDigest);
});
for (const [name, mutate] of [
  ["source", (x) => (x.find((x) => x.path === "src/app/page.tsx").sha = "c".repeat(40))],
  ["media mutation", (x) => (x.find((x) => x.path.endsWith("frame.png")).sha = "c".repeat(40))],
  [
    "media deletion",
    (x) =>
      x.splice(
        x.findIndex((x) => x.path.endsWith("trace.zip")),
        1,
      ),
  ],
  ["media rename", (x) => (x.find((x) => x.path.endsWith("frame.png")).path = "Development_Docs/capture/renamed.png")],
  ["executable document", (x) => (x.at(-1).mode = "100755")],
  ["symlink document", (x) => (x.at(-1).mode = "120000")],
  ["unknown changed extension", (x) => x.push(entry("Development_Docs/unknown.bin"))],
])
  test(`documentation transport falls back for ${name}`, () => {
    const candidate = proposed();
    mutate(candidate);
    assert.equal(plan(candidate).profile, "FULL_SNAPSHOT");
  });
test("reader/policy drift, duplicate and control-character names cannot close the read set", () => {
  const base = structuredClone(original);
  base[0].sha = "c".repeat(40);
  assert.equal(plan(proposed(), base).reason, "READER_OR_BASE_POLICY_DRIFT");
  for (const extra of [
    entry("Development_Docs/incident.md"),
    entry("Development_Docs/bad\tname.md"),
    entry("../outside.md"),
    entry("Development_Docs/bad\ufffd.md"),
  ])
    assert.equal(plan([...proposed(), extra]).profile, "FULL_SNAPSHOT");
  for (const pr of [0, 721, 776]) assert.equal(plan(proposed(), original, original, pr).profile, "FULL_SNAPSHOT");
});
test("complete pathname checks preserve the installed scanner's ignored and implementation domains", () => {
  for (const path of [
    "private-exports/photo.png",
    "Development_Docs/private-content/photo.png",
    "Development_Docs/token.ftkey",
    "foo/src/private-content/a.txt",
  ])
    assert.equal(ordinaryPrivatePathViolation(path), true, path);
  for (const path of [
    "src/private-content/fixture.ftkey",
    "tests/private-content/fixture.ftprivate",
    "node_modules/private-content/key.png",
    "Development_Docs/.next-history/private-content/a.png",
  ])
    assert.equal(ordinaryPrivatePathViolation(path), false, path);
  const unsafe = entry("Development_Docs/private-content/photo.png"),
    base = [...original, unsafe];
  assert.equal(
    plan([...base, entry("Development_Docs/incident.md", "b".repeat(40))], base, base).reason,
    "FORBIDDEN_PATH_REQUIRES_FULL_SCAN",
  );
});
