import { unblockCreatorProfile } from "@/community/social";
import { creatorProfileInputSchema, executeSocialMutation } from "../contract";

export async function POST(request: Request) {
  return executeSocialMutation(request, creatorProfileInputSchema, (actor, input) =>
    unblockCreatorProfile(actor, input.creatorProfileId),
  );
}
