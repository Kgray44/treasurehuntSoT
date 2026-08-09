import {
  TIDEGLASS_COMPARISON_POLICY_VERSION,
  TIDEGLASS_SEMANTIC_SCHEMA_VERSION,
  canonicalJson,
  changeCategories,
  changeKinds,
  compareCanonicalStrings,
  comparisonIdentity,
  emptyCategoryCounts,
  semanticDigest,
  type ChangeEvidence,
  type ChronicleChangeCategory,
  type ChronicleChangeKind,
  type ChronicleChangeRecord,
  type ChronicleSemanticSnapshot,
  type EditionPair,
  type MatchOutcome,
  type SemanticEntity,
  type SemanticFact,
  type SemanticGraphEdge,
  type SemanticUnsupportedSection,
  type TideglassChangeSet,
  type TideglassComparisonStatus,
  type TideglassComparisonReceipt,
  type TideglassComparisonResult,
} from "./core";

export type ExplicitReplacementMap = Readonly<Record<string, string>>;

function duplicates(entities: readonly SemanticEntity[]): Set<string> {
  const seen = new Set<string>();
  const duplicate = new Set<string>();
  for (const entity of entities) {
    if (seen.has(entity.id)) duplicate.add(entity.id);
    seen.add(entity.id);
  }
  return duplicate;
}

export function matchEntities(
  source: readonly SemanticEntity[],
  target: readonly SemanticEntity[],
  replacements: ExplicitReplacementMap = {},
): MatchOutcome[] {
  const sourceDuplicates = duplicates(source);
  const targetDuplicates = duplicates(target);
  const ambiguous = new Set([...sourceDuplicates, ...targetDuplicates]);
  const sourceMap = new Map(source.filter((entity) => !ambiguous.has(entity.id)).map((entity) => [entity.id, entity]));
  const targetMap = new Map(target.filter((entity) => !ambiguous.has(entity.id)).map((entity) => [entity.id, entity]));
  const outcomes: MatchOutcome[] = [...ambiguous].sort().map((identity) => ({ kind: "AMBIGUOUS", identity }));
  const consumedTargets = new Set<string>();
  const exactTargetIds = new Set([...sourceMap.keys()].filter((identity) => targetMap.has(identity)));

  for (const sourceEntity of [...sourceMap.values()].sort((a, b) => compareCanonicalStrings(a.id, b.id))) {
    const exact = targetMap.get(sourceEntity.id);
    if (exact) {
      consumedTargets.add(exact.id);
      outcomes.push({ kind: "EXACT_STABLE_ID", source: sourceEntity, target: exact });
      continue;
    }
    const replacementId = replacements[sourceEntity.id];
    const replacement = replacementId ? targetMap.get(replacementId) : undefined;
    if (replacement && !exactTargetIds.has(replacement.id) && !consumedTargets.has(replacement.id)) {
      consumedTargets.add(replacement.id);
      outcomes.push({ kind: "EXPLICIT_REPLACEMENT", source: sourceEntity, target: replacement });
      continue;
    }
    outcomes.push({ kind: "UNMATCHED_SOURCE", source: sourceEntity });
  }
  for (const targetEntity of [...targetMap.values()].sort((a, b) => compareCanonicalStrings(a.id, b.id)))
    if (!consumedTargets.has(targetEntity.id)) outcomes.push({ kind: "UNMATCHED_TARGET", target: targetEntity });
  return outcomes;
}

function entityCategory(entity: SemanticEntity): ChronicleChangeCategory {
  if (entity.entityType === "CHAPTER") return "STRUCTURE";
  if (entity.entityType === "ARTIFACT") return "ARTIFACT";
  if (entity.entityType === "LOCATION") return "LOCATION_AND_MAP";
  if (entity.entityType === "MEDIA") return "MEDIA";
  if (entity.semanticType === "taleComplete") return "ENDING";
  if (entity.semanticType === "choice" || entity.semanticType === "condition") return "BRANCHING_AND_CHOICES";
  return "STRUCTURE";
}

function entitySpoiler(entity: SemanticEntity) {
  if (entity.semanticType === "taleComplete") return "ENDING_SPOILER" as const;
  if (entity.entityType === "MEDIA") return "PREVIEW_SAFE" as const;
  return "STORY_SPOILER" as const;
}

type RecordInput = Omit<ChronicleChangeRecord, "id" | "evidence"> & {
  semanticPath: string;
  comparator: string;
  sourceValue?: unknown;
  targetValue?: unknown;
};

