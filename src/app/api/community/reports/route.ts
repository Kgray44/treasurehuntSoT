import { createReport } from "@/community/social";
import { executeSocialMutation } from "@/app/api/community/social/contract";
import { reportInputSchema } from "@/app/api/community/comments/contract";

export async function POST(request: Request) {
  return executeSocialMutation(request, reportInputSchema, createReport, 201);
}
