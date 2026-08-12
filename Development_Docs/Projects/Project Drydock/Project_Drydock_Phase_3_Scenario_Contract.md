---
title: Project Drydock Phase 3 Scenario Contract
audience: engineering
status: current
canonical_for: project-drydock-phase-3-scenario-contract
last_reviewed: 2026-08-12
---

# Project Drydock Phase 3 Scenario Contract

Scenario schema version `1` is the only executable Scenario shape for this phase. Scenarios are Creator-owned, revisioned, source-bound, bounded test definitions; they are not scripts and cannot be used to advance a real Voyage.

```ts
type DrydockScenarioV1 = {
  schemaVersion: 1;
  id: string;
  revision: number;
  sourceChecksum: string;
  title: string;
  purpose: string;
  seed: string;
  initialState: {
    startBlockId?: string;
    variables: Record<string, boolean | number | string | string[]>;
    inventory: string[];
    actorMode: "PLAYER" | "CAPTAIN" | "CREATOR";
  };
  environment: {
    virtualStart: string;
    locale: string;
    viewport: "DESKTOP" | "MOBILE" | "NARROW";
    reducedMotion: boolean;
    soundEnabled: boolean;
    keyboardOnly: boolean;
  };
  limits: {
    maxSteps: number;
    maxStates: number;
    maxTraceEntries: number;
    maxVirtualMilliseconds: number;
  };
  inputs: DrydockScenarioInput[];
  faults: DrydockFaultScheduleEntry[];
  assertions: DrydockScenarioAssertion[];
  tags: string[];
};
```

Inputs identify stable block/choice/provider outcome tokens and explicit virtual-time advances. Text-answer inputs use result tokens (`MATCH`, `NO_MATCH`, `EXHAUSTED`) rather than answer values. Provider, network, asset, presentation, device, accessibility, and time behavior use the governed fault catalog. No arbitrary JavaScript, regular expression, URL fetch, local path, raw provider evidence, accepted answer, private note, or Creator prose is accepted.

The immutable source checksum, Scenario revision, adapter version, seed, environment, faults, limits, and ordered inputs form the run identity. The immutable result is the ordered safe trace, canonical event intents, assertion dispositions, coverage, terminal disposition, and semantic trace digest. Source or Scenario changes invalidate a historical run; the old immutable run remains inspectable only through authorized redacted projections.

Suites order Scenario revisions by stable ID and retain an explicit expected source checksum. Generated coverage suggestions are unpersisted drafts until an authorized Creator saves a Scenario revision. Scenario cloning creates a new revision chain and never rewrites history.
