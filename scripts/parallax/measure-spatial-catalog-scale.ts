/** Synthetic, isolated SQLite scale probe for the SC-00C inventory and owner summary page. */
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { writeFile } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { canonicalChecksum } from "../../src/drydock/canonical";
import { createSpatialDraft } from "../../src/parallax/authoring";
import { spatialLibraryInventory } from "../../src/parallax/library-lifecycle-service";
import { materializeLibraryMoment, spatialItemKind } from "../../src/parallax/library-service";
import { pageOwnedSpatialCatalog, readOwnedSpatialCatalogItem } from "../../src/parallax/spatial-catalog-page-service";
import { readCompactSpatialCatalogPage } from "../../src/parallax/spatial-catalog-read-projection";

const databaseUrl = process.env.DATABASE_URL?.replaceAll("\\", "/") ?? "";
if (!databaseUrl.startsWith("file:") || !databaseUrl.includes("/artifacts/sc00c/scale/"))
  throw new Error("SC00C_SCALE_ISOLATED_SQLITE_REQUIRED");

const total = 1000;
const releasesPerItem = 5;
async function timed<T>(run: () => Promise<T>) {
  const start = performance.now();
  const result = await run();
  return {
    result,
    ms: Number((performance.now() - start).toFixed(2)),
    bytes: Buffer.byteLength(JSON.stringify(result)),
  };
}

async function main() {
  if (await db.reusableAuthoringItem.count()) throw new Error("SC00C_SCALE_EMPTY_DATABASE_REQUIRED");
  const accountId = (await db.userAccount.create({ data: { status: "ACTIVE" } })).id;
  for (let offset = 0; offset < total; offset += 100) {
    const items = [];
    const versions = [];
    for (let index = offset; index < offset + 100; index++) {
      const id = randomUUID();
      const draft = createSpatialDraft(id);
      draft.content.title = `Synthetic Scale Scene ${String(index).padStart(4, "0")}`;
      items.push({
        id,
        ownerAccountId: accountId,
        kind: spatialItemKind,
        name: draft.content.title,
        status: "SAVED",
        currentVersionNumber: 1,
      });
      versions.push({
        id: `${id}:working`,
        itemId: id,
        versionNumber: 0,
        envelope: JSON.stringify(draft),
        checksum: canonicalChecksum(draft),
      });
      for (let releaseNumber = 1; releaseNumber <= releasesPerItem; releaseNumber++) {
        const moment = materializeLibraryMoment(draft, accountId, releaseNumber);
        versions.push({
          id: moment.version.id,
          itemId: id,
          versionNumber: releaseNumber,
          envelope: JSON.stringify(moment),
          checksum: moment.version.checksum,
        });
      }
    }
    await db.reusableAuthoringItem.createMany({ data: items });
    for (let index = 0; index < versions.length; index += 100)
      await db.reusableAuthoringItemVersion.createMany({ data: versions.slice(index, index + 100) });
  }

  const inventory = await timed(() => spatialLibraryInventory(accountId));
  const query = { kind: "SCENES" as const, search: "", limit: 48 };
  const first = await timed(() => pageOwnedSpatialCatalog(accountId, query));
  const global = await timed(() => readCompactSpatialCatalogPage(accountId, query));
  const second = await timed(() => pageOwnedSpatialCatalog(accountId, { ...query, cursor: first.result.nextCursor! }));
  const search = await timed(() => pageOwnedSpatialCatalog(accountId, { ...query, search: "scale scene 0999" }));
  const selected = await timed(() => readOwnedSpatialCatalogItem(accountId, search.result.items[0].id));
  const report = {
    fixture: { spatialItems: total, releasesPerItem, geometry: "minimal synthetic Scene working drafts" },
    inventory: {
      ms: inventory.ms,
      payloadBytes: inventory.bytes,
      fullDrafts: inventory.result.items.length,
      releases: inventory.result.items.reduce((n, item) => n + item.releases.length, 0),
    },
    firstPage: {
      ms: first.ms,
      payloadBytes: first.bytes,
      total: first.result.total,
      returned: first.result.items.length,
    },
    globalPage: {
      ms: global.ms,
      payloadBytes: global.bytes,
      total: global.result.total,
      returned: global.result.items.length,
    },
    secondPage: { ms: second.ms, payloadBytes: second.bytes, returned: second.result.items.length },
    search: { ms: search.ms, payloadBytes: search.bytes, matched: search.result.total },
    selected: { ms: selected.ms, payloadBytes: selected.bytes, releases: selected.result?.releases.length ?? 0 },
  };
  const output = "artifacts/sc00c/scale/comparison.json";
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}

void main()
  .catch((error: unknown) => {
    process.stderr.write(`${error}\n`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
