import { describe, expect, it } from "vitest";
import fixture from "../../../tests/fixtures/drydock/current-authoring-v1.json";
import { canonicalChecksum, canonicalJson } from "@/drydock/canonical";
import {
  canonicalTargetMigrationPreview,
  parseDrydockBlock,
  runtimeCompatibilityProjection,
  serializeCanonicalDrydockBlock,
} from "@/drydock/contracts/parser";
import {
  drydockBlockContracts,
  serializeDrydockBlockContractRegistry,
  studioRegistryFromDrydock,
} from "@/drydock/contracts/registry";
import { drydockBlockTypeIds } from "@/drydock/contracts/schemas";
import { applyBlockMigrations } from "@/drydock/migrations";

const frozenBlocks = fixture.blocks as Parameters<typeof parseDrydockBlock>[0][];

describe("Drydock block contract registry", () => {
  it("governs every current Story Block exactly once", () => {
    expect(drydockBlockTypeIds).toHaveLength(23);
    expect(new Set(drydockBlockTypeIds).size).toBe(23);
    expect(Object.keys(drydockBlockContracts).sort()).toEqual([...drydockBlockTypeIds].sort());
    expect(serializeDrydockBlockContractRegistry()).toHaveLength(23);
    expect(studioRegistryFromDrydock().every((item) => item.schemaVersion === 2)).toBe(true);
    expect(
      drydockBlockContracts.setVariable.variableWrites.find(
        (reference) => reference.fieldPath === "configuration.variableId",
      )?.operations,
    ).toEqual(["assign", "increment", "decrement", "toggle"]);
  });

  it.each(frozenBlocks)("migrates, parses, and round-trips $blockType v1 deterministically", (authored) => {
    const parsed = parseDrydockBlock(authored);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.migrationsApplied).toEqual([`drydock.${authored.blockType}.v1-to-v2`]);
    expect(parsed.block.schemaVersion).toBe(2);
    expect(serializeCanonicalDrydockBlock(parsed.block)).toBe(serializeCanonicalDrydockBlock(parsed.block));
    expect(canonicalChecksum(parsed.block)).toMatch(/^[a-f0-9]{64}$/u);
    const current = parseDrydockBlock(parsed.block);
    expect(current.success).toBe(true);
    if (current.success) expect(current.block).toEqual(parsed.block);
  });

  it("keeps the accepted One Voyage completion projection explicit", () => {
    const parsed = parseDrydockBlock(frozenBlocks.find((block) => block.blockType === "wait")!);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.block.configuration).not.toHaveProperty("completionMode");
    expect(parsed.block.completion.mode).toBe("timer");
    expect(runtimeCompatibilityProjection(parsed.block).configuration.completionMode).toBe("timer");
  });

  it("migrates a legacy riddle without optional hints into the required empty collection", () => {
    const legacy = structuredClone(frozenBlocks.find((block) => block.blockType === "riddle")!);
    delete legacy.configuration.hints;
    const parsed = parseDrydockBlock(legacy);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.migrationsApplied).toEqual(["drydock.riddle.v1-to-v2"]);
    expect(parsed.block.configuration.hints).toEqual([]);
  });

  it("migrates a legacy chapter completion into the default continuation behavior", () => {
    const legacy = structuredClone(frozenBlocks.find((block) => block.blockType === "chapterComplete")!);
    delete legacy.configuration.nextChapterBehavior;
    delete legacy.configuration.returnToMap;
    const parsed = parseDrydockBlock(legacy);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.migrationsApplied).toEqual(["drydock.chapterComplete.v1-to-v2"]);
    expect(parsed.block.configuration.nextChapterBehavior).toBe("continue");
    expect(parsed.block.configuration.returnToMap).toBe(false);
  });

  it("migrates a legacy travel direction into the named destination visibility default", () => {
    const legacy = structuredClone(frozenBlocks.find((block) => block.blockType === "travelDirection")!);
    delete legacy.configuration.destinationVisibility;
    const parsed = parseDrydockBlock(legacy);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.migrationsApplied).toEqual(["drydock.travelDirection.v1-to-v2"]);
    expect(parsed.block.configuration.destinationVisibility).toBe("named");
  });

  it("migrates a legacy confirmation into the standard confirmation style", () => {
    const legacy = structuredClone(frozenBlocks.find((block) => block.blockType === "confirmation")!);
    delete legacy.configuration.confirmationStyle;
    const parsed = parseDrydockBlock(legacy);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.migrationsApplied).toEqual(["drydock.confirmation.v1-to-v2"]);
    expect(parsed.block.configuration.confirmationStyle).toBe("standard");
  });

  it("normalizes only the exact known mixed-version Studio compatibility fields", () => {
    const migrated = parseDrydockBlock(frozenBlocks.find((block) => block.blockType === "arrivalCheck")!);
    expect(migrated.success).toBe(true);
    if (!migrated.success) return;
    const mixed = structuredClone(migrated.block);
    mixed.configuration.completionMode = "playerConfirmation";
    mixed.configuration.futureProviderOptions = {};
    mixed.completion = {};
    const normalized = parseDrydockBlock(mixed);
    expect(normalized.success).toBe(true);
    if (!normalized.success) return;
    expect(normalized.migrationsApplied).toEqual(["drydock.arrivalCheck.v2-known-compatibility-normalization"]);
    expect(normalized.block.configuration).not.toHaveProperty("completionMode");
    expect(normalized.block.configuration).not.toHaveProperty("futureProviderOptions");
    expect(normalized.block.completion.mode).toBe("playerConfirmation");
  });

  it("rejects unregistered fields, extensions, versions, and conflicting targets", () => {
    const source = structuredClone(frozenBlocks.find((block) => block.blockType === "choice")!);
    source.configuration.unregistered = true;
    expect(parseDrydockBlock(source).success).toBe(false);
    delete source.configuration.unregistered;
    source.configuration.extensions = { "private.arbitrary": { version: 1, payload: {} } };
    expect(parseDrydockBlock(source).success).toBe(false);
    delete source.configuration.extensions;
    source.schemaVersion = 99;
    const future = parseDrydockBlock(source);
    expect(future.success).toBe(false);
    if (!future.success) expect(future.compatibilityStatus).toBe("UNSUPPORTED");
    source.schemaVersion = 1;
    (source.configuration.choices as Array<{ targetBlockId: string }>)[0].targetBlockId = "different-target";
    const conflict = parseDrydockBlock(source);
    expect(conflict.success).toBe(false);
    expect(conflict.issues.some((issue) => issue.code === "DRYDOCK_CHOICE_TARGET_AUTHORITY_CONFLICT")).toBe(true);
  });

  it.each(frozenBlocks)("rings the strict schema alarm for a wrong primitive on $blockType", (authored) => {
    const source = structuredClone(authored);
    const key = Object.keys(source.configuration).find((candidate) => candidate !== "completionMode")!;
    const value = source.configuration[key];
    source.configuration[key] =
      typeof value === "string"
        ? 42
        : typeof value === "number"
          ? "not-a-number"
          : typeof value === "boolean"
            ? "not-a-boolean"
            : Array.isArray(value)
              ? {}
              : [];
    expect(parseDrydockBlock(source).success).toBe(false);
  });

  it.each(frozenBlocks)("rejects unknown-field smuggling on $blockType", (authored) => {
    const source = structuredClone(authored);
    source.configuration.internalContractMetadata = { currentVersion: 999 };
    expect(parseDrydockBlock(source).success).toBe(false);
  });

  it("accepts registered extensions and enforces ranges, nesting, references, and cross-field rules", () => {
    const narrative = structuredClone(frozenBlocks.find((block) => block.blockType === "narrative")!);
    narrative.configuration.extensions = {
      "voyagewright.compatibility": { version: 1, payload: { sourceVersion: 1, fields: ["legacyHeading"] } },
    };
    expect(parseDrydockBlock(narrative).success).toBe(true);

    const image = structuredClone(frozenBlocks.find((block) => block.blockType === "image")!);
    delete image.configuration.assetId;
    const missingReference = parseDrydockBlock(image);
    expect(missingReference.success).toBe(false);
    if (!missingReference.success) {
      expect(missingReference.compatibilityStatus).toBe("MIGRATION_REQUIRED");
      expect(missingReference.migrationPreview?.schemaVersion).toBe(2);
      expect(missingReference.migrationPreview?.id).toBe(image.id);
    }
    image.configuration.assetId = "asset-image";
    image.configuration.focalX = 101;
    expect(parseDrydockBlock(image).success).toBe(false);
    image.configuration.focalX = 100;
    image.configuration.altText = "";
    image.configuration.decorative = false;
    expect(parseDrydockBlock(image).success).toBe(false);

    const transformation = structuredClone(frozenBlocks.find((block) => block.blockType === "imageTransformation")!);
    transformation.configuration.alignment = { x: 0 };
    expect(parseDrydockBlock(transformation).success).toBe(false);
  });

  it("does not leak synthetic answers or Captain prose through schema diagnostics", () => {
    const riddle = structuredClone(frozenBlocks.find((block) => block.blockType === "riddle")!);
    riddle.configuration.acceptedAnswers = [{ answerKey: "synthetic-answer-must-not-log" }];
    const riddleResult = parseDrydockBlock(riddle);
    expect(riddleResult.success).toBe(false);
    expect(JSON.stringify(riddleResult.issues)).not.toContain("synthetic-answer-must-not-log");

    const note = structuredClone(frozenBlocks.find((block) => block.blockType === "captainsNote")!);
    note.configuration.body = { captainNotes: "synthetic-captain-prose-must-not-log" };
    const noteResult = parseDrydockBlock(note);
    expect(noteResult.success).toBe(false);
    expect(JSON.stringify(noteResult.issues)).not.toContain("synthetic-captain-prose-must-not-log");
  });

  it("defines idempotent, ordered v1-to-v2 migration paths", () => {
    const source = frozenBlocks[0];
    const contract = drydockBlockContracts[source.blockType as keyof typeof drydockBlockContracts];
    const first = applyBlockMigrations(
      { ...source, presentation: source.presentation ?? {}, completion: source.completion ?? {} },
      contract.migrations,
      2,
    );
    expect(first.applied).toEqual([`drydock.${source.blockType}.v1-to-v2`]);
    expect(first.output).toBeDefined();
    const second = applyBlockMigrations(first.output!, contract.migrations, 2);
    expect(second.applied).toEqual([]);
    expect(second.output).toEqual(first.output);
    expect(first.output?.id).toBe(source.id);
    expect(first.output?.configuration.body).toBe(source.configuration.body);
    expect(
      applyBlockMigrations(
        {
          id: source.id,
          blockType: source.blockType,
          schemaVersion: 1,
          configuration: source.configuration,
          presentation: source.presentation ?? {},
          completion: source.completion ?? {},
        },
        [],
        2,
      ).missingFromVersion,
    ).toBe(1);
  });

  it("previews duplicated target-field repair without mutating frozen authored content", () => {
    const source = structuredClone(frozenBlocks.find((block) => block.blockType === "choice")!);
    const before = canonicalChecksum(source);
    const parsed = parseDrydockBlock(source);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const preview = canonicalTargetMigrationPreview(parsed.block);
    expect(preview.nextBlockId).toBe(parsed.block.connections[0].targetBlockId);
    expect((preview.configuration.choices as Array<{ targetBlockId: string }>)[1].targetBlockId).toBe(
      parsed.block.connections[1].targetBlockId,
    );
    expect(canonicalChecksum(source)).toBe(before);
  });

  it("freezes a complete synthetic historical compatibility ledger", () => {
    expect(fixture.classification).toBe("SYNTHETIC_NO_PRIVATE_CONTENT");
    expect(fixture.frozenAt).toBe("2026-08-09");
    expect(frozenBlocks.map((block) => block.blockType).sort()).toEqual([...drydockBlockTypeIds].sort());
    expect(canonicalJson(fixture)).not.toContain("creatorNotes");
  });

  it("serializes the registered block contract surface deterministically", () => {
    const first = canonicalJson(serializeDrydockBlockContractRegistry());
    const second = canonicalJson(serializeDrydockBlockContractRegistry());
    expect(second).toBe(first);
    expect(JSON.parse(first)).toHaveLength(drydockBlockTypeIds.length);
  });
});
