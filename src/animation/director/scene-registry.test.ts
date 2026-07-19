import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type {
  AnimationSceneName,
  AnySceneTargetContract,
  SceneReachability,
  SceneTargetRequirementV2,
} from "../core/animation-types";
import { sceneNames } from "../core/animation-types";
import { sceneContracts, sceneReachabilityEvidence, sceneRegistry } from "./scene-registry";
import { progressionEventPresentationPolicy } from "@/components/player/progression/event-policy";

const expectedReachability: Record<SceneReachability, number> = {
  production: 17,
  legacy: 4,
  "future-contract": 5,
  deprecated: 3,
  "development-only": 0,
};

const expectedNonProduction: Partial<Record<AnimationSceneName, SceneReachability>> = {
  "journal-open": "deprecated",
  "manual-page-flip": "deprecated",
  "programmatic-page-flip": "deprecated",
  "chapter-heading": "future-contract",
  "prose-ink": "future-contract",
  "marker-stamp": "future-contract",
  "ship-course": "future-contract",
  "artifact-inspection": "future-contract",
};

const quartermasterProductionScenes = [
  "artifact-award",
  "map-reveal",
  "route-draw",
  "artifact-connection",
  "quest-discovery",
  "quest-complete",
  "log-entry",
  "finale-tease",
  "finale-requirement",
  "mark-solved",
  "pause",
  "resume",
  "undo",
] as const satisfies readonly AnimationSceneName[];

function targets(contract: AnySceneTargetContract) {
  return contract.version === 2 ? contract.targets : [...contract.requiredTargets, ...contract.optionalTargets];
}

function requiredTargets(contract: AnySceneTargetContract) {
  return targets(contract).filter((target) => target.required);
}

function optionalTargets(contract: AnySceneTargetContract) {
  return targets(contract).filter((target) => !target.required);
}