function record(pair: EditionPair, comparisonId: string, input: RecordInput): ChronicleChangeRecord {
  const evidence: ChangeEvidence = {
    sourceEditionId: pair.source.editionId,
    sourceEditionChecksum: pair.source.editionChecksum,
    targetEditionId: pair.target.editionId,
    targetEditionChecksum: pair.target.editionChecksum,
    ...(input.sourceEntityId ? { sourceEntityId: input.sourceEntityId } : {}),
    ...(input.targetEntityId ? { targetEntityId: input.targetEntityId } : {}),
    semanticPath: input.semanticPath,
    ...(input.sourceValue !== undefined ? { sourceSemanticDigest: semanticDigest(input.sourceValue) } : {}),
    ...(input.targetValue !== undefined ? { targetSemanticDigest: semanticDigest(input.targetValue) } : {}),
    comparator: input.comparator,
    semanticSchemaVersion: TIDEGLASS_SEMANTIC_SCHEMA_VERSION,
    comparisonPolicyVersion: TIDEGLASS_COMPARISON_POLICY_VERSION,
  };
  const identity = {
    comparisonId,
    category: input.category,
    kind: input.kind,
    entityType: input.entityType,
    sourceEntityId: input.sourceEntityId ?? null,
    targetEntityId: input.targetEntityId ?? null,
    semanticPath: input.semanticPath,
  };
  const { semanticPath: _path, comparator: _comparator, sourceValue: _source, targetValue: _target, ...rest } = input;
  void _path;
  void _comparator;
  void _source;
  void _target;
  return { ...rest, id: semanticDigest(identity), evidence };
}

function compareFacts(
  pair: EditionPair,
  comparisonId: string,
  entityType: string,
  entityId: string | undefined,
  sourceFacts: readonly SemanticFact[],
  targetFacts: readonly SemanticFact[],
  pathPrefix: string,
): ChronicleChangeRecord[] {
  const source = new Map(sourceFacts.map((item) => [item.path, item]));
  const target = new Map(targetFacts.map((item) => [item.path, item]));
  const paths = [...new Set([...source.keys(), ...target.keys()])].sort();
  const changes: ChronicleChangeRecord[] = [];
  for (const path of paths) {
    const before = source.get(path);
    const after = target.get(path);
    if (before && after && canonicalJson(before.value) === canonicalJson(after.value)) continue;
    const policy = after ?? before;
    if (!policy) continue;
    changes.push(
      record(pair, comparisonId, {
        category: policy.category,
        kind: before && after ? "MODIFIED" : before ? "REMOVED" : "ADDED",
        entityType,
        entityId,
        sourceEntityId: entityId,
        targetEntityId: entityId,
        significance: policy.significance,
        spoilerLevel: policy.spoilerLevel,
        compatibilityImpact: policy.category === "COMPATIBILITY" ? "POTENTIAL" : "NONE",
        tags: policy.tags,
        semanticPath: `${pathPrefix}.${path}`,
        comparator: "tideglass.semantic-fact.v1",
        ...(before ? { sourceValue: before.value } : {}),
        ...(after ? { targetValue: after.value } : {}),
      }),
    );
  }
  return changes;
}

