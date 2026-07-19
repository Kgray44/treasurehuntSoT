import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { AnimationSceneName, SceneReachability } from "../core/animation-types";
import { sceneNames } from "../core/animation-types";
import { sceneContracts, sceneReachabilityEvidence, sceneRegistry } from "./scene-registry";

const expectedReachability: Record<SceneReachability, number> = {
  production: 16,
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
      expect(contract.version).toBe(1);
      expect(contract.expectedHostKind.length).toBeGreaterThan(0);
      expect(contract.timeoutMs).toBeGreaterThan(0);
      expect(contract.playbackPolicy.priority).toBeGreaterThanOrEqual(0);
      expect(contract.reducedFallback).toMatch(/^(semantic-final-state|static-reader|none)$/);
      expect(contract.acknowledgmentPolicy.acknowledgmentOwner).toMatch(/^(player-presentation|caller|none)$/);
      expect(contract.finalStatePolicy.kind).toBeTruthy();

      const declaredParts = [...contract.requiredTargets, ...contract.optionalTargets].map((target) => target.part);
      expect(new Set(declaredParts).size, contract.sceneName).toBe(declaredParts.length);
      if (contract.playbackPolicy.allowUserSkip) {
        expect(contract.playbackPolicy.userSkipFinalState, contract.sceneName).toBeTruthy();
      }

      for (const target of contract.requiredTargets) {
        expect(target.required).toBe(true);
        expect(target.cardinality.min).toBeGreaterThanOrEqual(1);
        expect(target.cardinality.max).toBeGreaterThanOrEqual(target.cardinality.min);
        expect(target.properties.length).toBeGreaterThan(0);
        expect(target.visibility.rejectPageFlipSource).toBe(true);
        expect(target.visibility.rejectStaleSceneInstance).toBe(true);
      }
      for (const target of contract.optionalTargets) {
        expect(target.required).toBe(false);
        expect(target.cardinality.min).toBe(0);
        expect(target.cardinality.max).toBeGreaterThanOrEqual(1);
        expect(target.properties.length).toBeGreaterThan(0);
      }
    }
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
      expect(contract.requiredTargets.length, contract.sceneName).toBeGreaterThan(0);
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

      expect(evidence.caller.sourcePath, contract.sceneName).toMatch(/^src\/(components|app)\//);
      expect(evidence.caller.sourcePath, contract.sceneName).not.toMatch(/(?:^|\/)(?:dev|tests?)(?:\/|$)/);
      expect(evidence.caller.sourcePath, contract.sceneName).not.toMatch(/\.test\.[cm]?[jt]sx?$/);

      const source =
        sourceCache.get(evidence.caller.sourcePath) ??
        readFileSync(resolve(process.cwd(), evidence.caller.sourcePath), "utf8");
      sourceCache.set(evidence.caller.sourcePath, source);

      expect(source, `${contract.sceneName}: caller symbol`).toContain(evidence.caller.callerSymbol);
      expect(source, `${contract.sceneName}: scene binding`).toContain(evidence.caller.sceneBinding);
      expect(source, `${contract.sceneName}: Director invocation`).toContain(evidence.caller.invocation);
    }
  });

  it("keeps reachability evidence exhaustive and aligned with all 28 contracts", () => {
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
      expect(contract.requiredTargets).toEqual([]);
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
    expect(chapter.requiredTargets.map((target) => target.part)).toEqual(
      expect.arrayContaining(["journal-stage", "sealed-parchment", "ink-heading", "ink-story", "ink-objective"]),
    );
  });

  it("keeps declaration and acknowledgment totals stable", () => {
    expect(Object.values(sceneContracts).flatMap((contract) => contract.requiredTargets)).toHaveLength(41);
    expect(Object.values(sceneContracts).flatMap((contract) => contract.optionalTargets)).toHaveLength(82);
    expect(Object.values(sceneContracts).filter((contract) => contract.playbackPolicy.replayable)).toHaveLength(2);
    expect(
      Object.values(sceneContracts).filter(
        (contract) => contract.acknowledgmentPolicy.acknowledgmentOwner === "player-presentation",
      ),
    ).toHaveLength(14);
  });
});
