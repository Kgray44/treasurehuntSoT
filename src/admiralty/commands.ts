import { randomUUID } from "node:crypto";
import type { AdmiraltyCapabilityId } from "./capabilities";
import { AdmiraltyError } from "./errors";

export type AdmiraltyCommandRisk = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
export type AdmiraltyCommandState =
  | "PREVIEWED"
  | "AUTHORIZED"
  | "EXECUTING"
  | "SUCCEEDED"
  | "FAILED"
  | "CONFLICTED"
  | "PARTIALLY_SUCCEEDED"
  | "COMPENSATING";

export type AdmiraltyCommandRequest<TInput extends Record<string, unknown> = Record<string, unknown>> = Readonly<{
  commandId: string;
  commandType: string;
  actorAccountId: string;
  targetType: string;
  targetId: string;
  expectedRevision?: string;
  reason: string;
  idempotencyKey: string;
  requestedAt: string;
  input: TInput;
}>;

export type AdmiraltyCommandPreview = Readonly<{
  commandType: string;
  targetSummary: Record<string, unknown>;
  currentState: Record<string, unknown>;
  resultingState: Record<string, unknown>;
  consequences: readonly string[];
  warnings: readonly string[];
  requiredCapability: AdmiraltyCapabilityId;
  risk: AdmiraltyCommandRisk;
  reauthenticationRequired: boolean;
  auditBehavior: string;
  rollbackAvailable: boolean;
  compensatingAction?: string;
  revision?: string;
}>;

export type AdmiraltyCommandReceipt = Readonly<{
  commandId: string;
  commandType: string;
  targetType: string;
  targetId: string;
  outcome: AdmiraltyCommandState;
  ownerDomain: string;
  ownerReceiptId?: string;
  correlationId: string;
  completedAt: string;
  resultSummary: Record<string, unknown>;
}>;

export type AdmiraltyCommandPort<TInput extends Record<string, unknown> = Record<string, unknown>> = Readonly<{
  ownerDomain: string;
  preview(request: AdmiraltyCommandRequest<TInput>): Promise<AdmiraltyCommandPreview>;
  execute(
    request: AdmiraltyCommandRequest<TInput>,
    preview: AdmiraltyCommandPreview,
  ): Promise<
    Omit<
      AdmiraltyCommandReceipt,
      "commandId" | "commandType" | "targetType" | "targetId" | "ownerDomain" | "completedAt"
    >
  >;
}>;

const secretPattern = /(?:password|token|secret|credential|cookie|private key|csrf)/iu;
const idPattern = /^[A-Za-z0-9_-]{16,128}$/u;

export function commandRequiresRecentAssurance(risk: AdmiraltyCommandRisk) {
  return risk === "HIGH" || risk === "CRITICAL";
}

export function validateAdmiraltyCommandRequest(request: AdmiraltyCommandRequest) {
  if (!request.commandId || !request.commandType || !request.actorAccountId || !request.targetType || !request.targetId)
    throw new AdmiraltyError("ADMIN_VALIDATION_FAILED", "The command identity is incomplete.", 400);
  if (!idPattern.test(request.idempotencyKey))
    throw new AdmiraltyError("ADMIN_IDEMPOTENCY_INVALID", "A valid command idempotency key is required.", 400);
  const reason = request.reason.trim();
  if (reason.length < 8 || reason.length > 240 || secretPattern.test(reason))
    throw new AdmiraltyError("ADMIN_REASON_INVALID", "Provide a bounded reason without sensitive values.", 400);
  if (reason.toLowerCase() === "because")
    throw new AdmiraltyError("ADMIN_REASON_INVALID", "Provide a meaningful reason for this operation.", 400);
  if (!Number.isFinite(Date.parse(request.requestedAt)))
    throw new AdmiraltyError("ADMIN_VALIDATION_FAILED", "The command time is invalid.", 400);
}

export function newAdmiraltyCommandRequest<TInput extends Record<string, unknown>>(
  request: Omit<AdmiraltyCommandRequest<TInput>, "commandId" | "requestedAt"> &
    Partial<Pick<AdmiraltyCommandRequest<TInput>, "commandId" | "requestedAt">>,
) {
  return {
    ...request,
    commandId: request.commandId ?? randomUUID(),
    requestedAt: request.requestedAt ?? new Date().toISOString(),
  } satisfies AdmiraltyCommandRequest<TInput>;
}

export async function previewAdmiraltyCommand<TInput extends Record<string, unknown>>(
  port: AdmiraltyCommandPort<TInput>,
  request: AdmiraltyCommandRequest<TInput>,
) {
  validateAdmiraltyCommandRequest(request);
  const preview = await port.preview(request);
  if (!preview.commandType || preview.commandType !== request.commandType)
    throw new AdmiraltyError("ADMIN_OPERATION_UNAVAILABLE", "The owning service returned an invalid preview.", 503);
  if (commandRequiresRecentAssurance(preview.risk) !== preview.reauthenticationRequired)
    throw new AdmiraltyError(
      "ADMIN_OPERATION_UNAVAILABLE",
      "The owning service returned an unsafe assurance policy.",
      503,
    );
  return preview;
}

export async function executeAdmiraltyCommand<TInput extends Record<string, unknown>>(
  port: AdmiraltyCommandPort<TInput>,
  request: AdmiraltyCommandRequest<TInput>,
  preview: AdmiraltyCommandPreview,
) {
  validateAdmiraltyCommandRequest(request);
  if (preview.commandType !== request.commandType)
    throw new AdmiraltyError("ADMIN_CONFLICT", "The command changed; refresh and review the current state.", 409);
  const ownerReceipt = await port.execute(request, preview);
  return {
    ...ownerReceipt,
    commandId: request.commandId,
    commandType: request.commandType,
    targetType: request.targetType,
    targetId: request.targetId,
    ownerDomain: port.ownerDomain,
    completedAt: new Date().toISOString(),
  } satisfies AdmiraltyCommandReceipt;
}