function compareEntitySection(
  pair: EditionPair,
  comparisonId: string,
  section: string,
  source: readonly SemanticEntity[],
  target: readonly SemanticEntity[],
  replacements: ExplicitReplacementMap,
): { changes: ChronicleChangeRecord[]; unsupported: SemanticUnsupportedSection[] } {
  const changes: ChronicleChangeRecord[] = [];
  const unsupported: SemanticUnsupportedSection[] = [];
  for (const outcome of matchEntities(source, target, replacements)) {
    if (outcome.kind === "AMBIGUOUS") {
      unsupported.push({
        section,
        code: "AMBIGUOUS_IDENTITY",
        detail: `Duplicate stable identity prevents authoritative matching: ${outcome.identity}`,
      });
      continue;
    }
    if (outcome.kind === "UNMATCHED_SOURCE") {
      changes.push(
        record(pair, comparisonId, {
          category: entityCategory(outcome.source),
          kind: "REMOVED",
          entityType: outcome.source.entityType,
          entityId: outcome.source.id,
          sourceEntityId: outcome.source.id,
          significance: "MAJOR",
          spoilerLevel: entitySpoiler(outcome.source),
          tags: ["stable-identity"],
          semanticPath: `${section}.${outcome.source.id}`,
          comparator: "tideglass.stable-entity.v1",
          sourceValue: { type: outcome.source.semanticType ?? outcome.source.entityType },
        }),
      );
      continue;
    }
    if (outcome.kind === "UNMATCHED_TARGET") {
      changes.push(
        record(pair, comparisonId, {
          category: entityCategory(outcome.target),
          kind: "ADDED",
          entityType: outcome.target.entityType,
          entityId: outcome.target.id,
          targetEntityId: outcome.target.id,
          significance: "MAJOR",
          spoilerLevel: entitySpoiler(outcome.target),
          tags: ["stable-identity"],
          semanticPath: `${section}.${outcome.target.id}`,
          comparator: "tideglass.stable-entity.v1",
          targetValue: { type: outcome.target.semanticType ?? outcome.target.entityType },
        }),
      );
      continue;
    }
    if (outcome.kind === "EXPLICIT_REPLACEMENT") {
      changes.push(
        record(pair, comparisonId, {
          category: entityCategory(outcome.target),
          kind: "REPLACED",
          entityType: outcome.target.entityType,
          entityId: outcome.target.id,
          sourceEntityId: outcome.source.id,
          targetEntityId: outcome.target.id,
          significance: "MAJOR",
          spoilerLevel: entitySpoiler(outcome.target),
          tags: ["explicit-replacement"],
          semanticPath: `${section}.replacement`,
          comparator: "tideglass.explicit-replacement.v1",
          sourceValue: { id: outcome.source.id },
          targetValue: { id: outcome.target.id },
        }),
      );
      continue;
    }
    const before = outcome.source;
    const after = outcome.target;
    if (before.parentId !== after.parentId || before.order !== after.order)
      changes.push(
        record(pair, comparisonId, {
          category: "STRUCTURE",
          kind: "MOVED",
          entityType: after.entityType,
          entityId: after.id,
          sourceEntityId: before.id,
          targetEntityId: after.id,
          significance: "MAJOR",
          spoilerLevel: entitySpoiler(after),
          tags: ["stable-identity"],
          semanticPath: `${section}.${after.id}.position`,
          comparator: "tideglass.ordered-entity.v1",
          sourceValue: { parentId: before.parentId ?? null, order: before.order ?? null },
          targetValue: { parentId: after.parentId ?? null, order: after.order ?? null },
        }),
      );
    if (before.semanticType !== after.semanticType)
      changes.push(
        record(pair, comparisonId, {
          category: entityCategory(after),
          kind: "MODIFIED",
          entityType: after.entityType,
          entityId: after.id,
          sourceEntityId: before.id,
          targetEntityId: after.id,
          significance: "MAJOR",
          spoilerLevel: entitySpoiler(after),
          tags: ["semantic-type"],
          semanticPath: `${section}.${after.id}.semanticType`,
          comparator: "tideglass.semantic-type.v1",
          sourceValue: before.semanticType ?? null,
          targetValue: after.semanticType ?? null,
        }),
      );
    changes.push(
      ...compareFacts(
        pair,
        comparisonId,
        after.entityType,
        after.id,
        before.facts,
        after.facts,
        `${section}.${after.id}`,
      ),
    );
  }
  return { changes, unsupported };
}

function duplicateEdgeIds(edges: readonly SemanticGraphEdge[]) {
  const seen = new Set<string>();
  const duplicate = new Set<string>();
  for (const edge of edges) {
    if (seen.has(edge.id)) duplicate.add(edge.id);
    seen.add(edge.id);
  }
  return duplicate;
}

function compareGraph(
  pair: EditionPair,
  comparisonId: string,
  sourceEdges: readonly SemanticGraphEdge[],
  targetEdges: readonly SemanticGraphEdge[],
): { changes: ChronicleChangeRecord[]; unsupported: SemanticUnsupportedSection[] } {
  const ambiguous = new Set([...duplicateEdgeIds(sourceEdges), ...duplicateEdgeIds(targetEdges)]);
  if (ambiguous.size)
    return {
      changes: [],
      unsupported: [
        {
          section: "graph",
          code: "AMBIGUOUS_IDENTITY",
          detail: `Duplicate graph edge identity prevents authoritative matching: ${[...ambiguous].sort().join(", ")}`,
        },
      ],
    };
  const source = new Map(sourceEdges.map((edge) => [edge.id, edge]));
  const target = new Map(targetEdges.map((edge) => [edge.id, edge]));
  const changes: ChronicleChangeRecord[] = [];
  for (const id of [...new Set([...source.keys(), ...target.keys()])].sort()) {
    const before = source.get(id);
    const after = target.get(id);
    if (before && after && before.targetBlockId === after.targetBlockId) continue;
    const edge = after ?? before;
    if (!edge) continue;
    const kind: ChronicleChangeKind = before && after ? "REWIRED" : before ? "REMOVED" : "ADDED";
    changes.push(
      record(pair, comparisonId, {
        category: "BRANCHING_AND_CHOICES",
        kind,
        entityType: "GRAPH_EDGE",
        entityId: id,
        ...(before ? { sourceEntityId: before.targetBlockId } : {}),
        ...(after ? { targetEntityId: after.targetBlockId } : {}),
        significance: "MAJOR",
        spoilerLevel: "STORY_SPOILER",
        compatibilityImpact: "NONE",
        tags: ["graph", edge.connectionType],
        semanticPath: `graph.${id}.targetBlockId`,
        comparator: "tideglass.graph.v1",
        ...(before ? { sourceValue: before.targetBlockId } : {}),
        ...(after ? { targetValue: after.targetBlockId } : {}),
      }),
    );
  }
  return { changes, unsupported: [] };
}

