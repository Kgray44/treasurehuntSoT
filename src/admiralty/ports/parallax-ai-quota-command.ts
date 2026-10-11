import type { AdmiraltyCommandPort } from "@/admiralty/commands";
import type { AdmiraltyCurrentOperator } from "@/admiralty/authorization";
import { previewAIQuotaPolicy, executeAIQuotaPolicy, type AIQuotaCommandInput } from "@/parallax/ai-quota-commands";

export function parallaxAIQuotaPort(
  actor: AdmiraltyCurrentOperator,
  previewId?: string,
): AdmiraltyCommandPort<AIQuotaCommandInput> {
  return {
    ownerDomain: "Parallax",
    async preview(request) {
      const preview = await previewAIQuotaPolicy(actor, {
        ...request.input,
        reason: request.reason,
        idempotencyKey: request.idempotencyKey,
      });
      return { ...preview, targetSummary: { target: request.targetId, owner: "Parallax" } };
    },
    async execute(request) {
      const receipt = await executeAIQuotaPolicy(
        actor,
        { ...request.input, reason: request.reason, idempotencyKey: request.idempotencyKey },
        previewId ?? "",
      );
      return {
        outcome: "SUCCEEDED",
        ownerReceiptId: receipt.id,
        correlationId: receipt.id,
        resultSummary: { ...receipt, rollbackAvailable: true },
      };
    },
  };
}
