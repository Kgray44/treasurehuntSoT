import { unsaveSubject } from "@/community/social";
import { executeSocialMutation, saveInputSchema } from "../contract";

export async function POST(request: Request) {
  return executeSocialMutation(request, saveInputSchema, (actor, input) => unsaveSubject(actor, input));
}