function uniqueUnsupported(items: readonly SemanticUnsupportedSection[]): SemanticUnsupportedSection[] {
  const map = new Map<string, SemanticUnsupportedSection>();
  for (const item of items) map.set(`${item.section}:${item.code}:${item.sourceSchemaVersion ?? ""}`, item);
  return [...map.values()].sort((a, b) => compareCanonicalStrings(`${a.section}:${a.code}`, `${b.section}:${b.code}`));
}

function orderChanges(changes: ChronicleChangeRecord[], structuralOrder: ReadonlyMap<string, number>) {
  const categoryOrder = new Map(changeCategories.map((category, index) => [category, index]));
  const kindOrder = new Map(changeKinds.map((kind, index) => [kind, index]));
  return changes.sort((a, b) => {
    const aEntity = a.targetEntityId ?? a.sourceEntityId ?? a.entityId ?? "";
    const bEntity = b.targetEntityId ?? b.sourceEntityId ?? b.entityId ?? "";
    return (
      (structuralOrder.get(aEntity) ?? Number.MAX_SAFE_INTEGER) -
        (structuralOrder.get(bEntity) ?? Number.MAX_SAFE_INTEGER) ||
      (categoryOrder.get(a.category) ?? 999) - (categoryOrder.get(b.category) ?? 999) ||
      compareCanonicalStrings(a.entityType, b.entityType) ||
      compareCanonicalStrings(aEntity, bEntity) ||
      (kindOrder.get(a.kind) ?? 999) - (kindOrder.get(b.kind) ?? 999) ||
      compareCanonicalStrings(a.evidence.semanticPath, b.evidence.semanticPath)
    );
  });
}

function hasUnavailableChronicleSemantics(snapshot: ChronicleSemanticSnapshot): boolean {
  return snapshot.unsupportedSections.some(
    (section) => section.section === "chronicle-semantics" && section.code === "SCHEMA_UNSUPPORTED",
  );
}

export function compareSemanticSnapshots(
  source: ChronicleSemanticSnapshot,
  target: ChronicleSemanticSnapshot,
  replacements: ExplicitReplacementMap = {},
): TideglassChangeSet {
  const pair: EditionPair = { chronicleId: source.edition.chronicleId, source: source.edition, target: target.edition };
  const comparisonId = comparisonIdentity(pair);
  const changes: ChronicleChangeRecord[] = [];
  const unsupported: SemanticUnsupportedSection[] = [...source.unsupportedSections, ...target.unsupportedSections];
  if (!hasUnavailableChronicleSemantics(source) && !hasUnavailableChronicleSemantics(target)) {
    changes.push(
      ...compareFacts(pair, comparisonId, "CHRONICLE", pair.chronicleId, source.metadata, target.metadata, "metadata"),
      ...compareFacts(
        pair,
        comparisonId,
        "CHRONICLE",
        pair.chronicleId,
        source.requirements,
        target.requirements,
        "requirements",
      ),
    );
    const sections: Array<[string, readonly SemanticEntity[], readonly SemanticEntity[]]> = [
      ["chapters", source.structure.chapters, target.structure.chapters],
      ["blocks", source.structure.blocks, target.structure.blocks],
      ["artifacts", source.artifacts, target.artifacts],
      ["locations", source.world.locations, target.world.locations],
      ["media", source.media, target.media],
    ];
    for (const [name, before, after] of sections) {
      const result = compareEntitySection(pair, comparisonId, name, before, after, replacements);
      changes.push(...result.changes);
      unsupported.push(...result.unsupported);
    }
    const graph = compareGraph(pair, comparisonId, source.structure.graph.edges, target.structure.graph.edges);
    changes.push(...graph.changes);
    unsupported.push(...graph.unsupported);
  }

  const order = new Map<string, number>();
  [
    ...target.structure.chapters,
    ...target.structure.blocks,
    ...source.structure.chapters,
    ...source.structure.blocks,
  ].forEach((entity, index) => {
    if (!order.has(entity.id)) order.set(entity.id, index);
  });
  const orderedChanges = orderChanges(changes, order);
  const unsupportedSections = uniqueUnsupported(unsupported);
  const categoryCounts = emptyCategoryCounts();
  for (const change of orderedChanges) categoryCounts[change.category] += 1;
  const status: TideglassComparisonStatus = unsupportedSections.length
    ? "PARTIAL"
    : orderedChanges.length
      ? "COMPLETE"
      : "NO_MEANINGFUL_CHANGE";
  const deterministicBody = {
    comparisonId,
    pair,
    semanticSchemaVersion: TIDEGLASS_SEMANTIC_SCHEMA_VERSION,
    comparisonPolicyVersion: TIDEGLASS_COMPARISON_POLICY_VERSION,
    status,
    changes: orderedChanges,
    unsupportedSections,
    categoryCounts,
  };
  return { ...deterministicBody, deterministicDigest: semanticDigest(deterministicBody) };
}

