import { buildPacket } from "./core.mjs";
const packet = buildPacket(process.cwd(), {
  id: "preflight",
  objective: "Inspect current Project Trim packet substrate.",
  taskClass: "documentation-only",
  paths: ["AGENTS.md", ".agents/context-workflow.md"],
});
console.log(
  JSON.stringify(
    {
      generator: packet.generator,
      sourceIdentity: packet.sourceIdentity,
      authority: packet.authority,
      confidence: packet.confidence,
    },
    null,
    2,
  ),
);
