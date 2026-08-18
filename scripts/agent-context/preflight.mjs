import { buildPacket, inspectPacketStaleness, validatePacket } from "./core.mjs";
const packet = buildPacket(process.cwd(), {
  id: "preflight",
  project: "Project Trim",
  increment: "Phase 2",
  objective: "Inspect current Project Trim packet substrate.",
  taskClass: "documentation-only",
  paths: ["AGENTS.md", ".agents/context-workflow.md"],
});
console.log(
  JSON.stringify(
    {
      generator: packet.generator,
      sourceIdentity: packet.sourceIdentity,
      authority: {
        slices: packet.authority.slices.map((entry) => ({
          path: entry.path,
          sections: entry.sections,
          confidence: entry.confidence,
        })),
        conflicts: packet.authority.conflicts,
      },
      slices: Object.keys(packet.integrity.sectionBindings),
      staleness: inspectPacketStaleness(process.cwd(), packet),
      confidence: packet.confidence,
      validation: validatePacket(packet),
    },
    null,
    2,
  ),
);