describe("scene registry", () => {
  it("contains one unique definition and contract for every public scene name", () => {
    expect(Object.keys(sceneRegistry).sort()).toEqual([...sceneNames].sort());
    expect(Object.keys(sceneContracts).sort()).toEqual([...sceneNames].sort());
    expect(new Set(Object.values(sceneRegistry).map((definition) => definition.name)).size).toBe(sceneNames.length);
    expect(new Set(Object.values(sceneContracts).map((contract) => contract.sceneName)).size).toBe(sceneNames.length);
  });

  it("keeps every source builder attached to its matching contract", () => {
    for (const name of sceneNames) {
      const definition = sceneRegistry[name];
      expect(definition.name).toBe(name);
      expect(definition.contract).toBe(sceneContracts[name]);
      expect(definition.contract.sceneName).toBe(name);
      expect(definition.buildOpening).toBeTypeOf("function");
      expect(definition.buildSuccess).toBeTypeOf("function");
    }
  });

  it("gives all contracts valid targets, hosts, timeouts, and policies", () => {
    for (const contract of Object.values(sceneContracts)) {
      if (contract.version === 2) {
        expect(contract.expectedHostKinds.length).toBeGreaterThan(0);
        expect(contract.finalStatePolicy.kind).toMatch(
          /^(revert-immediately|hold-final-until-unmount|commit-final-state|reconcile-then-revert|fallback-to-static-state)$/,
        );
        if (contract.finalStatePolicy.kind === "reconcile-then-revert") {
          expect(contract.finalStatePolicy.handoffTargetKey, contract.sceneName).toBeTruthy();
        }
        expect(contract.cleanupPolicy.cleanupTimeoutMs).toBeGreaterThan(0);
        expect(contract.cleanupPolicy.releaseOrder).toEqual([
          "runtime-resources",
          "temporary-styles",
          "external-handles",
          "ownership-claims",
          "target-handles",
          "invocation-registration",
        ]);
      } else expect(contract.expectedHostKind.length).toBeGreaterThan(0);
      expect(contract.timeoutMs).toBeGreaterThan(0);
      expect(contract.playbackPolicy.priority).toBeGreaterThanOrEqual(0);
      expect(contract.reducedFallback).toMatch(/^(semantic-final-state|static-reader|none)$/);
      expect(contract.acknowledgmentPolicy.acknowledgmentOwner).toMatch(/^(player-presentation|caller|none)$/);
      expect(contract.finalStatePolicy.kind).toBeTruthy();

      const declaredKeys = targets(contract).map((target) => ("key" in target ? target.key : target.part));
      expect(new Set(declaredKeys).size, contract.sceneName).toBe(declaredKeys.length);
      const duplicatePartGroups = new Map<
        string,
        Array<{ part: string; required: boolean; source?: SceneTargetRequirementV2["source"] }>
      >();
      for (const target of targets(contract)) {
        const declarations = duplicatePartGroups.get(target.part) ?? [];
        declarations.push({
          part: target.part,
          required: target.required,
          ...(contract.version === 2 && "source" in target ? { source: target.source } : {}),
        });
        duplicatePartGroups.set(target.part, declarations);
      }
      for (const [part, declarations] of duplicatePartGroups) {
        if (declarations.length < 2) continue;
        expect(
          declarations.filter((target) => target.required).length,
          `${contract.sceneName}:${part}:required`,
        ).toBeLessThanOrEqual(1);
        expect(
          new Set(declarations.map((target) => (target.source ? JSON.stringify(target.source) : "legacy"))).size,
          `${contract.sceneName}:${part}:sources`,
        ).toBe(declarations.length);
      }
      if (contract.playbackPolicy.allowUserSkip) {
        expect(contract.playbackPolicy.userSkipFinalState, contract.sceneName).toBeTruthy();
      }

      for (const target of requiredTargets(contract)) {
        expect(target.required).toBe(true);
        expect(target.cardinality.min).toBeGreaterThanOrEqual(1);
        expect(target.cardinality.max).toBeGreaterThanOrEqual(target.cardinality.min);
        if (contract.version === 2 && "identityOnly" in target && target.identityOnly) {
          expect(target.owner).toBeNull();
          expect(target.properties).toEqual([]);
        } else expect(target.properties.length).toBeGreaterThan(0);
        expect(target.visibility.rejectPageFlipSource).toBe(true);
        expect(target.visibility.rejectStaleSceneInstance).toBe(true);
      }
      for (const target of optionalTargets(contract)) {
        expect(target.required).toBe(false);
        expect(target.cardinality.min).toBe(0);
        expect(target.cardinality.max).toBeGreaterThanOrEqual(1);
        expect(target.properties.length).toBeGreaterThan(0);
      }
      if (contract.version === 2) {
        expect(new Set(contract.targets.map((target) => target.key)).size, contract.sceneName).toBe(
          contract.targets.length,
        );
        for (const target of contract.targets) {
          expect(target.source.kind).toMatch(/^(host|external)$/);
          expect(target.properties).not.toContain("custom");
        }
      }
    }
  });

  it("uses native v2 contracts for all production, future, and deprecated scenes", () => {
    for (const contract of Object.values(sceneContracts)) {
      if (contract.reachability !== "legacy") expect(contract.version, contract.sceneName).toBe(2);
    }
    expect(
      Object.values(sceneContracts)
        .filter((contract) => contract.version === 1)
        .map((contract) => contract.sceneName),
    ).toEqual(["player-access", "quartermaster-login", "seal-break", "prepare-chapter"]);
  });

  it("limits the observable v1 adapter to the four named typed-host legacy scenes", () => {
    expect(sceneContracts["player-access"]).toMatchObject({ version: 1, expectedHostKind: "access" });
    expect(sceneContracts["quartermaster-login"]).toMatchObject({ version: 1, expectedHostKind: "access" });
    expect(sceneContracts["seal-break"]).toMatchObject({ version: 1, expectedHostKind: "quartermaster-command" });
    expect(sceneContracts["prepare-chapter"]).toMatchObject({
      version: 1,
      expectedHostKind: "quartermaster-command",
    });
  });

  it("matches the frozen reachability totals and gives every production scene a semantic target", () => {
    const actual = Object.values(sceneContracts).reduce<Record<SceneReachability, number>>(
      (counts, contract) => {
        counts[contract.reachability] += 1;
        return counts;
      },
      { production: 0, legacy: 0, "future-contract": 0, deprecated: 0, "development-only": 0 },
    );
    expect(actual).toEqual(expectedReachability);
    for (const contract of Object.values(sceneContracts).filter((item) => item.reachability === "production")) {
      expect(requiredTargets(contract).length, contract.sceneName).toBeGreaterThan(0);
    }
  });

  it("allows quartermaster-command only for verified production actionScene callers", () => {
    const quartermasterSource = readFileSync(resolve(process.cwd(), "src/components/gm/Quartermaster.tsx"), "utf8");
    const actionSceneBlock = quartermasterSource.match(
      /const actionScene: Record<Action\[0\], AnimationSceneName> = \{([\s\S]*?)\n\};/,
    )?.[1];
    expect(actionSceneBlock).toBeTruthy();
    const sourceMappedProductionScenes = new Set(
      [...(actionSceneBlock ?? "").matchAll(/^\s+[A-Z_]+:\s+"([a-z0-9-]+)",$/gm)]
        .map((match) => match[1] as AnimationSceneName)
        .filter((name) => sceneContracts[name]?.reachability === "production"),
    );
    expect([...sourceMappedProductionScenes].sort()).toEqual([...quartermasterProductionScenes].sort());

    const dualHostProductionScenes = Object.values(sceneContracts)
      .filter(
        (contract): contract is Extract<typeof contract, { version: 2 }> =>
          contract.version === 2 &&
          contract.reachability === "production" &&
          contract.expectedHostKinds.includes("quartermaster-command"),
      )
      .map((contract) => contract.sceneName)
      .sort();
    expect(dualHostProductionScenes).toEqual([...sourceMappedProductionScenes].sort());

    for (const contract of Object.values(sceneContracts).filter(
      (item): item is Extract<typeof item, { version: 2 }> => item.version === 2 && item.reachability === "production",
    )) {
      expect(contract.expectedHostKinds.includes("quartermaster-command"), contract.sceneName).toBe(
        sourceMappedProductionScenes.has(contract.sceneName),
      );
      expect(contract.expectedHostKinds, contract.sceneName).not.toContain("development-showcase");
      if (contract.sceneName !== "studio-publish")
        expect(contract.expectedHostKinds, contract.sceneName).not.toContain("platform-ceremony");

      const evidence = sceneReachabilityEvidence[contract.sceneName];
      if (evidence.reachability !== "production") continue;
      expect(
        evidence.additionalCallers?.some((caller) => caller.sourcePath === "src/components/gm/Quartermaster.tsx") ??
          false,
      ).toBe(sourceMappedProductionScenes.has(contract.sceneName));
    }
  });

  it("records the eight revalidated non-production dispositions", () => {
    expect(Object.keys(expectedNonProduction)).toHaveLength(8);
    for (const [name, reachability] of Object.entries(expectedNonProduction)) {
      expect(sceneContracts[name as AnimationSceneName].reachability).toBe(reachability);
    }
  });

  it("grounds every production disposition in a real current caller", () => {
    const sourceCache = new Map<string, string>();

    for (const contract of Object.values(sceneContracts).filter((item) => item.reachability === "production")) {
      const evidence = sceneReachabilityEvidence[contract.sceneName];
      expect(evidence.reachability, contract.sceneName).toBe("production");
      if (evidence.reachability !== "production") continue;

      for (const caller of [evidence.caller, ...(evidence.additionalCallers ?? [])]) {
        expect(caller.sourcePath, contract.sceneName).toMatch(/^src\/(components|app)\//);
        expect(caller.sourcePath, contract.sceneName).not.toMatch(/(?:^|\/)(?:dev|tests?)(?:\/|$)/);
        expect(caller.sourcePath, contract.sceneName).not.toMatch(/\.test\.[cm]?[jt]sx?$/);

        const source =
          sourceCache.get(caller.sourcePath) ?? readFileSync(resolve(process.cwd(), caller.sourcePath), "utf8");
        sourceCache.set(caller.sourcePath, source);

        expect(source, `${contract.sceneName}: caller symbol`).toContain(caller.callerSymbol);
        expect(source, `${contract.sceneName}: scene binding`).toContain(caller.sceneBinding);
        expect(source, `${contract.sceneName}: Director invocation`).toContain(caller.invocation);
      }
    }
  });

  it("keeps reachability evidence exhaustive and aligned with all 29 contracts", () => {
    expect(Object.keys(sceneReachabilityEvidence).sort()).toEqual([...sceneNames].sort());

    for (const contract of Object.values(sceneContracts)) {
      const evidence = sceneReachabilityEvidence[contract.sceneName];
      expect(evidence.reachability, contract.sceneName).toBe(contract.reachability);
      if (evidence.reachability === "future-contract") {
        expect(evidence.disposition, contract.sceneName).toContain("no current production caller");
      }
      if (evidence.reachability === "deprecated") {
        expect(evidence.replacement, contract.sceneName).toBe(contract.replacedBy);
        const source = readFileSync(resolve(process.cwd(), evidence.replacementSourcePath), "utf8");
        expect(source, `${contract.sceneName}: replacement symbol`).toContain(evidence.replacementSymbol);
      }
    }
  });

  it("rejects false production semantics for deprecated scenes and names their replacements", () => {
    for (const contract of Object.values(sceneContracts).filter((item) => item.reachability === "deprecated")) {
      expect(contract.version).toBe(2);
      if (contract.version !== 2) continue;
      expect(contract.targets).toEqual([]);
      expect(contract.playbackPolicy.source).toBe("development");
      expect(contract.replacedBy).toBeTruthy();
      expect(contract.acknowledgmentPolicy.acknowledgeOn).toEqual([]);
    }
    expect(sceneContracts["manual-page-flip"].replacedBy).toContain("PageFlipBook");
    expect(sceneContracts["programmatic-page-flip"].replacedBy).toContain("PageFlipBook");
  });

  it("makes chapter release mandatory, readable, skippable-to-final, and replayable", () => {
    const chapter = sceneContracts["chapter-release"];
    expect(chapter.acknowledgmentPolicy).toEqual({
      kind: "mandatory",
      acknowledgeOn: ["presented", "presented-fallback", "skipped-by-user"],
      fallbackMustBeReadable: true,
      acknowledgmentOwner: "player-presentation",
    });
    expect(chapter.playbackPolicy.replayable).toBe(true);
    expect(chapter.playbackPolicy.allowUserSkip).toBe(true);
    expect(chapter.playbackPolicy.allowedFallback).toBe("readable-chapter-release");
    expect(requiredTargets(chapter).map((target) => target.part)).toEqual(
      expect.arrayContaining(["journal-stage", "sealed-parchment", "ink-heading", "ink-story", "ink-objective"]),
    );
  });

  it("preserves Phase 2 declaration identity and cardinality while Phase 3 moves Player visuals host-local", () => {
    expect(Object.values(sceneContracts).flatMap((contract) => requiredTargets(contract))).toHaveLength(44);
    expect(Object.values(sceneContracts).flatMap((contract) => optionalTargets(contract))).toHaveLength(103);
    expect(Object.values(sceneContracts).filter((contract) => contract.playbackPolicy.replayable)).toHaveLength(15);
    expect(
      Object.values(sceneContracts).filter(
        (contract) => contract.acknowledgmentPolicy.acknowledgmentOwner === "player-presentation",
      ),
    ).toHaveLength(14);
  });

  it("keeps every Phase 3 Player policy scene replayable at the Director contract boundary", () => {
    const policyScenes = new Set(Object.values(progressionEventPresentationPolicy).map((policy) => policy.sceneName));
    expect(policyScenes.size).toBe(14);
    for (const sceneName of policyScenes) {
      expect(sceneContracts[sceneName].playbackPolicy.replayable, sceneName).toBe(true);
    }
  });

  it("declares exact external continuity handles without DOM-order semantics", () => {
    const externalTargets = Object.values(sceneContracts).flatMap((contract) =>
      contract.version === 2
        ? contract.targets.filter(
            (target): target is SceneTargetRequirementV2 & { source: { kind: "external"; handleKey: string } } =>
              target.source.kind === "external",
          )
        : [],
    );
    expect(externalTargets.length).toBeGreaterThan(0);
    for (const target of externalTargets) {
      expect(target.source.handleKey).toMatch(/^[a-z0-9-]+$/);
      expect(target.source.handleKey).not.toMatch(/(?:first|last|index|nth)/);
    }
  });

  it("declares every policy local enhancement as a non-blocking exact external capability", () => {
    const expected = {
      "chapter-release": { "sealed-parchment": ["transform"] },
      "mark-solved": { "chapter-solved-stamp": ["transform", "opacity"] },
      "artifact-award": { "artifact-slot": ["transform", "opacity", "filter"] },
      "artifact-connection": {
        "artifact-connection-path": ["path-drawing", "stroke-dasharray", "stroke-dashoffset", "opacity"],
      },
      "map-reveal": { "map-marker": ["transform", "opacity"] },
      "route-draw": { "route-path": ["path-drawing", "stroke-dasharray", "stroke-dashoffset", "opacity"] },
      "quest-discovery": {
        "quest-note": ["transform", "opacity"],
        "quest-red-thread": ["path-drawing", "stroke-dasharray", "stroke-dashoffset"],
        "quest-objective": ["transform", "opacity"],
      },
      "quest-complete": { "quest-stamp": ["transform", "opacity"] },
      "log-entry": {
        "journal-annotation-ink": ["opacity", "clip-path", "filter"],
        "log-entry": ["opacity", "clip-path", "filter"],
        "log-symbol": ["transform", "opacity"],
      },
      "finale-tease": { "finale-mechanism": ["transform", "opacity"] },
      "finale-requirement": { "finale-requirement-socket": ["transform", "opacity", "filter"] },
    } as const;

    for (const [sceneName, handles] of Object.entries(expected)) {
      const contract = sceneContracts[sceneName as AnimationSceneName];
      expect(contract.version, sceneName).toBe(2);
      if (contract.version !== 2) continue;
      for (const [handleKey, properties] of Object.entries(handles)) {
        const target = contract.targets.find(
          (candidate) => candidate.source.kind === "external" && candidate.source.handleKey === handleKey,
        );
        expect(target, `${sceneName}:${handleKey}`).toMatchObject({
          key: `local-${handleKey}`,
          required: false,
          owner: "gsap",
          properties,
          source: { kind: "external", handleKey },
        });
        expect(
          contract.targets.some(
            (candidate) => candidate.required && candidate.source.kind === "host" && candidate.key === handleKey,
          ),
          `${sceneName}:${handleKey}:distinct-global-key`,
        ).toBe(false);
      }
    }
  });

  it("keeps the artifact award global destination identity-only and host-local", () => {
    const contract = sceneContracts["artifact-award"];
    expect(contract.version).toBe(2);
    if (contract.version !== 2) return;
    const target = contract.targets.find((candidate) => candidate.key === "artifact-slot-target");
    expect(target).toMatchObject({
      part: "artifact-slot-target",
      identityOnly: true,
      owner: null,
      properties: [],
      source: { kind: "host" },
      required: true,
    });
  });

  it("requires map and Log global targets on the persistent host", () => {
    const map = sceneContracts["map-reveal"];
    const log = sceneContracts["log-entry"];
    expect(map.version).toBe(2);
    expect(log.version).toBe(2);
    if (map.version !== 2 || log.version !== 2) return;

    expect(map.targets.find((target) => target.key === "map-marker-new")).toMatchObject({
      part: "map-marker",
      properties: ["transform", "opacity"],
      required: true,
      source: { kind: "host" },
    });
    expect(log.targets.find((target) => target.key === "log-entry-new")).toMatchObject({
      part: "log-entry-new",
      properties: ["opacity", "clip-path", "filter"],
      required: true,
      source: { kind: "host" },
    });
  });
});
