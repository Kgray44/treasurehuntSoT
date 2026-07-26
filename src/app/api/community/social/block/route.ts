import { blockAccount } from "@/community/social";
import { blockInputSchema, executeSocialMutation } from "../contract";

export async function POST(request: Request) {
  return executeSocialMutation(request, blockInputSchema, (actor, input) => blockAccount(actor, input.accountId), 201);
}
