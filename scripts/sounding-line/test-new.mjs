/* Generates an explicitly governed test declaration; no bare test is created. */
import { createHash } from "node:crypto";
import process from "node:process";

const [tier, owner, contract, behavior] = process.argv.slice(2);
if (!tier || !owner || !contract || !behavior) {
  throw new Error("USAGE: npm run test:new -- <tier> <owner> <contract> <behavior>");
}
if (!/^(unit|component|service|api|browser|contract|compatibility)$/u.test(tier))
  throw new Error("INVALID_LOWEST_VALID_TIER");
const id = `sl-test-${createHash("sha256").update(`${owner}:${contract}:${behavior}`).digest("hex").slice(0, 20)}`;
console.log(
  JSON.stringify(
    {
      id,
      title: behavior,
      owner,
      contracts: [contract],
      tier,
      risk: "MODERATE",
      resources: ["node-slot"],
      expectedDurationMs: 30000,
      hardBudgetMs: 60000,
      retryPolicy: "NONE",
      checklist: [
        "success",
        "invalid",
        "unauthorized where applicable",
        "stale/duplicate/retry/interruption where applicable",
      ],
      note: "Add this declaration beside the governed test and run test:policy before committing.",
    },
    null,
    2,
  ),
);