export function comparisonReceipt(
  changeSet: TideglassChangeSet,
  sourceAdapters: readonly string[],
  targetAdapters: readonly string[],
): TideglassComparisonReceipt {
  return {
    comparisonId: changeSet.comparisonId,
    chronicleId: changeSet.pair.chronicleId,
    sourceEditionId: changeSet.pair.source.editionId,
    sourceChecksum: changeSet.pair.source.editionChecksum,
    targetEditionId: changeSet.pair.target.editionId,
    targetChecksum: changeSet.pair.target.editionChecksum,
    sourceSchemaVersion: changeSet.pair.source.sourceSchemaVersion,
    targetSchemaVersion: changeSet.pair.target.sourceSchemaVersion,
    semanticSchemaVersion: TIDEGLASS_SEMANTIC_SCHEMA_VERSION,
    comparisonPolicyVersion: TIDEGLASS_COMPARISON_POLICY_VERSION,
    normalizationAdapters: [...new Set([...sourceAdapters, ...targetAdapters])].sort(),
    status: changeSet.status,
    changeCount: changeSet.changes.length,
    categoryCounts: changeSet.categoryCounts,
    unsupportedSections: changeSet.unsupportedSections,
    deterministicChangeSetDigest: changeSet.deterministicDigest,
  };
}

export type TideglassDiagnosticProjection = {
  pair: EditionPair;
  comparisonId: string;
  status: TideglassChangeSet["status"];
  categoryCounts: TideglassChangeSet["categoryCounts"];
  changes: ChronicleChangeRecord[];
  unsupportedSections: SemanticUnsupportedSection[];
  receipt: TideglassComparisonReceipt;
};

export function diagnosticProjection(result: TideglassComparisonResult): TideglassDiagnosticProjection {
  return {
    pair: result.changeSet.pair,
    comparisonId: result.changeSet.comparisonId,
    status: result.changeSet.status,
    categoryCounts: result.changeSet.categoryCounts,
    changes: result.changeSet.changes,
    unsupportedSections: result.changeSet.unsupportedSections,
    receipt: result.receipt,
  };
}

export type TideglassPublicSafeFoundationProjection = {
  comparisonId: string;
  status: TideglassChangeSet["status"];
  safeChangeCount: number;
  previewSafe: Array<{ category: ChronicleChangeCategory; kind: ChronicleChangeKind; count: number }>;
  hasWithheldChanges: boolean;
};

export function publicSafeFoundationProjection(
  result: TideglassComparisonResult,
): TideglassPublicSafeFoundationProjection {
  const safe = new Map<string, { category: ChronicleChangeCategory; kind: ChronicleChangeKind; count: number }>();
  let hasWithheldChanges = false;
  for (const change of result.changeSet.changes) {
    if (change.spoilerLevel !== "PREVIEW_SAFE") {
      hasWithheldChanges = true;
      continue;
    }
    const key = `${change.category}:${change.kind}`;
    const current = safe.get(key) ?? { category: change.category, kind: change.kind, count: 0 };
    current.count += 1;
    safe.set(key, current);
  }
  return {
    comparisonId: result.changeSet.comparisonId,
    status: result.changeSet.status,
    safeChangeCount: [...safe.values()].reduce((total, item) => total + item.count, 0),
    previewSafe: [...safe.values()].sort((a, b) =>
      compareCanonicalStrings(`${a.category}:${a.kind}`, `${b.category}:${b.kind}`),
    ),
    hasWithheldChanges,
  };
}
