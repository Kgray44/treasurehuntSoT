import { followCreator } from "@/community/social";
import { executeSocialMutation, followInputSchema } from "../contract";

export async function POST(request: Request) {
  return executeSocialMutation(
    request,
    followInputSchema,
    (actor, input) => followCreator(actor, input.creatorProfileId),
    201,
  );
}
