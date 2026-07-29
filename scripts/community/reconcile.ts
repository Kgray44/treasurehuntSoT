import { reconcileCommunityOperationalState } from "@/community/operations";

void reconcileCommunityOperationalState(process.argv.includes("--apply") ? false : true).then((result) =>
  process.stdout.write(`${JSON.stringify(result)}\n`),
);
