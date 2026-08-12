import { z } from "zod";
import { DRYDOCK_SCENARIO_SCHEMA_VERSION, type DrydockScenario } from "@/drydock/simulation/model";

const id = z.string().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const safeText = z.string().min(1).max(240);
const boundedCount = z.number().int().positive().max(100_000);
const providerOutcome = z.enum(["MATCH", "NO_MATCH", "UNCERTAIN", "UNAVAILABLE", "STALE", "DUPLICATE", "CANCELLED"]);

const inputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("CONTINUE") }).strict(),
  z.object({ kind: z.literal("CHOICE"), targetBlockId: id }).strict(),
  z.object({ kind: z.literal("TEXT_ANSWER"), outcome: z.enum(["MATCH", "NO_MATCH", "EXHAUSTED"]) }).strict(),
  z.object({ kind: z.literal("CAPTAIN"), outcome: z.enum(["APPROVE", "REJECT", "OVERRIDE"]) }).strict(),
  z.object({ kind: z.literal("PROVIDER"), outcome: providerOutcome }).strict(),
  z.object({ kind: z.literal("ADVANCE_TIME"), milliseconds: z.number().int().nonnegative().max(86_400_000) }).strict(),
  z
    .object({ kind: z.literal("PRESENTATION"), outcome: z.enum(["PRESENTED", "FALLBACK", "SKIPPED", "INTERRUPTED", "FAILED"]) })
    .strict(),
]);

const assertionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("CURRENT_BLOCK"), blockId: id }).strict(),
  z.object({ kind: z.literal("STATUS"), status: z.enum(["ACTIVE", "PAUSED", "COMPLETED", "INCOMPLETE_PROOF", "CANCELLED", "FAILED"]) }).strict(),
  z.object({ kind: z.literal("EVENT_COUNT"), eventType: id, count: z.number().int().nonnegative().max(100_000) }).strict(),
  z.object({ kind: z.literal("COVERED_BLOCK"), blockId: id }).strict(),
]);

export const drydockScenarioSchema = z
  .object({
    schemaVersion: z.literal(DRYDOCK_SCENARIO_SCHEMA_VERSION),
    id,
    revision: z.number().int().positive().max(1_000_000),
    sourceChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    title: safeText,
    purpose: safeText,
    seed: z.string().min(1).max(256),
    initialState: z
      .object({
        startBlockId: id.optional(),
        variables: z.record(id, z.union([z.boolean(), z.number().finite(), z.string().max(256), z.array(z.string().max(128)).max(128)])),
        inventory: z.array(id).max(256),
        actorMode: z.enum(["PLAYER", "CAPTAIN", "CREATOR"]),
      })
      .strict(),
    environment: z
      .object({
        virtualStart: z.string().datetime(),
        locale: z.string().regex(/^[A-Za-z]{2,8}(-[A-Za-z0-9]{2,8}){0,2}$/),
        viewport: z.enum(["DESKTOP", "MOBILE", "NARROW"]),
        reducedMotion: z.boolean(),
        soundEnabled: z.boolean(),
        keyboardOnly: z.boolean(),
      })
      .strict(),
    limits: z
      .object({
        maxSteps: boundedCount.max(10_000),
        maxStates: boundedCount.max(100_000),
        maxTraceEntries: boundedCount.max(100_000),
        maxVirtualMilliseconds: boundedCount.max(604_800_000),
      })
      .strict(),
    inputs: z.array(inputSchema).max(10_000),
    faults: z
      .array(
        z
          .object({
            id,
            family: z.enum(["NETWORK", "ASSET", "PROVIDER", "RUNTIME", "PRESENTATION", "DEVICE", "ACCESSIBILITY", "TIME"]),
            code: id,
            beforeInput: z.number().int().nonnegative().max(10_000),
          })
          .strict(),
      )
      .max(1_000),
    assertions: z.array(assertionSchema).max(1_000),
    tags: z.array(z.string().min(1).max(64)).max(32),
  })
  .strict()
  .superRefine((scenario, context) => {
    if (Object.keys(scenario.initialState.variables).length > 256)
      context.addIssue({ code: "custom", path: ["initialState", "variables"], message: "Scenario variables exceed the governed limit." });
    if (scenario.limits.maxTraceEntries < scenario.inputs.length)
      context.addIssue({ code: "custom", path: ["limits", "maxTraceEntries"], message: "Trace limit must hold every declared Scenario input." });
    const faultIds = new Set<string>();
    scenario.faults.forEach((fault, index) => {
      if (faultIds.has(fault.id)) context.addIssue({ code: "custom", path: ["faults", index, "id"], message: "Fault IDs must be unique." });
      faultIds.add(fault.id);
    });
  });

export function parseDrydockScenario(value: unknown): DrydockScenario {
  return drydockScenarioSchema.parse(value) as DrydockScenario;
}
