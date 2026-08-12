import { z } from "zod";

export const DRYDOCK_SCENARIO_SUITE_SCHEMA_VERSION = 1;

const id = z.string().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

export type DrydockScenarioSuite = Readonly<{
  schemaVersion: typeof DRYDOCK_SCENARIO_SUITE_SCHEMA_VERSION;
  id: string;
  title: string;
  sourceChecksum: string;
  members: readonly Readonly<{ scenarioId: string; revision: number }> [];
}>;

export const drydockScenarioSuiteSchema = z
  .object({
    schemaVersion: z.literal(DRYDOCK_SCENARIO_SUITE_SCHEMA_VERSION),
    id,
    title: z.string().min(1).max(240),
    sourceChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    members: z.array(z.object({ scenarioId: id, revision: z.number().int().positive().max(1_000_000) }).strict()).min(1).max(500),
  })
  .strict()
  .superRefine((suite, context) => {
    const identities = new Set<string>();
    suite.members.forEach((member, index) => {
      const identity = `${member.scenarioId}:${member.revision}`;
      if (identities.has(identity)) context.addIssue({ code: "custom", path: ["members", index], message: "A Scenario revision may appear once in a Suite." });
      identities.add(identity);
    });
  });

export function parseDrydockScenarioSuite(value: unknown): DrydockScenarioSuite {
  return drydockScenarioSuiteSchema.parse(value) as DrydockScenarioSuite;
}
