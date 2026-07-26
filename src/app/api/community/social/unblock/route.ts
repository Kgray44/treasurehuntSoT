import { unblockAccount } from "@/community/social";
import { blockInputSchema, executeSocialMutation } from "../contract";

export async function POST(request: Request) {
  return executeSocialMutation(request, blockInputSchema, (actor, input) => unblockAccount(actor, input.accountId));
}
