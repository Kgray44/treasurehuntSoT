import { collectCommunityProviderHealth } from "@/community/operations";

void collectCommunityProviderHealth().then((health) => {
  process.stdout.write(`${JSON.stringify({ health })}\n`);
});
