import { collectCommunityProviderHealth } from "@/community/operations";

void collectCommunityProviderHealth().then((health) => {
  process.stdout.write(`${JSON.stringify({ role: process.env.COMMUNITY_PROCESS_ROLE ?? "web", health })}\n`);
});
