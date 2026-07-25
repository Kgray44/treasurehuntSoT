import { createCollection } from "@/community/social";
import { executeSocialMutation } from "../social/contract";
import { createCollectionInputSchema } from "./contract";

export async function POST(request: Request) {
  return executeSocialMutation(request, createCollectionInputSchema, (actor, input) => createCollection(actor, input), 201);
}
